// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App, { navigate } from './App'

const category = { id: 1, name: 'Gia dụng', slug: 'gia-dung' }
const product = { id: 1, name: 'Bình giữ nhiệt', slug: 'binh-giu-nhiet', sku: 'B-1', price: 120000, imageUrl: null, category, isFeatured: true }
const detail = { ...product, description: 'Bình dùng hằng ngày.', variants: [{ id: 1, sku: 'B-1', name: '500 ml', price: 120000, imageUrl: null, isActive: true, availability: 'InStock' }, { id: 2, sku: 'B-2', name: '750 ml', price: 180000, imageUrl: null, isActive: true, availability: 'InStock' }] }
const serverPrices: Record<string, number> = { 'B-1': 120000, 'B-2': 180000 }
// Mô phỏng POST /api/cart/validate: BE trả giá hiện hành và tồn khả dụng.
function validateReply(init?: RequestInit, stock: Record<string, number> = {}) {
  const body = JSON.parse(String(init?.body)) as { items: { sku: string; quantity: number }[] }
  const items = body.items.map(line => {
    const available = stock[line.sku] ?? 50, price = serverPrices[line.sku] ?? 0
    return { sku: line.sku, quantity: line.quantity, price, lineTotal: price * line.quantity, availableStock: available, isValid: available >= line.quantity, errorMessage: available >= line.quantity ? null : `Chỉ còn ${available} sản phẩm khả dụng.` }
  })
  return reply({ items, totalAmount: items.reduce((sum, i) => sum + i.lineTotal, 0), allValid: items.every(i => i.isValid) })
}
function reply(data: unknown, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data } as Response }
function setup(path: string, handle?: (url: string, init?: RequestInit) => Response | undefined) {
  window.history.replaceState({}, '', path)
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    const custom = handle?.(input, init); if (custom) return custom
    if (input === '/api/categories') return reply([category])
    if (input === '/api/me/orders') return reply([])
    if (input === '/api/cart/validate') return validateReply(init)
    if (input.startsWith('/api/products/')) return reply(detail)
    return reply({ items: [product], page: Number(new URL(input, 'http://localhost').searchParams.get('page') || 1), pageSize: 12, totalCount: 13 })
  })
  vi.stubGlobal('fetch', fetcher); render(<App />); return fetcher
}
// Node 26 không cấp localStorage cho jsdom nếu thiếu --localstorage-file: dùng Storage trong bộ nhớ.
beforeEach(() => {
  const data = new Map<string, string>()
  const memory = {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => { data.delete(key) },
    setItem: (key: string, value: string) => { data.set(key, String(value)) }
  }
  Object.defineProperty(window, 'localStorage', { value: memory, configurable: true })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  try { window.localStorage.clear() } catch { /* storage may be unavailable in the test runtime */ }
  window.history.replaceState({}, '', '/')
})
describe('Catalog storefront', () => {
  it('home loads featured data and links to a real product detail', async () => {
    const fetcher = setup('/')
    expect(screen.getByRole('heading', { name: /Lựa chọn mỗi ngày/ })).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('link', { name: /Bình giữ nhiệt/ }))
    expect(await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/products?featured=true&page=1&pageSize=4&sort=featured', expect.anything())
    expect(screen.queryByText(/đã thêm thành công/i)).not.toBeInTheDocument()
  })
  it('syncs filter criteria and pagination to URL and restores on popstate', async () => {
    const fetcher = setup('/products')
    await screen.findByText('13 sản phẩm phù hợp')
    fireEvent.change(screen.getByLabelText('Từ khóa'), { target: { value: 'bình' } })
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'gia-dung' } })
    fireEvent.change(screen.getByLabelText('Sắp xếp'), { target: { value: 'price-desc' } })
    fireEvent.change(screen.getByLabelText('Giá từ (đ)'), { target: { value: '100000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('q=b%C3%ACnh&category=gia-dung&sort=price-desc&minPrice=100000'), expect.anything()))
    await screen.findByText('13 sản phẩm phù hợp')
    expect(screen.getByLabelText('Sắp xếp')).toHaveValue('price-desc')
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await screen.findByText('Trang 2 / 2')
    expect(window.location.search).toContain('page=2')
    act(() => { window.history.replaceState({}, '', '/products?q=khac'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(screen.getByLabelText('Từ khóa')).toHaveValue('khac')
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/products?q=khac&page=1&pageSize=12', expect.anything()))
  })
  it('validates price range without fetching invalid filters', async () => {
    setup('/products'); await screen.findByText('13 sản phẩm phù hợp')
    fireEvent.change(screen.getByLabelText('Giá từ (đ)'), { target: { value: '200' } })
    fireEvent.change(screen.getByLabelText('Giá đến (đ)'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Giá tối thiểu không được lớn hơn giá tối đa.')
    expect(window.location.search).toBe('')
  })
  it('searches from shared header', async () => {
    setup('/'); fireEvent.change(screen.getByLabelText('Tìm sản phẩm'), { target: { value: 'bình' } }); fireEvent.click(screen.getByRole('button', { name: 'Tìm kiếm' }))
    await screen.findByText('13 sản phẩm phù hợp'); expect(new URLSearchParams(window.location.search).get('q')).toBe('bình')
  })
  it('updates selected SKU price and validates quantity', async () => {
    setup('/products/binh-giu-nhiet'); await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })
    fireEvent.change(screen.getByLabelText('Phiên bản'), { target: { value: 'B-2' } })
    expect(screen.getByText(/180\.000/)).toBeInTheDocument(); expect(window.location.search).toBe('?sku=B-2')
    fireEvent.change(screen.getByLabelText('Số lượng'), { target: { value: '0' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Số lượng phải là số nguyên dương.')
    expect(screen.getByText(/không giao hàng hay thu tiền thật/)).toBeInTheDocument()
    expect(screen.getByText(/không thay thế chẩn đoán/)).toBeInTheDocument()
  })
  it('does not silently substitute unknown SKU', async () => {
    setup('/products/binh-giu-nhiet?sku=missing'); await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })
    expect(screen.getByRole('alert')).toHaveTextContent('SKU không tồn tại')
    expect(screen.queryByText(/120\.000/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Phiên bản'), { target: { value: 'B-1' } })
    expect(screen.getByText(/120\.000/)).toBeInTheDocument()
  })
  it('shows error and retries failed product API', async () => {
    let failed = true
    setup('/products', url => url.startsWith('/api/products?') && failed ? reply({}, 500) : undefined)
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải dữ liệu')
    failed = false; fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('13 sản phẩm phù hợp')).toBeInTheDocument()
  })
  it('handles empty search results', async () => {
    setup('/products?q=missing', url => url.startsWith('/api/products?') ? reply({ items: [], page: 1, pageSize: 12, totalCount: 0 }) : undefined)
    expect(await screen.findByText('Không có sản phẩm phù hợp.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled()
  })
  it('shows loading while request is pending', () => {
    window.history.replaceState({}, '', '/products'); vi.stubGlobal('fetch', () => new Promise(() => {})); render(<App />)
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })
  it('handles unknown product and unknown route with technical 404', async () => {
    setup('/products/missing', url => url === '/api/products/missing' ? reply({}, 404) : undefined)
    expect(await screen.findByRole('heading', { name: '404 · Không tìm thấy' })).toBeInTheDocument()
    act(() => navigate('/not-a-route'))
    expect(screen.getByRole('heading', { name: '404 · Không tìm thấy' })).toBeInTheDocument()
  })
  it('admin shell contains no fabricated KPI or active admin links', () => {
    const fetcher = setup('/admin')
    expect(screen.getByRole('heading', { name: 'Đăng nhập để tiếp tục' })).toBeInTheDocument()
    expect(screen.getAllByRole('link').every(link => link.getAttribute('href') === '/')).toBe(true)
    expect(fetcher.mock.calls.every(([url]) => !url.includes('/admin'))).toBe(true)
    expect(screen.queryByText(/đa kênh|sàn thương mại|shopee|lazada|tiktok/i)).not.toBeInTheDocument()
  })

  it('updates the shared account header immediately after login without reload', async () => {
    setup('/', url => url === '/api/auth/login' ? reply({ token: 'demo-token', user: { id: 7, email: 'an@example.com', fullName: 'Nguyễn An', role: 'Customer' } }) : undefined)
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret1' } })
    const submitBtn = screen.getAllByRole('button', { name: 'Đăng nhập' }).find(b => b.getAttribute('type') === 'submit')!
    fireEvent.click(submitBtn)
    expect(await screen.findByText('Nguyễn An')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument()
  })

  it('updates the shared cart count immediately after adding a SKU', async () => {
    setup('/products/binh-giu-nhiet')
    await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }))
    expect(screen.getByRole('link', { name: /Giỏ hàng \(1\)/ })).toBeInTheDocument()
  })

  it('applies only one promotion and reuses the checkout idempotency key on retry', async () => {
    // Đặt hàng yêu cầu đăng nhập (TASK-010 F-001/F-002).
    window.localStorage.setItem('ktht_auth_token', 'demo-token')
    window.localStorage.setItem('ktht_auth_user', JSON.stringify({ id: 7, email: 'an@example.com', fullName: 'Nguyễn An', role: 'Customer' }))
    let orderAttempts = 0
    const orderKeys: string[] = []
    const fetcher = setup('/products/binh-giu-nhiet', (url, init) => {
      if (url === '/api/promotions/validate') {
        const body = JSON.parse(String(init?.body))
        expect(body).toEqual({ code: 'PROMO10-01', items: [{ sku: 'B-1', quantity: 1 }] })
        return reply({ code: 'PROMO10-01', description: 'Giảm 10%', subtotal: 120000, discountAmount: 12000, totalAmount: 108000 })
      }
      if (url === '/api/orders') {
        orderAttempts += 1
        orderKeys.push((init?.headers as Record<string, string>)['Idempotency-Key'])
        expect(JSON.parse(String(init?.body)).promotionCode).toBe('PROMO10-01')
        return orderAttempts === 1 ? reply({ message: 'Lỗi tạm thời' }, 500) : reply({ message: 'OK', order: { id: 9, orderCode: 'ORD-9' } })
      }
      if (url === '/api/orders/ORD-9') return reply({ id: 9, orderCode: 'ORD-9', totalAmount: 108000, paymentMethod: 'COD', paymentStatus: 'Pending', shippingAddress: 'Địa chỉ demo' })
      return undefined
    })
    await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' }))
    act(() => navigate('/checkout'))
    fireEvent.change(screen.getByLabelText('Họ và tên người nhận'), { target: { value: 'Nguyễn An' } })
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } })
    fireEvent.change(screen.getByLabelText('Email nhận thông báo'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByLabelText(/Địa chỉ chi tiết/), { target: { value: '1 Nguyễn Huệ, TP.HCM' } })
    fireEvent.change(screen.getByLabelText('Mã khuyến mãi'), { target: { value: 'promo10-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText(/Đã áp dụng PROMO10-01/)).toBeInTheDocument()
    expect(screen.getByText(/108\.000/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('Mã khuyến mãi')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận Đặt hàng/ }))
    expect(await screen.findByText('Lỗi tạm thời')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận Đặt hàng/ }))
    await waitFor(() => expect(window.location.pathname).toBe('/checkout/result/ORD-9'))
    expect(orderKeys).toHaveLength(2)
    expect(orderKeys[0]).toBe(orderKeys[1])
    expect(fetcher).toHaveBeenCalledWith('/api/promotions/validate', expect.anything())
  })
})

describe('TASK-010 storefront transparency', () => {
  const deliveredOrder = {
    id: 21, orderCode: 'ORD-21', customerName: 'Nguyễn An', customerEmail: 'an@example.com', customerPhone: '0901234567',
    shippingAddress: '1 Nguyễn Huệ', paymentMethod: 'COD', paymentStatus: 'Paid', status: 'Delivered', totalAmount: 120000,
    createdAt: '2026-11-10T08:00:00Z',
    items: [{ id: 5, productId: 1, productName: 'Bình giữ nhiệt', variantName: '500 ml', sku: 'B-1', unitPrice: 120000, quantity: 1, lineTotal: 120000 }],
    timeline: [{ fromStatus: 'Shipped', toStatus: 'Delivered', actor: 'Kho', createdAt: '2026-11-11T08:00:00Z' }]
  }
  function login() {
    window.localStorage.setItem('ktht_auth_token', 'demo-token')
    window.localStorage.setItem('ktht_auth_user', JSON.stringify({ id: 7, email: 'an@example.com', fullName: 'Nguyễn An', role: 'Customer' }))
  }

  it('shows availability derived from the BE and blocks buying an out-of-stock SKU', async () => {
    setup('/products/binh-giu-nhiet?sku=B-2', url => url.startsWith('/api/products/')
      ? reply({ ...detail, variants: [detail.variants[0], { ...detail.variants[1], availability: 'OutOfStock' }] })
      : undefined)
    await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })
    expect(screen.getByText('Hết hàng')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Mua ngay' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Phiên bản'), { target: { value: 'B-1' } })
    expect(screen.getByText('Còn hàng')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ hàng' })).toBeEnabled()
  })

  it('cart shows the BE-confirmed price, not the cached one, and blocks checkout when stock is short', async () => {
    // Giá trong localStorage bị sửa thành 1đ: giao diện phải hiển thị giá BE trả về.
    window.localStorage.setItem('ktht_cart', JSON.stringify([{ sku: 'B-1', productId: 1, productName: 'Bình giữ nhiệt', variantName: '500 ml', imageUrl: null, price: 1, quantity: 3 }]))
    setup('/cart', (url, init) => url === '/api/cart/validate' ? validateReply(init, { 'B-1': 2 }) : undefined)
    expect(await screen.findByText('Chỉ còn 2 sản phẩm khả dụng.')).toBeInTheDocument()
    expect(screen.getAllByText(/360\.000/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Giá đã cập nhật theo hệ thống/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Tiến hành đặt hàng/ })).toBeDisabled()
    expect(screen.queryByRole('link', { name: /Tiến hành đặt hàng/ })).not.toBeInTheDocument()
  })

  it('order detail shows separate Vietnamese status rails and hides return when an RMA already exists', async () => {
    login()
    setup('/account/orders/ORD-21', url => url === '/api/orders/ORD-21'
      ? reply({ ...deliveredOrder, latestReturn: { returnCode: 'RMA-1', status: 'Requested', refundAmount: 120000, createdAt: '2026-11-12T08:00:00Z' } })
      : undefined)
    await screen.findByRole('heading', { name: /ORD-21/ })
    expect(screen.getAllByText('Đã giao').length).toBeGreaterThan(0)
    expect(screen.getByText('Đã thanh toán')).toBeInTheDocument()
    expect(screen.getByText('Chờ duyệt đổi trả')).toBeInTheDocument()
    expect(screen.queryByText('Delivered')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Yêu cầu trả hàng/ })).not.toBeInTheDocument()
  })

  it('return dialog states full-order scope, shows BE errors inline and closes with Escape', async () => {
    login()
    const alertSpy = vi.fn(); vi.stubGlobal('alert', alertSpy)
    setup('/account/orders/ORD-21', url => {
      if (url === '/api/orders/ORD-21') return reply({ ...deliveredOrder, latestReturn: null })
      if (url === '/api/me/returns') return reply({ message: 'Đơn hàng đã có yêu cầu đổi trả RMA-9.' }, 409)
      return undefined
    })
    fireEvent.click(await screen.findByRole('button', { name: /Yêu cầu trả hàng/ }))
    const dialog = screen.getByRole('dialog', { name: 'Yêu cầu trả hàng' })
    expect(dialog).toHaveTextContent('trả toàn bộ đơn')
    fireEvent.change(screen.getByLabelText('Lý do trả hàng'), { target: { value: 'Bao bì bị móp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }))
    expect(await screen.findByText('Đơn hàng đã có yêu cầu đổi trả RMA-9.')).toBeInTheDocument()
    expect(alertSpy).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not present fabricated licences or 24/7 claims and labels the demo', async () => {
    setup('/')
    await screen.findByRole('heading', { name: /Lựa chọn mỗi ngày/ })
    expect(document.body.textContent).not.toMatch(/chính hãng|GPP|CCHN|ĐKKD|24\/7/)
    expect(screen.getAllByText(/Bản demo môn KTHT/).length).toBeGreaterThan(0)
  })

  it('checkout requires login and keeps the cart', async () => {
    window.localStorage.setItem('ktht_cart', JSON.stringify([{ sku: 'B-1', productId: 1, productName: 'Bình giữ nhiệt', variantName: '500 ml', imageUrl: null, price: 120000, quantity: 1 }]))
    const fetcher = setup('/checkout')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập để đặt hàng' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xác nhận Đặt hàng/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Giỏ hàng \(1\)/ })).toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => url === '/api/orders')).toBe(false)
  })

  it('checkout surfaces a stock conflict from the BE and re-validates the cart', async () => {
    login()
    window.localStorage.setItem('ktht_cart', JSON.stringify([{ sku: 'B-1', productId: 1, productName: 'Bình giữ nhiệt', variantName: '500 ml', imageUrl: null, price: 120000, quantity: 1 }]))
    let validations = 0
    setup('/checkout', (url, init) => {
      if (url === '/api/cart/validate') { validations += 1; return validateReply(init, { 'B-1': validations > 1 ? 0 : 5 }) }
      if (url === '/api/orders') return reply({ message: "Sản phẩm 'Bình giữ nhiệt' không đủ số lượng tồn khả dụng." }, 409)
      return undefined
    })
    await screen.findByText(/Giá và tồn kho đã được hệ thống xác nhận/)
    fireEvent.change(screen.getByLabelText('Họ và tên người nhận'), { target: { value: 'Nguyễn An' } })
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } })
    fireEvent.change(screen.getByLabelText('Email nhận thông báo'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByLabelText(/Địa chỉ chi tiết/), { target: { value: '1 Nguyễn Huệ, TP.HCM' } })
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận Đặt hàng/ }))
    expect(await screen.findByText(/không đủ số lượng tồn khả dụng/)).toBeInTheDocument()
    expect(await screen.findByText('Chỉ còn 0 sản phẩm khả dụng.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Xác nhận Đặt hàng/ })).toBeDisabled()
    expect(window.location.pathname).toBe('/checkout')
  })

  it('order pages ask for login when logged out and explain foreign/missing orders', async () => {
    setup('/account/orders/ORD-21')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập để xem đơn hàng' })).toBeInTheDocument()
    cleanup()
    login()
    setup('/checkout/result/ORD-99', url => url === '/api/orders/ORD-99' ? reply({ message: 'Không tìm thấy đơn hàng.' }, 404) : undefined)
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy đơn hàng' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem đơn hàng của tôi' })).toBeInTheDocument()
  })

  it('cancel dialog explains the money outcome; result page lists next steps', async () => {
    login()
    setup('/account/orders/ORD-21', url => url === '/api/orders/ORD-21' ? reply({ ...deliveredOrder, status: 'Confirmed', paymentStatus: 'Pending', latestReturn: null }) : undefined)
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy đơn hàng' }))
    expect(screen.getByRole('dialog', { name: 'Hủy đơn hàng?' })).toHaveTextContent('không phát sinh phí')
    cleanup()
    setup('/checkout/result/ORD-21', url => url === '/api/orders/ORD-21' ? reply({ ...deliveredOrder, status: 'Pending', paymentStatus: 'Pending' }) : undefined)
    const steps = await screen.findByRole('region', { name: 'Tiếp theo' })
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3)
  })

  it('hides seed placeholder copy and labels product images as references', async () => {
    setup('/products/binh-giu-nhiet', url => url.startsWith('/api/products/')
      ? reply({ ...detail, imageUrl: '/img/b.png', category: { id: 9, name: 'Chưa phân loại', slug: 'chua-phan-loai' }, description: 'Mô tả ngắn theo tên sản phẩm. Chưa đối chiếu.' })
      : undefined)
    await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })
    expect(screen.queryByText(/Chưa đối chiếu/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Chưa phân loại/)).not.toBeInTheDocument()
    expect(screen.getByText(/Mô tả chi tiết đang cập nhật/)).toBeInTheDocument()
    expect(screen.getByText(/Ảnh tham khảo từ dữ liệu demo/)).toBeInTheDocument()
  })

  it('collapses filters behind a toggle and applies sort immediately', async () => {
    const fetcher = setup('/products?brand=x')
    await screen.findByText('13 sản phẩm phù hợp')
    const toggle = screen.getByRole('button', { name: 'Bộ lọc (1)' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByLabelText('Sắp xếp'), { target: { value: 'price-asc' } })
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('brand=x&sort=price-asc'), expect.anything()))
  })

  it('Enter in the voucher field applies the code and never places the order', async () => {
    login()
    window.localStorage.setItem('ktht_cart', JSON.stringify([{ sku: 'B-1', productId: 1, productName: 'Bình giữ nhiệt', variantName: '500 ml', imageUrl: null, price: 120000, quantity: 1 }]))
    const fetcher = setup('/checkout', url => url === '/api/promotions/validate'
      ? reply({ code: 'SALE10', description: 'Giảm 10%', discountAmount: 12000, subtotalAmount: 120000, totalAmount: 108000 })
      : undefined)
    await screen.findByText(/Giá và tồn kho đã được hệ thống xác nhận/)
    fireEvent.change(screen.getByLabelText('Họ và tên người nhận'), { target: { value: 'Nguyễn An' } })
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0901234567' } })
    fireEvent.change(screen.getByLabelText('Email nhận thông báo'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByLabelText(/Địa chỉ chi tiết/), { target: { value: '1 Nguyễn Huệ, TP.HCM' } })
    const voucher = screen.getByLabelText('Mã khuyến mãi')
    fireEvent.change(voucher, { target: { value: 'sale10' } })
    fireEvent.keyDown(voucher, { key: 'Enter' })
    expect(await screen.findByText(/Đã áp dụng SALE10/)).toBeInTheDocument()
    expect(fetcher.mock.calls.some(([url]) => url === '/api/orders')).toBe(false)
    expect(window.location.pathname).toBe('/checkout')
  })

  it('registering from the checkout login wall keeps the buyer on checkout', async () => {
    window.localStorage.setItem('ktht_cart', JSON.stringify([{ sku: 'B-1', productId: 1, productName: 'Bình giữ nhiệt', variantName: '500 ml', imageUrl: null, price: 120000, quantity: 1 }]))
    setup('/checkout', url => url === '/api/auth/register'
      ? reply({ token: 'demo-token', user: { id: 8, email: 'moi@example.com', fullName: 'Khách Mới', role: 'Customer' } })
      : undefined)
    const main = await screen.findByRole('main')
    fireEvent.click(await within(main).findByRole('button', { name: 'Tạo tài khoản' }))
    const dialog = screen.getByRole('dialog')
    for (const input of within(dialog).getAllByRole('textbox')) fireEvent.change(input, { target: { value: input.getAttribute('type') === 'email' ? 'moi@example.com' : input.getAttribute('type') === 'tel' ? '0901234567' : 'Khách Mới' } })
    const password = dialog.querySelector('input[type="password"]') as HTMLInputElement
    fireEvent.change(password, { target: { value: 'MatKhau@123' } })
    fireEvent.submit(password.form!)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(window.location.pathname).toBe('/checkout')
  })

  it('return rail shows the customer label with the business term underneath', async () => {
    login()
    setup('/account/orders/ORD-21', url => url === '/api/orders/ORD-21'
      ? reply({ ...deliveredOrder, latestReturn: { returnCode: 'RMA-ORD-21', status: 'Received', refundAmount: 120000, createdAt: '2026-11-12T08:00:00Z' } })
      : undefined)
    expect(await screen.findByText('Đã nhận hàng trả · Đang kiểm tra chất lượng')).toBeInTheDocument()
    expect(screen.getByText('Nghiệp vụ: nhập khu cách ly, chờ kiểm định')).toBeInTheDocument()
    expect(screen.queryByText(/Đang cách ly/)).not.toBeInTheDocument()
  })

  it('logged-out account page offers a login action', async () => {
    setup('/account/orders')
    const main = await screen.findByRole('main')
    fireEvent.click(await within(main).findByRole('button', { name: 'Đăng nhập' }))
    expect(screen.getByRole('dialog', { name: 'Đăng nhập V-Pharma' })).toBeInTheDocument()
  })
})
