import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import { ApiError, getJson, type Category, type Product, type ProductPage, type ProductDetail } from './products'
import './styles/catalog.css'

export function navigate(url: string) { window.history.pushState({}, '', url); window.dispatchEvent(new PopStateEvent('popstate')) }
function useLocation() {
  const [location, setLocation] = useState(window.location.pathname + window.location.search)
  useEffect(() => { const update = () => setLocation(window.location.pathname + window.location.search); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update) }, [])
  return location
}
function Link({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return <a className={className} href={href} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); navigate(href) } }}>{children}</a>
}
function useResource<T>(path: string) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ path: string; data?: T; error?: ApiError }>({ path })
  useEffect(() => {
    const controller = new AbortController()
    setState({ path })
    getJson<T>(path, controller.signal).then(data => { if (!controller.signal.aborted) setState({ path, data }) }).catch((error: ApiError) => { if (!controller.signal.aborted) setState({ path, error }) })
    return () => controller.abort()
  }, [path, attempt])
  return { ...(state.path === path ? state : { path }), retry: () => setAttempt(value => value + 1) }
}
export const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
export function LoadingState() { return <p className="shop-state" role="status">Đang tải dữ liệu…</p> }
export function EmptyState({ children = 'Không có sản phẩm phù hợp.' }: { children?: ReactNode }) { return <p className="shop-state">{children}</p> }
export function ErrorState({ retry }: { retry: () => void }) { return <div className="shop-state" role="alert"><p>Không thể tải dữ liệu. Vui lòng thử lại.</p><button onClick={retry}>Thử lại</button></div> }
export function SearchBar({ query }: { query: string }) {
  return <form className="shop-search" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); navigate('/products?' + new URLSearchParams({ q: String(data.get('q') || '') })) }}><label className="visually-hidden" htmlFor="global-search">Tìm sản phẩm</label><input key={query} id="global-search" name="q" type="search" defaultValue={query} maxLength={200} placeholder="Bạn đang tìm sản phẩm gì?" /><button type="submit">Tìm kiếm</button></form>
}
export function CategoryNavigation({ categories }: { categories: Category[] }) { return <nav className="shop-categories" aria-label="Danh mục sản phẩm"><Link href="/products">Tất cả sản phẩm</Link>{categories.map(category => <Link key={category.id} href={'/products?category=' + encodeURIComponent(category.slug)}>{category.name}</Link>)}</nav> }
export function CustomerLayout({ children, categories, query }: { children: ReactNode; categories: Category[]; query: string }) {
  return <div className="shop"><a className="shop-skip" href="#main-content">Đến nội dung</a><div className="shop-announcement">KTHT E-commerce · Cửa hàng demo</div><header className="shop-header shop-container"><Link href="/" className="shop-brand"><span aria-hidden="true">K</span>KTHT<span className="shop-brand-sub">E-commerce</span></Link><SearchBar query={query} /><div className="shop-account"><span>Tài khoản<small>Chưa triển khai</small></span><span>Giỏ hàng<small>Chưa triển khai</small></span></div></header><div className="shop-nav"><div className="shop-container"><CategoryNavigation categories={categories} /></div></div><main id="main-content" className="shop-container shop-main">{children}</main><footer className="shop-footer"><div className="shop-container"><strong>KTHT E-commerce</strong><p>Khám phá sản phẩm, lựa chọn phù hợp với bạn.</p><p>Dữ liệu phục vụ demo. Chức năng mua hàng đang được phát triển.</p><Link href="/products">Khám phá danh mục</Link><span>© 2026 KTHT E-commerce</span></div></footer></div>
}
export function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return src && !failed ? <img className="shop-product-image" src={src} alt={name} onError={() => setFailed(true)} /> : <div className="shop-image-placeholder" role="img" aria-label={'Chưa có ảnh: ' + name}><span aria-hidden="true">▧</span><small>Ảnh sản phẩm đang cập nhật</small></div>
}
export function ProductCard({ product }: { product: Product }) { return <article className="shop-product-card"><Link href={'/products/' + encodeURIComponent(product.slug)}><ProductImage src={product.imageUrl} name={product.name} /><div className="shop-card-content"><small>{product.category.name}</small><h3>{product.name}</h3><p>Từ <strong>{money(product.price)}</strong></p><span>Xem chi tiết →</span></div></Link></article> }
export function ProductGrid({ products }: { products: Product[] }) { return <div className="shop-product-grid">{products.map(product => <ProductCard key={product.id} product={product} />)}</div> }
function HomePage({ categories }: { categories: Category[] }) {
  const resource = useResource<ProductPage>('/products?featured=true&page=1&pageSize=4&sort=featured')
  return <><section className="shop-hero"><div><p className="shop-eyebrow">KHÁM PHÁ CÙNG KTHT</p><h1>Lựa chọn mỗi ngày,<br />dễ dàng hơn.</h1><p>Tìm sản phẩm theo nhu cầu, xem rõ thông tin và lựa chọn phiên bản phù hợp.</p><Link href="/products" className="shop-primary">Khám phá sản phẩm →</Link></div><div className="shop-hero-art" role="img" aria-label="Hình minh họa danh mục"><span>KTHT</span><small>Minh họa · Cửa hàng demo</small></div></section><section className="shop-section"><h2>Khám phá danh mục</h2>{categories.length ? <div className="shop-category-grid">{categories.map(category => <Link key={category.id} href={'/products?category=' + category.slug}><span aria-hidden="true">↗</span>{category.name}</Link>)}</div> : <EmptyState>Chưa có danh mục để hiển thị.</EmptyState>}</section><section className="shop-section"><div className="shop-section-heading"><h2>Sản phẩm nổi bật</h2><Link href="/products">Xem tất cả →</Link></div>{resource.error ? <ErrorState retry={resource.retry} /> : !resource.data ? <LoadingState /> : resource.data.items.length ? <ProductGrid products={resource.data.items} /> : <EmptyState />}</section></>
}
export function FilterBar({ params, categories }: { params: URLSearchParams; categories: Category[] }) {
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const next = new URLSearchParams()
    for (const key of ['q', 'category', 'sort', 'minPrice', 'maxPrice']) { const value = String(data.get(key) || '').trim(); if (value) next.set(key, value) }
    const minimum = next.get('minPrice'), maximum = next.get('maxPrice')
    if (minimum && maximum && Number(minimum) > Number(maximum)) { setError('Giá tối thiểu không được lớn hơn giá tối đa.'); return }
    setError(''); navigate('/products?' + next)
  }
  return <form className="shop-filters" onSubmit={submit}><label>Từ khóa<input name="q" type="search" defaultValue={params.get('q') || ''} maxLength={200} /></label><label>Danh mục<select name="category" defaultValue={params.get('category') || ''}><option value="">Tất cả danh mục</option>{params.get('category') && !categories.some(category => category.slug === params.get('category')) && <option value={params.get('category')!}>Danh mục không tồn tại</option>}{categories.map(category => <option key={category.id} value={category.slug}>{category.name}</option>)}</select></label><label>Giá từ (đ)<input name="minPrice" type="number" min="0" step="0.01" defaultValue={params.get('minPrice') || ''} /></label><label>Giá đến (đ)<input name="maxPrice" type="number" min="0" step="0.01" defaultValue={params.get('maxPrice') || ''} /></label><label>Sắp xếp<select name="sort" defaultValue={params.get('sort') || 'featured'}><option value="featured">Nổi bật</option><option value="name">Tên A–Z</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select></label><button type="submit">Áp dụng</button><Link href="/products">Xóa bộ lọc</Link>{error && <p role="alert">{error}</p>}</form>
}
export function Pagination({ data, params }: { data: ProductPage; params: URLSearchParams }) {
  function go(page: number) { const next = new URLSearchParams(params); next.set('page', String(page)); navigate('/products?' + next) }
  return <nav className="shop-pagination" aria-label="Phân trang sản phẩm"><button disabled={data.page <= 1} onClick={() => go(data.page - 1)}>Trang trước</button><span>Trang {data.page} / {Math.max(1, Math.ceil(data.totalCount / data.pageSize))}</span><button disabled={data.page * data.pageSize >= data.totalCount} onClick={() => go(data.page + 1)}>Trang sau</button></nav>
}
function ProductsPage({ params, categories }: { params: URLSearchParams; categories: Category[] }) {
  const query = new URLSearchParams(params); if (!query.has('page')) query.set('page', '1'); if (!query.has('pageSize')) query.set('pageSize', '12')
  const resource = useResource<ProductPage>('/products?' + query)
  return <><p className="shop-eyebrow">DANH MỤC KTHT</p><h1>Sản phẩm</h1><FilterBar key={params.toString()} params={params} categories={categories} />{resource.error ? <ErrorState retry={resource.retry} /> : !resource.data ? <LoadingState /> : <><p className="shop-result-count">{resource.data.totalCount} sản phẩm phù hợp</p>{resource.data.items.length ? <ProductGrid products={resource.data.items} /> : <EmptyState />}<Pagination data={resource.data} params={params} /></>}</>
}
function DetailPage({ slug, params }: { slug: string; params: URLSearchParams }) {
  const resource = useResource<ProductDetail>('/products/' + encodeURIComponent(slug))
  const [quantity, setQuantity] = useState('1')
  if (resource.error) return resource.error.status === 404 ? <NotFound /> : <ErrorState retry={resource.retry} />
  if (!resource.data) return <LoadingState />
  const product = resource.data, requested = params.get('sku')
  const selected = requested ? product.variants.find(variant => variant.sku === requested && variant.isActive) : product.variants.find(variant => variant.isActive)
  const validQuantity = /^\d+$/.test(quantity) && Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0
  return <><nav className="shop-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / <Link href="/products">Sản phẩm</Link> / <span>{product.name}</span></nav><article className="shop-detail"><ProductImage src={selected?.imageUrl || product.imageUrl} name={product.name} /><div><p className="shop-eyebrow">{product.category.name}</p><h1>{product.name}</h1>{selected && <p className="shop-detail-price">{money(selected.price)}</p>}<p className="shop-description">{product.description}</p><label className="shop-field">Phiên bản / SKU<select value={selected?.sku || ''} onChange={event => { const next = new URLSearchParams(params); next.set('sku', event.target.value); navigate('/products/' + encodeURIComponent(slug) + '?' + next) }}><option value="" disabled>Chọn phiên bản</option>{product.variants.filter(variant => variant.isActive).map(variant => <option key={variant.id} value={variant.sku}>{variant.name} · {variant.sku}</option>)}</select></label>{!selected && <p role="alert">{requested ? 'SKU không tồn tại hoặc không còn được niêm yết. Vui lòng chọn phiên bản khác.' : 'Chưa có phiên bản được niêm yết.'}</p>}{selected && <p>Mã SKU: <strong>{selected.sku}</strong></p>}<label className="shop-field">Số lượng<input aria-invalid={!validQuantity} aria-describedby={!validQuantity ? 'quantity-error' : undefined} type="number" min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>{!validQuantity && <p role="alert" id="quantity-error">Số lượng phải là số nguyên dương.</p>}<div className="shop-purchase-note">Giỏ hàng chưa triển khai. Bạn có thể xem sản phẩm và lựa chọn phiên bản; chưa thể đặt mua.</div></div></article></>
}
function NotFound() { return <section className="shop-state"><h1>404 · Không tìm thấy</h1><p>Trang hoặc sản phẩm này không tồn tại.</p><Link href="/products">Về danh sách sản phẩm</Link></section> }
export function AdminLayout() { return <div className="shop admin-shell"><aside><Link href="/" className="shop-brand">KTHT</Link><h2>Quản trị nội bộ</h2><nav aria-label="Module quản trị">{['Dashboard', 'Sản phẩm', 'Đơn hàng', 'Khách hàng', 'Kho', 'Kênh bán', 'Tích hợp', 'Vận chuyển', 'Hậu mãi', 'Thanh toán', 'Báo cáo', 'Nhân viên', 'Cấu hình', 'Mô phỏng'].map(module => <span key={module} aria-disabled="true">{module}<small>Chưa triển khai</small></span>)}</nav></aside><div><header>KTHT E-commerce · Khung quản trị</header><main><nav aria-label="Đường dẫn">Quản trị / Tổng quan</nav><h1>Khu vực quản trị</h1><p>Chức năng đăng nhập và phân quyền đang được xây dựng. Chưa có dữ liệu nghiệp vụ hoặc API quản trị tại đây.</p><Link href="/">Về cửa hàng</Link></main></div></div> }
export default function App() {
  const location = useLocation(), [path, search = ''] = location.split('?'), params = new URLSearchParams(search)
  const categories = useResource<Category[]>('/categories')
  if (path === '/admin') return <AdminLayout />
  const match = /^\/products\/([^/]+)$/.exec(path)
  let slug = ''; try { slug = match ? decodeURIComponent(match[1]) : '' } catch { /* Invalid encoding resolves to 404. */ }
  return <CustomerLayout categories={categories.data || []} query={params.get('q') || ''}>{categories.error && <ErrorState retry={categories.retry} />}{!categories.data && !categories.error && <LoadingState />}{path === '/' ? <HomePage categories={categories.data || []} /> : path === '/products' ? <ProductsPage params={params} categories={categories.data || []} /> : slug ? <DetailPage key={slug} slug={slug} params={params} /> : <NotFound />}</CustomerLayout>
}
