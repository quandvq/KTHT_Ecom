// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App, { navigate } from './App'

const category = { id: 1, name: 'Gia dụng', slug: 'gia-dung' }
const product = { id: 1, name: 'Bình giữ nhiệt', slug: 'binh-giu-nhiet', sku: 'B-1', price: 120000, imageUrl: null, category, isFeatured: true }
const detail = { ...product, description: 'Bình dùng hằng ngày.', variants: [{ id: 1, sku: 'B-1', name: '500 ml', price: 120000, imageUrl: null, isActive: true }, { id: 2, sku: 'B-2', name: '750 ml', price: 180000, imageUrl: null, isActive: true }] }
function reply(data: unknown, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data } as Response }
function setup(path: string, handle?: (url: string, init?: RequestInit) => Response | undefined) {
  window.history.replaceState({}, '', path)
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    const custom = handle?.(input, init); if (custom) return custom
    if (input === '/api/categories') return reply([category])
    if (input === '/api/me/orders') return reply([])
    if (input.startsWith('/api/products/')) return reply(detail)
    return reply({ items: [product], page: Number(new URL(input, 'http://localhost').searchParams.get('page') || 1), pageSize: 12, totalCount: 13 })
  })
  vi.stubGlobal('fetch', fetcher); render(<App />); return fetcher
}
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
    fireEvent.change(screen.getByLabelText('Phiên bản / SKU'), { target: { value: 'B-2' } })
    expect(screen.getByText(/180\.000/)).toBeInTheDocument(); expect(window.location.search).toBe('?sku=B-2')
    fireEvent.change(screen.getByLabelText('Số lượng'), { target: { value: '0' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Số lượng phải là số nguyên dương.')
    expect(screen.getByText(/Giỏ hàng chưa triển khai/)).toBeInTheDocument()
  })
  it('does not silently substitute unknown SKU', async () => {
    setup('/products/binh-giu-nhiet?sku=missing'); await screen.findByRole('heading', { name: 'Bình giữ nhiệt' })
    expect(screen.getByRole('alert')).toHaveTextContent('SKU không tồn tại')
    expect(screen.queryByText(/120\.000/)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Phiên bản / SKU'), { target: { value: 'B-1' } })
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
    expect(screen.getByRole('heading', { name: 'Khu vực quản trị' })).toBeInTheDocument()
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
