// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App, { navigate } from './App'

const category = { id: 1, name: 'Gia dụng', slug: 'gia-dung' }
const product = { id: 1, name: 'Bình giữ nhiệt', slug: 'binh-giu-nhiet', sku: 'B-1', price: 120000, imageUrl: null, category, isFeatured: true }
const detail = { ...product, description: 'Bình dùng hằng ngày.', variants: [{ id: 1, sku: 'B-1', name: '500 ml', price: 120000, imageUrl: null, isActive: true }, { id: 2, sku: 'B-2', name: '750 ml', price: 180000, imageUrl: null, isActive: true }] }
function reply(data: unknown, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data } as Response }
function setup(path: string, handle?: (url: string) => Response | undefined) {
  window.history.replaceState({}, '', path)
  const fetcher = vi.fn(async (input: string) => {
    const custom = handle?.(input); if (custom) return custom
    if (input === '/api/categories') return reply([category])
    if (input.startsWith('/api/products/')) return reply(detail)
    return reply({ items: [product], page: Number(new URL(input, 'http://localhost').searchParams.get('page') || 1), pageSize: 12, totalCount: 13 })
  })
  vi.stubGlobal('fetch', fetcher); render(<App />); return fetcher
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })
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
  })
})
