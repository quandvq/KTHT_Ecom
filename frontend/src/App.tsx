import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import {
  ApiError, getJson, postJson, putJson, safeStorageGet, safeStorageSet, safeStorageRemove,
  type Category, type Brand, type Product, type ProductPage, type ProductDetail,
  type User, type CartItem, type Order, type DashboardStats, type InventoryBalance,
  type ReturnRequest, type SupportTicket, type PromotionValidation,
  type ActiveFlashSaleResponse, type ChatMessage, type CartValidation
} from './products'
import {
  availabilityMeta, orderStatusMeta, paymentMethodLabel, paymentStatusMeta, returnStatusMeta,
  ticketCategories, ticketCategoryLabel, ticketStatusMeta, type StatusMeta
} from './status'
import './styles/catalog.css'

export function navigate(url: string) {
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function useLocation() {
  const [location, setLocation] = useState(window.location.pathname + window.location.search)
  useEffect(() => {
    const update = () => setLocation(window.location.pathname + window.location.search)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return location
}

export function Link({ href, children, className, style, onClick }: { href: string; children: ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <a
      className={className}
      style={style}
      href={href}
      onClick={event => {
        if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
          event.preventDefault()
          onClick?.()
          navigate(href)
        }
      }}
    >
      {children}
    </a>
  )
}

function useResource<T>(path: string) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ path: string; data?: T; error?: ApiError }>({ path })

  useEffect(() => {
    const handleAuthChange = () => setAttempt(v => v + 1)
    window.addEventListener('ktht_auth_change', handleAuthChange)
    return () => window.removeEventListener('ktht_auth_change', handleAuthChange)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setState({ path })
    getJson<T>(path, controller.signal)
      .then(data => { if (!controller.signal.aborted) setState({ path, data }) })
      .catch((error: ApiError) => { if (!controller.signal.aborted) setState({ path, error }) })
    return () => controller.abort()
  }, [path, attempt])
  return { ...(state.path === path ? state : { path }), retry: () => setAttempt(value => value + 1) }
}

export const money = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)

// Bộ icon SVG tự vẽ, nét 1.75px thống nhất (thay emoji làm icon).
const iconPaths = {
  phone: 'M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  mail: 'M4 6h16v12H4z M4 7l8 6 8-6',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  card: 'M3 6h18v12H3z M3 10h18 M7 15h4',
  chat: 'M4 5h16v11H9l-5 4z',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  close: 'M6 6l12 12 M18 6L6 18',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  check: 'M5 12.5l4.5 4.5L19 7',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v5 M12 8h.01',
  filter: 'M4 6h16 M7 12h10 M10 18h4',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7z M8.5 8.5l7 7'
} as const

export function Icon({ name, size = 18 }: { name: keyof typeof iconPaths; size?: number }) {
  return (
    <svg className="shop-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={iconPaths[name]} />
    </svg>
  )
}

// Nhãn cho khách ở trên, thuật ngữ nghiệp vụ (nếu có) ở dòng phụ để người chấm vẫn đối chiếu được.
function RailStatus({ meta }: { meta: StatusMeta }) {
  return <><StatusBadge meta={meta} />{meta.term && <small className="shop-rail-term">{meta.term}</small>}</>
}

export function StatusBadge({ meta }: { meta: StatusMeta }) {
  return <span className={`shop-badge badge-${meta.tone}`}>{meta.label}</span>
}

export function AvailabilityBadge({ value }: { value?: string | null }) {
  const meta = availabilityMeta(value)
  return meta ? <span className={`shop-stock shop-stock--${meta.tone}`}>{meta.label}</span> : null
}

// Hộp thoại dùng chung: role=dialog, aria-modal, Esc để đóng, giữ focus bên trong.
// Click ra nền KHÔNG đóng để tránh mất nội dung đang nhập.
export function Dialog({ title, onClose, children, busy = false }: { title: string; onClose: () => void; children: ReactNode; busy?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useRef(`dialog-${Math.random().toString(36).slice(2, 8)}`).current
  // Giữ callback/busy mới nhất trong ref để effect chỉ chạy một lần khi mở (không cướp focus khi gõ).
  const latest = useRef({ onClose, busy })
  latest.current = { onClose, busy }

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]') ?? [])
    const firstField = panel?.querySelector<HTMLElement>('input:not([disabled]), select:not([disabled]), textarea:not([disabled])')
    ;(firstField ?? focusables()[0])?.focus()

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !latest.current.busy) { event.preventDefault(); latest.current.onClose() }
      if (event.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    // Khi nút đang focus bị khóa (busy), focus rơi về body: kéo lại vào panel.
    function onFocusIn(event: FocusEvent) {
      if (panel && !panel.contains(event.target as Node)) panel.focus()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
      // Nút mở dialog có thể đã biến mất (ví dụ "Hủy đơn hàng" sau khi hủy): trả focus về tiêu đề trang.
      const fallback = document.querySelector<HTMLElement>('#main-content h1')
      if (previous?.isConnected) previous.focus()
      else if (fallback) { fallback.tabIndex = -1; fallback.focus() }
    }
  }, [])

  return (
    <div className="shop-modal-backdrop">
      <div className="shop-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
        <div className="shop-modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="shop-icon-button" onClick={onClose} disabled={busy} aria-label="Đóng"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function LoadingState() { return <p className="shop-state" role="status">Đang tải dữ liệu…</p> }
export function EmptyState({ children = 'Không có sản phẩm phù hợp.' }: { children?: ReactNode }) { return <p className="shop-state">{children}</p> }
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="shop-state" role="alert">
      <p>Không thể tải dữ liệu. Vui lòng thử lại.</p>
      <button onClick={retry}>Thử lại</button>
    </div>
  )
}

// ==========================================
// AUTH & CART HOOKS
// ==========================================
type AuthStore = {
  user: User | null
  saveAuth: (token: string, user: User) => void
  logout: () => void
  openAuth: (mode: 'login' | 'register') => void
  authModal: 'login' | 'register' | null
  closeAuth: () => void
}

type CartStore = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  updateQuantity: (sku: string, quantity: number) => void
  removeItem: (sku: string) => void
  clearCart: () => void
  totalCount: number
  totalAmount: number
}

const AuthContext = createContext<AuthStore | null>(null)
const CartContext = createContext<CartStore | null>(null)

function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = safeStorageGet('ktht_auth_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = safeStorageGet('ktht_cart')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })

  function saveAuth(token: string, userData: User) {
    safeStorageSet('ktht_auth_token', token)
    safeStorageSet('ktht_auth_user', JSON.stringify(userData))
    setUser(userData)
    window.dispatchEvent(new Event('ktht_auth_change'))
  }

  function logout() {
    safeStorageRemove('ktht_auth_token')
    safeStorageRemove('ktht_auth_user')
    setUser(null)
    window.dispatchEvent(new Event('ktht_auth_change'))
    navigate('/')
  }

  function persistItems(newItems: CartItem[]) {
    safeStorageSet('ktht_cart', JSON.stringify(newItems))
    return newItems
  }

  function addItem(item: CartItem) {
    setItems(current => persistItems(current.some(i => i.sku === item.sku)
      ? current.map(i => i.sku === item.sku ? { ...i, quantity: i.quantity + item.quantity } : i)
      : [...current, item]))
  }

  function updateQuantity(sku: string, quantity: number) {
    setItems(current => persistItems(quantity <= 0
      ? current.filter(i => i.sku !== sku)
      : current.map(i => i.sku === sku ? { ...i, quantity } : i)))
  }

  function removeItem(sku: string) {
    setItems(current => persistItems(current.filter(i => i.sku !== sku)))
  }

  function clearCart() {
    setItems(persistItems([]))
  }

  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0)
  // Chỉ là giá tham khảo lưu khi thêm vào giỏ; giỏ hàng và checkout hiển thị giá do BE xác nhận (useCartValidation).
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return <AuthContext.Provider value={{ user, saveAuth, logout, openAuth: setAuthModal, authModal, closeAuth: () => setAuthModal(null) }}>
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, totalCount, totalAmount }}>
      {children}
    </CartContext.Provider>
  </AuthContext.Provider>
}

// Giá, khuyến mãi flash sale và tồn khả dụng của giỏ luôn lấy từ BE (POST /api/cart/validate).
function useCartValidation() {
  const { items } = useCart()
  // Khóa phụ thuộc là JSON của các dòng đã sắp xếp: an toàn với SKU chứa ký tự đặc biệt (R-006).
  const lines = items.map(item => ({ sku: item.sku, quantity: item.quantity })).sort((a, b) => a.sku.localeCompare(b.sku))
  const signature = lines.length ? JSON.stringify(lines) : ''
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ signature: string; data?: CartValidation; error?: string }>({ signature })

  useEffect(() => {
    if (!signature) { setState({ signature }); return }
    let cancelled = false
    setState({ signature })
    postJson<CartValidation>('/cart/validate', { items: JSON.parse(signature) })
      .then(data => {
        if (cancelled) return
        if (!data || !Array.isArray(data.items)) throw new ApiError(500, 'Phản hồi kiểm tra giỏ hàng không hợp lệ.')
        setState({ signature, data })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ signature, error: error instanceof Error ? error.message : 'Không thể kiểm tra giỏ hàng.' })
      })
    return () => { cancelled = true }
  }, [signature, attempt])

  const fresh = state.signature === signature
  const lineFor = (sku: string) => (fresh ? state.data?.items.find(line => line.sku === sku) : undefined)
  return {
    data: fresh ? state.data : undefined,
    error: fresh ? state.error : undefined,
    checking: Boolean(signature) && (!fresh || (!state.data && !state.error)),
    lineFor,
    retry: () => setAttempt(value => value + 1)
  }
}

function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside StoreProvider')
  return context
}

function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used inside StoreProvider')
  return context
}

// ==========================================
// SHARED COMPONENTS
// ==========================================
export function SearchBar({ query }: { query: string }) {
  return (
    <form className="shop-search" onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      navigate('/products?' + new URLSearchParams({ q: String(data.get('q') || '') }))
    }}>
      <label className="visually-hidden" htmlFor="global-search">Tìm sản phẩm</label>
      <input key={query} id="global-search" name="q" type="search" defaultValue={query} maxLength={200} placeholder="Bạn đang tìm sản phẩm gì?" />
      <button type="submit">Tìm kiếm</button>
    </form>
  )
}

export function CategoryNavigation({ categories }: { categories: Category[] }) {
  return (
    <nav className="shop-categories" aria-label="Danh mục sản phẩm">
      <Link href="/products">Tất cả sản phẩm</Link>
      {categories.map(category => (
        <Link key={category.id} href={'/products?category=' + encodeURIComponent(category.slug)}>{category.name}</Link>
      ))}
    </nav>
  )
}

export function ModernFooter() {
  return (
    <footer className="shop-footer">
      <div className="shop-container">
        <div className="shop-footer-grid">
          <div className="shop-footer-col">
            <div className="shop-footer-brand">
              <span aria-hidden="true">V</span>
              <span>V-Pharma</span>
            </div>
            <p>Thuốc không kê đơn, vitamin và sản phẩm chăm sóc sức khỏe, đặt trực tuyến và theo dõi đơn trong tài khoản.</p>
          </div>

          <div className="shop-footer-col">
            <h3>Mua hàng &amp; hỗ trợ</h3>
            <ul className="shop-footer-links">
              <li><Link href="/products">Tất cả sản phẩm</Link></li>
              <li><Link href="/cart">Giỏ hàng</Link></li>
              <li><Link href="/account/orders">Tra cứu đơn hàng</Link></li>
              <li><Link href="/account/requests">Gửi yêu cầu hỗ trợ</Link></li>
            </ul>
          </div>

          <div className="shop-footer-col">
            <h3>Liên hệ (thông tin mô phỏng)</h3>
            <ul className="shop-footer-contact">
              <li><Icon name="phone" /><span>Hotline 1800 6828 · 8:00–21:30</span></li>
              <li><Icon name="mail" /><span>cskh@vpharma.vn</span></li>
            </ul>
          </div>
        </div>

        <div className="shop-footer-bottom">
          <p>© 2026 V-Pharma · Bản demo môn KTHT, thương hiệu và dữ liệu hư cấu.</p>
          <p>Thông tin sản phẩm chỉ để tham khảo, không thay thế tư vấn của bác sĩ hoặc dược sĩ.</p>
        </div>
      </div>
    </footer>
  )
}

export function CustomerChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Xin chào! Em là trợ lý tự động của V-Pharma (bản demo).\nEm có thể giúp tìm thuốc, vitamin, tra cứu đơn hàng theo mã ORD-… hoặc giải thích chính sách mô phỏng của cửa hàng.',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      suggestions: ['Tìm vitamin C', 'Flash Sale hôm nay', 'Chính sách đổi trả']
    }
  ])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await postJson<{ reply: string; suggestions?: string[]; products?: ChatMessage['products'] }>('/chat/customer', { message: text })
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        suggestions: res.suggestions,
        products: res.products
      }
      setMessages(prev => [...prev, botMsg])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: 'Chưa kết nối được trợ lý. Bạn thử gửi lại sau ít phút, hoặc gửi yêu cầu tại trang Hỗ trợ khách hàng.',
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {!isOpen && (
        <button
          className="shop-chatbot-toggle"
          onClick={() => setIsOpen(true)}
          aria-label="Mở Trợ lý V-Pharma"
        >
          <Icon name="chat" size={20} />
          <span className="shop-chatbot-toggle-label">Trợ lý V-Pharma</span>
        </button>
      )}

      {isOpen && (
        <div className="shop-chatbot-window" role="dialog" aria-label="Khung chat V-Pharma" onKeyDown={e => { if (e.key === 'Escape') setIsOpen(false) }}>
          <div className="shop-chatbot-header">
            <div className="shop-chatbot-header-info">
              <div className="shop-chatbot-avatar">V</div>
              <div>
                <div className="shop-chatbot-title">Trợ lý V-Pharma</div>
                <div className="shop-chatbot-subtitle">Trả lời tự động từ dữ liệu demo</div>
              </div>
            </div>
            <button className="shop-chatbot-close" onClick={() => setIsOpen(false)} aria-label="Đóng chat"><Icon name="close" /></button>
          </div>

          <div className="shop-chatbot-disclaimer">
            <Icon name="info" size={16} />
            <span>Chỉ cung cấp thông tin sản phẩm, không thay thế chẩn đoán hay tư vấn của bác sĩ, dược sĩ.</span>
          </div>

          <div className="shop-chatbot-body">
            {messages.map(msg => (
              <div key={msg.id} className={`chat-msg ${msg.sender === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`}>
                <div className="chat-bubble">{msg.text}</div>
                <span className="chat-time">{msg.timestamp}</span>

                {msg.products && msg.products.length > 0 && (
                  <div className="chat-products">
                    {msg.products.map(p => (
                      <Link
                        key={p.id}
                        href={`/products/${p.slug}`}
                        className="chat-product-item"
                        onClick={() => setIsOpen(false)}
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} />
                        ) : (
                          <div className="chat-product-placeholder"><Icon name="pill" /></div>
                        )}
                        <div className="chat-product-info">
                          <div className="chat-product-name">{p.name}</div>
                          <div className="chat-product-price">{money(p.price)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="chat-chips">
                    {msg.suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        className="chat-chip"
                        onClick={() => handleSend(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-msg chat-msg-bot">
                <div className="shop-chatbot-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="shop-chatbot-footer"
            onSubmit={e => {
              e.preventDefault()
              handleSend()
            }}
          >
            <input
              className="shop-chatbot-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Nhập câu hỏi hoặc tên thuốc..."
              maxLength={300}
            />
            <button
              type="submit"
              className="shop-chatbot-send"
              disabled={loading || !input.trim()}
              aria-label="Gửi tin nhắn"
            >
              <Icon name="send" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export function CustomerLayout({ children, categories, query }: { children: ReactNode; categories: Category[]; query: string }) {
  const { user, logout, openAuth, authModal, closeAuth } = useAuth()
  const { totalCount } = useCart()

  return (
    <div className="shop">
      <a className="shop-skip" href="#main-content">Đến nội dung</a>
      <div className="shop-announcement">
        <strong>Bản demo môn KTHT</strong> · Thương hiệu, sản phẩm và chính sách giao hàng là mô phỏng, không bán hàng thật.
      </div>
      <header className="shop-header shop-container">
        <Link href="/" className="shop-brand">
          <span aria-hidden="true">V</span>V-Pharma<span className="shop-brand-sub">Nhà thuốc trực tuyến</span>
        </Link>
        <SearchBar query={query} />
        <div className="shop-account">
          <Link href="/cart" className="shop-account-cart">
            Giỏ hàng ({totalCount})
            <small>Xem giỏ &amp; đặt hàng</small>
          </Link>
          {user ? (
            <div>
              <Link href="/account/orders" className="shop-account-name">
                <strong>{user.fullName}</strong>
              </Link>
              <small>
                {user.role !== 'Customer' && <><Link href="/admin">Quản trị ({user.role})</Link> · </>}
                <Link href="/account/orders">Đơn hàng</Link> · <Link href="/account/requests">Hỗ trợ</Link> · <button type="button" className="shop-text-button shop-text-button--danger" onClick={logout}>Đăng xuất</button>
              </small>
            </div>
          ) : (
            <div>
              <span>Tài khoản</span>
              <small>
                <button type="button" className="shop-text-button" onClick={() => openAuth('login')}>Đăng nhập</button>
                {' / '}
                <button type="button" className="shop-text-button" onClick={() => openAuth('register')}>Đăng ký</button>
              </small>
            </div>
          )}
        </div>
      </header>
      <div className="shop-nav">
        <div className="shop-container">
          <CategoryNavigation categories={categories} />
        </div>
      </div>
      <main id="main-content" className="shop-container shop-main">
        {children}
      </main>
      <ModernFooter />

      <CustomerChatbot />
      {authModal && <AuthModal mode={authModal} onClose={closeAuth} />}
    </div>
  )
}

// Trạng thái khi trang cần đăng nhập: luôn có lối đi tiếp.
function LoginRequired({ title, children }: { title: string; children: ReactNode }) {
  const { openAuth } = useAuth()
  return (
    <div className="shop-state">
      <h1>{title}</h1>
      <p>{children}</p>
      <div className="shop-state-actions">
        <button type="button" onClick={() => openAuth('login')}>Đăng nhập</button>
        <button type="button" className="btn-outline" onClick={() => openAuth('register')}>Tạo tài khoản</button>
      </div>
    </div>
  )
}

function AuthModal({ mode, onClose }: { mode: 'login' | 'register'; onClose: () => void }) {
  const { saveAuth } = useAuth()
  const [currentMode, setCurrentMode] = useState(mode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function stayOrGoToOrders() {
    if (window.location.pathname === '/' || window.location.pathname === '/account') navigate('/account/orders')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (currentMode === 'login') {
        const res = await postJson<{ token: string; user: User }>('/auth/login', { email, password })
        saveAuth(res.token, res.user)
        onClose()
        if (res.user.role !== 'Customer') navigate('/admin')
        else stayOrGoToOrders()
      } else {
        const res = await postJson<{ token: string; user: User }>('/auth/register', { email, password, fullName, phoneNumber: phone })
        saveAuth(res.token, res.user)
        onClose()
        // Đăng ký từ tường đăng nhập (checkout, đơn hàng) phải quay lại đúng bước đang làm (critique 3, P1).
        stayOrGoToOrders()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác không thành công.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog title={currentMode === 'login' ? 'Đăng nhập V-Pharma' : 'Đăng ký tài khoản mới'} onClose={onClose} busy={loading}>
      {error && <div className="shop-alert shop-alert--error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        {currentMode === 'register' && (
          <>
            <label className="shop-field">Họ và tên
              <input required autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
            </label>
            <label className="shop-field">Số điện thoại
              <input type="tel" inputMode="tel" autoComplete="tel" pattern="0[0-9]{9,10}" title="Số điện thoại 10–11 chữ số, bắt đầu bằng 0" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901234567" />
            </label>
          </>
        )}
        <label className="shop-field">Email
          <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
        </label>
        <label className="shop-field">Mật khẩu
          <input required type="password" minLength={currentMode === 'register' ? 6 : undefined} autoComplete={currentMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
        </label>
        <button type="submit" className="btn-modal-submit" disabled={loading}>
          {loading ? 'Đang xử lý…' : (currentMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản')}
        </button>
      </form>
      <p className="shop-modal-switch">
        {currentMode === 'login' ? (
          <>Chưa có tài khoản? <button type="button" className="shop-text-button shop-text-button--strong" onClick={() => { setCurrentMode('register'); setError('') }}>Đăng ký ngay</button></>
        ) : (
          <>Đã có tài khoản? <button type="button" className="shop-text-button shop-text-button--strong" onClick={() => { setCurrentMode('login'); setError('') }}>Đăng nhập</button></>
        )}
      </p>
    </Dialog>
  )
}

export function FlashSaleSection() {
  const resource = useResource<ActiveFlashSaleResponse>('/flash-sales/active')
  const { addItem } = useCart()
  const [secondsLeft, setSecondsLeft] = useState<number>(0)
  const [addedSku, setAddedSku] = useState<string | null>(null)

  useEffect(() => {
    if (resource.data?.campaign?.remainingSeconds) {
      setSecondsLeft(resource.data.campaign.remainingSeconds)
    }
  }, [resource.data])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setInterval(() => {
      setSecondsLeft(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [secondsLeft])

  if (!resource.data?.active || !resource.data.campaign || resource.data.campaign.items.length === 0) {
    return null
  }

  const campaign = resource.data.campaign
  const ended = secondsLeft <= 0
  const hours = Math.floor(secondsLeft / 3600)
  const minutes = Math.floor((secondsLeft % 3600) / 60)
  const seconds = secondsLeft % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  return (
    <section className="shop-flashsale-section" aria-labelledby="flashsale-title">
      <div className="shop-flashsale-header">
        <h2 className="shop-flashsale-title" id="flashsale-title">
          <Icon name="bolt" size={24} /> {campaign.name}
        </h2>
        {ended ? (
          <p className="shop-flashsale-countdown">Chương trình đã kết thúc</p>
        ) : (
          // Đọc cho trình đọc màn hình theo phút; các ô đếm giây chỉ để nhìn.
          <div className="shop-flashsale-countdown" role="timer" aria-label={`Kết thúc sau ${hours} giờ ${minutes} phút`}>
            <span aria-hidden="true">Kết thúc trong</span>
            <span className="shop-countdown-box" aria-hidden="true">{pad(hours)}</span>
            <span aria-hidden="true">:</span>
            <span className="shop-countdown-box" aria-hidden="true">{pad(minutes)}</span>
            <span aria-hidden="true">:</span>
            <span className="shop-countdown-box" aria-hidden="true">{pad(seconds)}</span>
          </div>
        )}
      </div>

      <div className="shop-product-grid">
        {campaign.items.slice(0, 4).map(item => {
          const percentSold = Math.min(100, Math.round((item.soldCount * 100) / Math.max(1, item.quantityLimit)))
          const soldOut = item.isSoldOut || item.remainingQuota <= 0
          const unavailable = soldOut || ended
          return (
            <article key={item.id} className="shop-product-card shop-flashsale-card">
              <span className="shop-flashsale-badge">-{item.discountPercentage}%</span>
              <Link href={`/products/${item.productSlug}`} className="shop-product-card__link">
                <ProductImage src={item.imageUrl} name={item.productName} />
                <div className="shop-card-content">
                  <small>{item.variantName || item.sku}</small>
                  <h3>{item.productName}</h3>
                  <div className="shop-flashsale-price">
                    <strong>{money(item.flashSalePrice)}</strong>
                    <s>{money(item.originalPrice)}</s>
                  </div>
                  <div className="shop-flashsale-progress" role="img" aria-label={`Đã bán ${item.soldCount} trên ${item.quantityLimit} suất`}>
                    <div className="shop-flashsale-progress-bar" style={{ width: `${percentSold}%` }} />
                    <span className="shop-flashsale-progress-text" aria-hidden="true">Đã bán {item.soldCount}/{item.quantityLimit}</span>
                  </div>
                </div>
              </Link>
              <div className="shop-flashsale-action">
                <button
                  type="button"
                  className="btn-danger"
                  disabled={unavailable}
                  onClick={() => {
                    // Giá lưu ở đây chỉ để hiển thị tạm; giỏ hàng/checkout luôn lấy giá do BE xác nhận.
                    addItem({
                      sku: item.sku,
                      productId: item.productId,
                      productName: item.productName,
                      variantName: item.variantName,
                      imageUrl: item.imageUrl,
                      price: item.flashSalePrice,
                      quantity: 1
                    })
                    setAddedSku(item.sku)
                    setTimeout(() => setAddedSku(null), 2000)
                  }}
                >
                  {soldOut ? 'Đã hết suất' : ended ? 'Đã kết thúc' : addedSku === item.sku ? 'Đã thêm vào giỏ' : 'Săn deal ngay'}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

// Dữ liệu seed còn chuỗi giữ chỗ: không hiển thị như thông tin thật (critique 2, P1).
export function isPlaceholderCategory(name?: string | null) {
  return !name || /^chưa phân loại$/i.test(name.trim())
}

export function isPlaceholderDescription(text?: string | null) {
  return !text || /chưa đối chiếu|^mô tả ngắn theo tên sản phẩm/i.test(text.trim())
}

function productMeta(brand: string | undefined, category: string) {
  return [brand, isPlaceholderCategory(category) ? '' : category].filter(Boolean).join(' · ')
}

// Ảnh seed lấy từ nguồn bên ngoài, có thể mang nhãn của nhà bán khác: luôn đặt trong khung trung tính
// và ghi rõ là ảnh tham khảo ở trang chi tiết.
export function ProductImage({ src, name, caption = false }: { src: string | null; name: string; caption?: boolean }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return src && !failed ? (
    <figure className="shop-product-figure">
      <img className="shop-product-image" src={src} alt={name} loading="lazy" onError={() => setFailed(true)} />
      {caption && <figcaption>Ảnh tham khảo từ dữ liệu demo, có thể mang nhãn của nhà bán khác. V-Pharma là thương hiệu hư cấu.</figcaption>}
    </figure>
  ) : (
    <div className="shop-image-placeholder" role="img" aria-label={'Chưa có ảnh: ' + name}>
      <Icon name="pill" size={28} />
      <small>Ảnh sản phẩm đang cập nhật</small>
    </div>
  )
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="shop-product-card">
      <Link href={'/products/' + encodeURIComponent(product.slug)} className="shop-product-card__link">
        <ProductImage src={product.imageUrl} name={product.name} />
        <div className="shop-card-content">
          <small>{productMeta(product.brand?.name, product.category.name) || '\u00a0'}</small>
          <h3>{product.name}</h3>
          <AvailabilityBadge value={product.availability} />
          <p>Từ <strong className="shop-price">{money(product.price)}</strong></p>
        </div>
      </Link>
    </article>
  )
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="shop-product-grid">
      {products.map(product => <ProductCard key={product.id} product={product} />)}
    </div>
  )
}

function HomePage({ categories }: { categories: Category[] }) {
  const resource = useResource<ProductPage>('/products?featured=true&page=1&pageSize=4&sort=featured')
  return (
    <>
      <section className="shop-hero">
        <div>
          <h1>Lựa chọn mỗi ngày,<br />dễ dàng hơn.</h1>
          <p>Thuốc không kê đơn, vitamin và sản phẩm chăm sóc sức khỏe. Giá và tình trạng còn hàng trên trang được lấy trực tiếp từ hệ thống kho.</p>
          <Link href="/products" className="shop-primary">Khám phá sản phẩm →</Link>
        </div>
        <ul className="shop-hero-facts" aria-label="Cách cửa hàng vận hành">
          <li><Icon name="check" /><span><strong>Giá do hệ thống tính</strong>Giỏ hàng và đơn hàng luôn được kiểm tra lại với giá hiện hành.</span></li>
          <li><Icon name="check" /><span><strong>Tồn kho được giữ khi đặt</strong>Đơn thành công giữ hàng ngay; hủy đơn sẽ trả lại số lượng đã giữ.</span></li>
          <li><Icon name="check" /><span><strong>Trạng thái rõ ràng</strong>Theo dõi riêng đơn hàng, thanh toán và đổi trả trong tài khoản.</span></li>
        </ul>
      </section>
      <FlashSaleSection />
      <section className="shop-section">
        <h2>Khám phá danh mục</h2>
        {categories.length ? (
          <div className="shop-category-grid">
            {categories.map(category => (
              <Link key={category.id} href={'/products?category=' + category.slug}>
                {category.name}<span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : <EmptyState>Chưa có danh mục để hiển thị.</EmptyState>}
      </section>
      <section className="shop-section">
        <div className="shop-section-heading">
          <h2>Sản phẩm nổi bật</h2>
          <Link href="/products">Xem tất cả →</Link>
        </div>
        {resource.error ? <ErrorState retry={resource.retry} /> : !resource.data ? <LoadingState /> : resource.data.items.length ? <ProductGrid products={resource.data.items} /> : <EmptyState />}
      </section>
    </>
  )
}

export function FilterBar({ params, categories }: { params: URLSearchParams; categories: Category[] }) {
  const brandsResource = useResource<Brand[]>('/brands')
  const [error, setError] = useState('')
  const paramsKey = params.toString()
  const [filters, setFilters] = useState(() => ({
    q: params.get('q') || '',
    category: params.get('category') || '',
    brand: params.get('brand') || '',
    sort: params.get('sort') || 'featured',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || ''
  }))

  useEffect(() => {
    const current = new URLSearchParams(paramsKey)
    setFilters(prev => ({
      q: current.get('q') || '',
      category: current.get('category') || '',
      brand: current.get('brand') || '',
      sort: current.get('sort') || prev.sort || 'featured',
      minPrice: current.get('minPrice') || '',
      maxPrice: current.get('maxPrice') || ''
    }))
  }, [paramsKey])

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    apply(filters)
  }

  function apply(current: typeof filters) {
    const next = new URLSearchParams()
    for (const key of ['q', 'category', 'brand', 'sort', 'minPrice', 'maxPrice']) {
      const value = (current[key as keyof typeof current] || '').trim()
      if (value) next.set(key, value)
    }
    const minimum = next.get('minPrice'), maximum = next.get('maxPrice')
    if ((minimum && Number(minimum) < 0) || (maximum && Number(maximum) < 0)) {
      setError('Giá lọc không được là số âm.')
      return
    }
    if (minimum && maximum && Number(minimum) > Number(maximum)) {
      setError('Giá tối thiểu không được lớn hơn giá tối đa.')
      return
    }
    setError('')
    navigate('/products?' + next)
  }

  const brands = Array.isArray(brandsResource.data) ? brandsResource.data : []
  // Trên màn hẹp bộ lọc thu gọn sau nút "Bộ lọc (n)"; sắp xếp luôn hiện và áp dụng ngay.
  const [open, setOpen] = useState(false)
  const activeCount = ['q', 'category', 'brand', 'minPrice', 'maxPrice'].filter(key => params.get(key)).length

  // Đổi sắp xếp áp dụng ngay cùng các tiêu chí đang nhập (cùng kiểm tra hợp lệ như nút "Áp dụng").
  function changeSort(value: string) {
    const next = { ...filters, sort: value }
    setFilters(next)
    apply(next)
  }

  return (
    <form id="product-filters" className="shop-filters" data-open={open || Boolean(error)} onSubmit={submit} aria-label="Bộ lọc sản phẩm">
      <button type="button" className="shop-filters__toggle btn-outline" aria-expanded={open} aria-controls="product-filters" onClick={() => setOpen(value => !value)}>
        <Icon name="filter" /> Bộ lọc{activeCount ? ` (${activeCount})` : ''}
      </button>
      <label className="shop-filters__search">Từ khóa
        <input name="q" type="search" value={filters.q} onChange={event => setFilters(current => ({ ...current, q: event.target.value }))} maxLength={200} placeholder="Tên sản phẩm, mã SKU…" />
      </label>
      <label>Danh mục
        <select name="category" value={filters.category} onChange={event => setFilters(current => ({ ...current, category: event.target.value }))}>
          <option value="">Tất cả danh mục</option>
          {params.get('category') && !categories.some(category => category.slug === params.get('category')) && (
            <option value={params.get('category')!}>Danh mục không tồn tại</option>
          )}
          {categories.map(category => (
            <option key={category.id} value={category.slug}>{category.name}</option>
          ))}
        </select>
      </label>
      <label>Thương hiệu
        <select name="brand" value={filters.brand} onChange={event => setFilters(current => ({ ...current, brand: event.target.value }))}>
          <option value="">Tất cả thương hiệu</option>
          {brands.map(brand => (
            <option key={brand.id} value={brand.slug}>{brand.name}</option>
          ))}
        </select>
      </label>
      <label>Giá từ (đ)
        <input name="minPrice" type="number" min="0" step="1" inputMode="numeric" value={filters.minPrice} onChange={event => setFilters(current => ({ ...current, minPrice: event.target.value }))} />
      </label>
      <label>Giá đến (đ)
        <input name="maxPrice" type="number" min="0" step="1" inputMode="numeric" value={filters.maxPrice} onChange={event => setFilters(current => ({ ...current, maxPrice: event.target.value }))} />
      </label>
      <label className="shop-filters__sort">Sắp xếp
        <select name="sort" value={filters.sort || params.get('sort') || 'featured'} onChange={event => changeSort(event.target.value)}>
          <option value="featured">Nổi bật</option>
          <option value="name">Tên A–Z</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
        </select>
      </label>
      <div className="shop-filters__actions">
        <button type="submit">Áp dụng</button>
        <Link href="/products" className="btn-outline">Xóa bộ lọc</Link>
      </div>
      {error && <p role="alert" className="shop-field-error shop-filters__error">{error}</p>}
    </form>
  )
}

export function Pagination({ data, params }: { data: ProductPage; params: URLSearchParams }) {
  function go(page: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(page))
    navigate('/products?' + next)
  }
  return (
    <nav className="shop-pagination" aria-label="Phân trang sản phẩm">
      <button disabled={data.page <= 1} onClick={() => go(data.page - 1)}>Trang trước</button>
      <span>Trang {data.page} / {Math.max(1, Math.ceil(data.totalCount / data.pageSize))}</span>
      <button disabled={data.page * data.pageSize >= data.totalCount} onClick={() => go(data.page + 1)}>Trang sau</button>
    </nav>
  )
}

function ProductsPage({ params, categories }: { params: URLSearchParams; categories: Category[] }) {
  const query = new URLSearchParams(params)
  if (!query.has('page')) query.set('page', '1')
  if (!query.has('pageSize')) query.set('pageSize', '12')
  const resource = useResource<ProductPage>('/products?' + query)

  return (
    <>
      <h1>Sản phẩm</h1>
      <FilterBar params={params} categories={categories} />
      {resource.error ? <ErrorState retry={resource.retry} /> : !resource.data ? <LoadingState /> : (
        <>
          <h2 className="shop-result-count">{resource.data.totalCount} sản phẩm phù hợp</h2>
          {resource.data.items.length ? <ProductGrid products={resource.data.items} /> : <EmptyState />}
          <Pagination data={resource.data} params={params} />
        </>
      )}
    </>
  )
}

function DetailPage({ slug, params }: { slug: string; params: URLSearchParams }) {
  const resource = useResource<ProductDetail>('/products/' + encodeURIComponent(slug))
  const [quantity, setQuantity] = useState('1')
  const [cartNotice, setCartNotice] = useState('')
  const { addItem } = useCart()

  if (resource.error) return resource.error.status === 404 ? <NotFound /> : <ErrorState retry={resource.retry} />
  if (!resource.data) return <LoadingState />

  const product = resource.data, requested = params.get('sku')
  const selected = requested
    ? product.variants.find(variant => variant.sku === requested && variant.isActive)
    : product.variants.find(variant => variant.isActive)

  const validQuantity = /^\d+$/.test(quantity) && Number.isSafeInteger(Number(quantity)) && Number(quantity) > 0
  const soldOut = selected?.availability === 'OutOfStock'
  const canBuy = Boolean(selected) && validQuantity && !soldOut

  function handleAddToCart() {
    if (!selected || !canBuy) return false
    addItem({
      sku: selected.sku,
      productId: product.id,
      productName: product.name,
      variantName: selected.name,
      imageUrl: selected.imageUrl || product.imageUrl,
      price: selected.price,
      quantity: Number(quantity)
    })
    setCartNotice(`Đã thêm ${quantity} sản phẩm vào giỏ hàng.`)
    setTimeout(() => setCartNotice(''), 4000)
    return true
  }

  return (
    <>
      <nav className="shop-breadcrumb" aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link> / <Link href="/products">Sản phẩm</Link> / <span>{product.name}</span>
      </nav>
      <article className="shop-detail">
        <ProductImage src={selected?.imageUrl || product.imageUrl} name={product.name} caption />
        <div>
          <h1>{product.name}</h1>
          {productMeta(product.brand?.name, product.category.name) && (
            <p className="shop-detail-meta">{productMeta(product.brand?.name, product.category.name)}</p>
          )}
          {selected && (
            <div className="shop-detail-pricing">
              <p className="shop-detail-price">{money(selected.price)}</p>
              <AvailabilityBadge value={selected.availability} />
            </div>
          )}
          {isPlaceholderDescription(product.description)
            ? <p className="shop-description shop-muted">Mô tả chi tiết đang cập nhật (dữ liệu demo). Hỏi dược sĩ trước khi dùng.</p>
            : <p className="shop-description">{product.description}</p>}
          {product.packageSize && <p>Quy cách đóng gói: <strong>{product.packageSize}</strong></p>}
          {product.saleUnit && <p>Đơn vị bán: <strong>{product.saleUnit}</strong></p>}

          <label className="shop-field">Phiên bản
            <select
              value={selected?.sku || ''}
              onChange={event => {
                const next = new URLSearchParams(params)
                next.set('sku', event.target.value)
                navigate('/products/' + encodeURIComponent(slug) + '?' + next)
              }}
            >
              <option value="" disabled>Chọn phiên bản</option>
              {product.variants.filter(variant => variant.isActive).map(variant => (
                <option key={variant.id} value={variant.sku}>
                  {variant.name}{variant.availability === 'OutOfStock' ? ' (hết hàng)' : ''}
                </option>
              ))}
            </select>
          </label>

          {!selected && <p role="alert" className="shop-field-error">{requested ? 'SKU không tồn tại hoặc không còn được niêm yết. Vui lòng chọn phiên bản khác.' : 'Chưa có phiên bản được niêm yết.'}</p>}
          {selected && <p className="shop-detail-sku">Mã SKU: {selected.sku}</p>}

          <label className="shop-field">Số lượng
            <input
              aria-invalid={!validQuantity}
              aria-describedby={!validQuantity ? 'quantity-error' : undefined}
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
            />
          </label>
          {!validQuantity && <p role="alert" id="quantity-error" className="shop-field-error">Số lượng phải là số nguyên dương.</p>}
          {soldOut && <p role="status" className="shop-field-error">Phiên bản này đã hết hàng khả dụng. Vui lòng chọn phiên bản khác hoặc quay lại sau.</p>}

          <div className="shop-detail-actions">
            {selected && (
              <button type="button" disabled={!canBuy} onClick={() => { if (handleAddToCart()) navigate('/cart') }}>
                Mua ngay
              </button>
            )}
            <button type="button" className="btn-outline" disabled={!canBuy} onClick={handleAddToCart}>
              Thêm vào giỏ hàng
            </button>
          </div>

          {cartNotice && (
            <div className="shop-alert shop-alert--success" role="status">
              <Icon name="check" /> {cartNotice} <Link href="/cart">Đến giỏ hàng →</Link>
            </div>
          )}

          <div className="shop-purchase-note">
            <Icon name="info" />
            <p>
              Thông tin sản phẩm chỉ để tham khảo, không thay thế chẩn đoán hay chỉ định của bác sĩ, dược sĩ. Đọc kỹ hướng dẫn sử dụng trước khi dùng.
              Đây là cửa hàng demo: đơn hàng giữ tồn kho thật trong hệ thống nhưng không giao hàng hay thu tiền thật.
            </p>
          </div>
        </div>
      </article>
    </>
  )
}

// Thông báo khi giỏ hàng chưa được BE xác nhận.
function CartValidationNotice({ validation }: { validation: ReturnType<typeof useCartValidation> }) {
  if (validation.error) {
    return (
      <div className="shop-alert shop-alert--error" role="alert">
        Chưa kiểm tra được giá và tồn kho: {validation.error} <button type="button" className="shop-text-button shop-text-button--strong" onClick={validation.retry}>Thử lại</button>
      </div>
    )
  }
  if (validation.checking) return <p className="shop-validation-status" role="status">Đang kiểm tra giá và tồn kho với hệ thống…</p>
  if (validation.data && !validation.data.allValid) {
    return <div className="shop-alert shop-alert--error" role="alert">Một số sản phẩm không đủ hàng hoặc đã ngừng bán. Vui lòng điều chỉnh các dòng được đánh dấu.</div>
  }
  return <p className="shop-validation-status shop-validation-status--ok" role="status"><Icon name="check" size={16} /> Giá và tồn kho đã được hệ thống xác nhận.</p>
}

// ==========================================
// C04: SHOPPING CART PAGE
// ==========================================
function CartPage() {
  const { items, updateQuantity, removeItem, totalCount } = useCart()
  const validation = useCartValidation()

  if (items.length === 0) {
    return (
      <div className="shop-state">
        <h1>Giỏ hàng của bạn đang trống</h1>
        <p>Hãy khám phá các sản phẩm dược phẩm và chăm sóc sức khỏe để đặt hàng.</p>
        <Link href="/products" className="shop-primary">Tiếp tục mua sắm →</Link>
      </div>
    )
  }

  const confirmedTotal = validation.data?.totalAmount
  const canCheckout = Boolean(validation.data?.allValid)

  return (
    <>
      <nav className="shop-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / <span>Giỏ hàng</span></nav>
      <h1>Giỏ hàng của bạn</h1>
      <CartValidationNotice validation={validation} />
      <div className="shop-cart-grid">
        <div className="shop-cart-items">
          {items.map(item => {
            const line = validation.lineFor(item.sku)
            const unitPrice = line?.price ?? item.price
            const maxQuantity = line?.availableStock
            const atLimit = maxQuantity !== undefined && item.quantity >= maxQuantity
            return (
              <div key={item.sku} className={`shop-cart-line${line && !line.isValid ? ' is-invalid' : ''}`}>
                {item.imageUrl
                  ? <img className="shop-cart-thumb" src={item.imageUrl} alt="" />
                  : <div className="shop-cart-thumb" aria-hidden="true"><Icon name="pill" /></div>}
                <div className="shop-cart-line__info">
                  <strong>{item.productName}</strong>
                  <small>{item.variantName} · SKU {item.sku}</small>
                  <span className="shop-price">
                    {line ? money(unitPrice) : 'Đang xác nhận giá…'}
                    {line?.isFlashSale && <span className="shop-tag-flash">Giá flash sale</span>}
                  </span>
                  {line && line.price !== undefined && line.price !== item.price && (
                    <small className="shop-cart-line__note">Giá đã cập nhật theo hệ thống (trước đó {money(item.price)}).</small>
                  )}
                  {line && !line.isValid && <small className="shop-field-error" role="alert">{line.errorMessage || 'Sản phẩm không còn khả dụng.'}</small>}
                </div>
                <div className="shop-qty" role="group" aria-label={`Số lượng ${item.productName}`}>
                  <button type="button" className="btn-outline btn-sm" onClick={() => updateQuantity(item.sku, item.quantity - 1)} aria-label="Giảm số lượng">−</button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button type="button" className="btn-outline btn-sm" disabled={atLimit || validation.checking} onClick={() => updateQuantity(item.sku, item.quantity + 1)} aria-label="Tăng số lượng">+</button>
                </div>
                <div className="shop-cart-line__total">
                  <strong>{line?.lineTotal !== undefined ? money(line.lineTotal) : '—'}</strong>
                  <button type="button" className="shop-text-button shop-text-button--danger" onClick={() => removeItem(item.sku)}>Xóa</button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="shop-cart-summary">
          <h2>Tóm tắt đơn hàng</h2>
          <dl className="shop-summary">
            <div><dt>Tạm tính ({totalCount} sản phẩm)</dt><dd>{confirmedTotal !== undefined ? money(confirmedTotal) : '—'}</dd></div>
            <div><dt>Phí vận chuyển</dt><dd>Miễn phí (mô phỏng)</dd></div>
            <div className="shop-summary__total"><dt>Tổng cộng</dt><dd>{confirmedTotal !== undefined ? money(confirmedTotal) : '—'}</dd></div>
          </dl>
          {canCheckout ? (
            <Link href="/checkout" className="shop-primary shop-block-action">Tiến hành đặt hàng →</Link>
          ) : (
            <button type="button" className="shop-block-action" disabled>Tiến hành đặt hàng →</button>
          )}
          <small className="shop-summary__hint">Mã khuyến mãi được áp dụng ở bước đặt hàng.</small>
        </div>
      </div>
    </>
  )
}

// ==========================================
// C05: CHECKOUT PAGE
// ==========================================
function CheckoutPage() {
  const { items, totalCount, clearCart } = useCart()
  const { user } = useAuth()
  const validation = useCartValidation()
  const [customerName, setCustomerName] = useState(user?.fullName || '')
  const [customerPhone, setCustomerPhone] = useState(user?.phoneNumber || '')
  const [customerEmail, setCustomerEmail] = useState(user?.email || '')
  const [shippingAddress, setShippingAddress] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('COD')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [promotionInput, setPromotionInput] = useState('')
  const [promotion, setPromotion] = useState<PromotionValidation | null>(null)
  const [promotionError, setPromotionError] = useState('')
  const [promotionLoading, setPromotionLoading] = useState(false)
  const cartSignature = items.map(item => `${item.sku}:${item.quantity}`).sort().join('|')
  const idempotencyKey = useRef(`IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    setPromotion(null)
    setPromotionError('')
    idempotencyKey.current = `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }, [cartSignature])

  // Fetch saved default address
  useEffect(() => {
    if (user) {
      getJson<{ address?: { recipientName: string; phoneNumber: string; streetAddress: string; city: string } }>('/auth/me')
        .then(res => {
          if (res.address) {
            setCustomerName(res.address.recipientName || user.fullName)
            setCustomerPhone(res.address.phoneNumber || user.phoneNumber || '')
            setShippingAddress(`${res.address.streetAddress}, ${res.address.city}`)
          }
        })
        .catch(() => {})
    }
  }, [user])

  async function applyPromotion() {
    const code = promotionInput.trim().toUpperCase()
    if (!code) {
      setPromotionError('Vui lòng nhập mã khuyến mãi.')
      return
    }
    setPromotionLoading(true)
    setPromotionError('')
    try {
      const result = await postJson<PromotionValidation>('/promotions/validate', {
        code,
        items: items.map(item => ({ sku: item.sku, quantity: item.quantity }))
      })
      setPromotion(result)
      setPromotionInput(result.code)
    } catch (err) {
      setPromotion(null)
      setPromotionError(err instanceof Error ? err.message : 'Mã khuyến mãi không hợp lệ.')
    } finally {
      setPromotionLoading(false)
    }
  }

  function removePromotion() {
    setPromotion(null)
    setPromotionInput('')
    setPromotionError('')
  }

  if (!user) {
    return <LoginRequired title="Đăng nhập để đặt hàng">Đơn hàng được gắn với tài khoản để chỉ bạn xem và hủy được đơn của mình. Giỏ hàng vẫn được giữ nguyên.</LoginRequired>
  }

  if (items.length === 0) {
    return (
      <div className="shop-state">
        <h1>Không có sản phẩm để thanh toán</h1>
        <Link href="/products" className="shop-primary">Quay lại mua sắm</Link>
      </div>
    )
  }

  const subtotal = promotion?.subtotal ?? validation.data?.totalAmount
  const total = promotion?.totalAmount ?? validation.data?.totalAmount
  const canSubmit = Boolean(validation.data?.allValid) && !submitting

  async function handlePlaceOrder(e: FormEvent) {
    e.preventDefault()
    if (!validation.data?.allValid) return
    setError('')
    setSubmitting(true)

    try {
      const res = await postJson<{ message: string; order: { id: number; orderCode: string } }>('/orders', {
        customerName,
        customerPhone,
        customerEmail,
        shippingAddress,
        paymentMethod,
        note,
        promotionCode: promotion?.code,
        items: items.map(i => ({ sku: i.sku, quantity: i.quantity }))
      }, idempotencyKey.current)

      clearCart()
      navigate(`/checkout/result/${res.order.orderCode}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Đặt hàng không thành công. Vui lòng kiểm tra lại.'
      if (err instanceof ApiError && err.status === 409) {
        // Tồn kho thay đổi giữa lúc kiểm tra và lúc đặt: kiểm tra lại để đánh dấu dòng thiếu hàng.
        setError(`${message} Giỏ hàng đã được kiểm tra lại với tồn kho hiện tại.`)
        validation.retry()
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <nav className="shop-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / <Link href="/cart">Giỏ hàng</Link> / <span>Đặt hàng</span></nav>
      <h1>Thông tin giao nhận &amp; thanh toán</h1>
      {error && <div className="shop-alert shop-alert--error" role="alert">{error}</div>}

      <form onSubmit={handlePlaceOrder} className="shop-checkout-grid">
        <div className="shop-checkout-card">
          <h2><Icon name="pin" /> Địa chỉ nhận hàng</h2>
          <div className="shop-form-stack">
            <label className="shop-checkout-field">Họ và tên người nhận
              <input required autoComplete="name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nguyễn Văn A" />
            </label>
            <div className="shop-form-row">
              <label className="shop-checkout-field">Số điện thoại
                <input required type="tel" inputMode="tel" autoComplete="tel" pattern="0[0-9]{9,10}" title="Số điện thoại 10–11 chữ số, bắt đầu bằng 0" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0901234567" />
              </label>
              <label className="shop-checkout-field">Email nhận thông báo
                <input required type="email" autoComplete="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@example.com" />
              </label>
            </div>
            <label className="shop-checkout-field">Địa chỉ chi tiết (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành)
              <input required autoComplete="street-address" value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Số nhà, tên đường, phường/xã, tỉnh/thành" />
            </label>
            <label className="shop-checkout-field">Ghi chú giao hàng (Tùy chọn)
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Giao giờ hành chính, gọi trước khi giao..." />
            </label>
          </div>

          <h2 className="shop-checkout-card__section"><Icon name="card" /> Phương thức thanh toán</h2>
          <div className="shop-payment-options">
            <label className={`shop-payment-option ${paymentMethod === 'COD' ? 'active' : ''}`}>
              <input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} />
              <div>
                <strong>Thanh toán tiền mặt khi nhận hàng (COD)</strong>
                <small>Đơn được ghi nhận là chưa thanh toán cho tới khi giao thành công.</small>
              </div>
            </label>
            <label className={`shop-payment-option ${paymentMethod === 'BankTransfer' ? 'active' : ''}`}>
              <input type="radio" name="paymentMethod" value="BankTransfer" checked={paymentMethod === 'BankTransfer'} onChange={() => setPaymentMethod('BankTransfer')} />
              <div>
                <strong>Chuyển khoản ngân hàng (mô phỏng)</strong>
                <small>Bản demo không kết nối cổng thanh toán: không có mã QR và không trừ tiền thật.</small>
              </div>
            </label>
          </div>
        </div>

        <div className="shop-checkout-summary">
          <h2>Đơn hàng ({totalCount} sản phẩm)</h2>
          <CartValidationNotice validation={validation} />
          <ul className="shop-checkout-lines">
            {items.map(i => {
              const line = validation.lineFor(i.sku)
              return (
                <li key={i.sku} className={line && !line.isValid ? 'is-invalid' : undefined}>
                  <span>{i.productName} <small>× {i.quantity}</small>
                    {line && !line.isValid && <small className="shop-field-error">{line.errorMessage}</small>}
                  </span>
                  <strong>{line?.lineTotal !== undefined ? money(line.lineTotal) : '—'}</strong>
                </li>
              )
            })}
          </ul>
          <div className="shop-promo">
            <label htmlFor="promotion-code">Mã khuyến mãi</label>
            <div className="shop-promo__row">
              <input
                id="promotion-code"
                value={promotionInput}
                onChange={event => { setPromotionInput(event.target.value.toUpperCase()); if (promotion) setPromotion(null) }}
                onKeyDown={event => {
                  // Ô mã nằm trong form đặt hàng: Enter chỉ áp dụng mã, không bao giờ đặt đơn (critique 3, P1).
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (!promotion && !promotionLoading) void applyPromotion()
                }}
                disabled={promotionLoading}
                maxLength={50}
                placeholder="Nhập một mã"
              />
              {promotion ? (
                <button type="button" className="btn-outline" onClick={removePromotion}>Bỏ mã</button>
              ) : (
                <button type="button" onClick={applyPromotion} disabled={promotionLoading || !promotionInput.trim()}>
                  {promotionLoading ? 'Đang kiểm tra…' : 'Áp dụng'}
                </button>
              )}
            </div>
            {promotionError && <p role="alert" className="shop-field-error">{promotionError}</p>}
            {promotion && <p role="status" className="shop-promo__ok">Đã áp dụng {promotion.code}: {promotion.description}</p>}
            <small>Mỗi đơn hàng chỉ áp dụng một mã. Mã sẽ được kiểm tra lại khi đặt hàng.</small>
          </div>
          <dl className="shop-summary">
            <div><dt>Tạm tính</dt><dd>{subtotal !== undefined ? money(subtotal) : '—'}</dd></div>
            {promotion && (
              <div className="shop-summary__discount"><dt>Giảm giá ({promotion.code})</dt><dd>−{money(promotion.discountAmount)}</dd></div>
            )}
            <div><dt>Phí vận chuyển</dt><dd>Miễn phí (mô phỏng)</dd></div>
            <div className="shop-summary__total"><dt>Tổng tiền</dt><dd>{total !== undefined ? money(total) : '—'}</dd></div>
          </dl>
          <button type="submit" disabled={!canSubmit} className="shop-block-action">
            {submitting ? 'Đang tạo đơn & giữ tồn kho…' : 'Xác nhận Đặt hàng →'}
          </button>
          <small className="shop-summary__hint">Khi đặt thành công, hệ thống giữ số lượng tồn kho cho đơn của bạn ngay lập tức.</small>
        </div>
      </form>
    </>
  )
}

// ==========================================
// C06: ORDER RESULT PAGE
// ==========================================
// Đơn chỉ chủ đơn/nhân viên xem được (TASK-010 F-001): 401 → đăng nhập; 403/404 → không có trong tài khoản.
function OrderAccessError({ status, retry }: { status: number; retry: () => void }) {
  if (status === 401) return <LoginRequired title="Đăng nhập để xem đơn hàng">Đơn hàng chỉ hiển thị cho tài khoản đã đặt đơn.</LoginRequired>
  if (status === 403 || status === 404) {
    return (
      <section className="shop-state">
        <h1>Không tìm thấy đơn hàng</h1>
        <p>Đơn này không tồn tại hoặc không thuộc tài khoản đang đăng nhập.</p>
        <Link href="/account/orders">Xem đơn hàng của tôi</Link>
      </section>
    )
  }
  return <ErrorState retry={retry} />
}

function OrderResultPage({ orderCode }: { orderCode: string }) {
  const { user } = useAuth()
  const resource = useResource<Order>(`/orders/${orderCode}`)
  if (!user) return <OrderAccessError status={401} retry={resource.retry} />

  if (resource.error) return <OrderAccessError status={resource.error.status} retry={resource.retry} />
  if (!resource.data) return <LoadingState />

  const order = resource.data
  return (
    <div className="shop-result">
      <div className="shop-result__mark" aria-hidden="true"><Icon name="check" size={34} /></div>
      <h1>Đặt hàng thành công</h1>
      <p>Hệ thống đã ghi nhận đơn và giữ tồn kho cho các sản phẩm. Mã đơn hàng của bạn:</p>
      <div className="shop-result__code">{order.orderCode}</div>
      <dl className="shop-summary shop-result__summary">
        <div><dt>Tổng thanh toán</dt><dd>{money(order.totalAmount)}</dd></div>
        <div><dt>Phương thức</dt><dd>{paymentMethodLabel(order.paymentMethod)}</dd></div>
        <div><dt>Thanh toán</dt><dd><StatusBadge meta={paymentStatusMeta(order.paymentStatus)} /></dd></div>
      </dl>
      {order.paymentMethod === 'BankTransfer' && (
        <p className="shop-result__note">Đây là thanh toán mô phỏng: bản demo không tạo mã QR và không thu tiền. Trạng thái thanh toán chỉ thay đổi khi nhân viên cập nhật trong hệ thống.</p>
      )}
      <p className="shop-result__address">Địa chỉ giao hàng: {order.shippingAddress}</p>
      <section className="shop-next-steps" aria-labelledby="next-steps-title">
        <h2 id="next-steps-title">Tiếp theo</h2>
        <ol>
          <li><strong>Xác nhận đơn</strong><span>Nhân viên kiểm tra và xác nhận. Bạn vẫn hủy được đơn cho tới khi kho xuất hàng.</span></li>
          <li><strong>Xuất kho &amp; giao</strong><span>Kho xuất hàng đã giữ cho đơn; trạng thái cập nhật trong trang chi tiết.</span></li>
          <li><strong>Xác nhận thanh toán</strong><span>{order.paymentMethod === 'COD' ? 'Bạn trả tiền khi nhận hàng; cửa hàng xác nhận khoản thu sau khi giao (đối soát).' : 'Cửa hàng xác nhận khoản chuyển khoản (đối soát); bản demo không thu tiền thật.'}</span></li>
        </ol>
      </section>
      <div className="shop-result__actions">
        <Link href={`/account/orders/${order.orderCode}`} className="shop-primary">Xem chi tiết đơn hàng</Link>
        <Link href="/products" className="btn-outline">Tiếp tục mua sắm</Link>
      </div>
    </div>
  )
}

// ==========================================
// C10: CUSTOMER ORDERS LIST
// ==========================================
function AccountOrdersPage() {
  const { user } = useAuth()
  const resource = useResource<Order[]>('/me/orders')

  if (!user) {
    return <LoginRequired title="Vui lòng đăng nhập">Bạn cần đăng nhập để theo dõi danh sách đơn hàng của mình.</LoginRequired>
  }

  if (resource.error) return <ErrorState retry={resource.retry} />
  if (!resource.data) return <LoadingState />

  const rawOrders = resource.data
  const orders: Order[] = Array.isArray(rawOrders) ? rawOrders : (Array.isArray((rawOrders as { items?: Order[] })?.items) ? (rawOrders as { items: Order[] }).items : [])
  return (
    <>
      <nav className="shop-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / <span>Đơn hàng của tôi</span></nav>
      <div className="shop-page-heading">
        <h1>Lịch sử đơn hàng</h1>
        <Link href="/account/requests">Yêu cầu hỗ trợ →</Link>
      </div>
      {orders.length === 0 ? (
        <EmptyState>Bạn chưa có đơn hàng nào. <Link href="/products">Bắt đầu mua sắm →</Link></EmptyState>
      ) : (
        <div className="shop-table-wrapper">
          <table className="shop-table shop-table--stack">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Ngày đặt</th>
                <th>Sản phẩm</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th><span className="visually-hidden">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td data-label="Mã đơn"><strong className="shop-code">{order.orderCode || `ORD-${order.id}`}</strong></td>
                  <td data-label="Ngày đặt">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : ''}</td>
                  <td data-label="Sản phẩm">{order.items?.map(i => `${i.productName} (${i.quantity})`).join(', ') || '-'}</td>
                  <td data-label="Tổng tiền"><strong>{money(order.totalAmount || 0)}</strong></td>
                  <td data-label="Thanh toán"><StatusBadge meta={paymentStatusMeta(order.paymentStatus)} /></td>
                  <td data-label="Trạng thái"><StatusBadge meta={orderStatusMeta(order.status)} /></td>
                  <td data-label="">
                    <Link href={`/account/orders/${order.orderCode}`}>Xem chi tiết →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ==========================================
// C11: ORDER DETAIL & CANCEL/RETURN ACTION
// ==========================================
function OrderDetailPage({ orderCode }: { orderCode: string }) {
  const { user } = useAuth()
  const resource = useResource<Order>(`/orders/${orderCode}`)
  const [dialog, setDialog] = useState<'cancel' | 'return' | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionNotice, setActionNotice] = useState('')

  if (!user) return <OrderAccessError status={401} retry={resource.retry} />
  if (resource.error) return <OrderAccessError status={resource.error.status} retry={resource.retry} />
  if (!resource.data) return <LoadingState />

  const order = resource.data
  const canCancel = order.status === 'Pending' || order.status === 'Confirmed'
  // Mỗi đơn chỉ có một yêu cầu đổi trả (chưa có bước từ chối trong state table) — R-004.
  const canReturn = order.status === 'Delivered' && !order.latestReturn

  function closeDialog() {
    if (actionBusy) return
    setDialog(null)
    setActionError('')
  }

  async function handleCancel(event: FormEvent) {
    event.preventDefault()
    if (actionBusy) return
    setActionBusy(true)
    setActionError('')
    try {
      await postJson(`/orders/${order.id}/cancel`, { reason: cancelReason.trim() || undefined })
      setDialog(null)
      setActionNotice('Đã hủy đơn hàng. Bạn không bị tính phí cho đơn này.')
      resource.retry()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể hủy đơn. Vui lòng thử lại.')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleReturn(event: FormEvent) {
    event.preventDefault()
    if (actionBusy) return
    setActionBusy(true)
    setActionError('')
    try {
      // MVP chỉ hỗ trợ trả toàn bộ đơn: gửi đủ số lượng của từng dòng đã giao.
      await postJson('/me/returns', {
        orderId: order.id,
        reason: returnReason.trim(),
        items: order.items?.map(i => ({ orderItemId: i.id, quantity: i.quantity, note: '' })) || []
      })
      setDialog(null)
      setActionNotice('Đã gửi yêu cầu đổi trả. Nhân viên sẽ xét duyệt trước khi bạn gửi hàng về.')
      resource.retry()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể tạo yêu cầu đổi trả.')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <>
      <nav className="shop-breadcrumb" aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link> / <Link href="/account/orders">Đơn hàng của tôi</Link> / <span>{order.orderCode}</span>
      </nav>
      <div className="shop-page-heading">
        <h1>Đơn hàng <span className="shop-code">{order.orderCode}</span></h1>
        <div className="shop-page-heading__actions">
          {canCancel && <button type="button" className="btn-danger" onClick={() => setDialog('cancel')}>Hủy đơn hàng</button>}
          {canReturn && <button type="button" className="btn-outline" onClick={() => setDialog('return')}>Yêu cầu trả hàng</button>}
        </div>
      </div>

      {actionNotice && <div className="shop-alert shop-alert--success" role="status"><Icon name="check" /> {actionNotice}</div>}

      <section className="shop-status-rails" aria-label="Trạng thái đơn hàng">
        <div className="shop-status-rail">
          <span>Đơn hàng</span>
          <RailStatus meta={orderStatusMeta(order.status)} />
        </div>
        <div className="shop-status-rail">
          <span>Thanh toán · {paymentMethodLabel(order.paymentMethod)}</span>
          <RailStatus meta={paymentStatusMeta(order.paymentStatus)} />
        </div>
        <div className="shop-status-rail">
          <span>Đổi trả</span>
          {order.latestReturn
            ? <><RailStatus meta={returnStatusMeta(order.latestReturn.status)} /><small className="shop-code">{order.latestReturn.returnCode}</small></>
            : <small>Chưa có yêu cầu</small>}
        </div>
      </section>

      <div className="shop-order-layout">
        <div>
          <div className="shop-table-wrapper">
            <table className="shop-table shop-table--stack">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Mã SKU</th>
                  <th>Đơn giá</th>
                  <th>Số lượng</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map(i => (
                  <tr key={i.id}>
                    <td data-label="Sản phẩm"><strong>{i.productName}</strong>{i.variantName && <small className="shop-muted-block">{i.variantName}</small>}</td>
                    <td data-label="Mã SKU" className="shop-code">{i.sku}</td>
                    <td data-label="Đơn giá">{money(i.unitPrice)}</td>
                    <td data-label="Số lượng">{i.quantity}</td>
                    <td data-label="Thành tiền"><strong>{money(i.lineTotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Lịch sử trạng thái</h2>
          {order.timeline && order.timeline.length > 0 ? (
            <ol className="shop-timeline">
              {order.timeline.map((t, idx) => (
                <li key={idx}>
                  <div className="shop-timeline__head">
                    <StatusBadge meta={orderStatusMeta(t.toStatus)} />
                    <span>bởi {t.actor}</span>
                    <time dateTime={t.createdAt}>{new Date(t.createdAt).toLocaleString('vi-VN')}</time>
                  </div>
                  {t.note && <p>{t.note}</p>}
                </li>
              ))}
            </ol>
          ) : <EmptyState>Chưa có lịch sử trạng thái.</EmptyState>}
        </div>

        <aside className="shop-panel shop-order-aside">
          <h2>Thông tin giao nhận</h2>
          <dl className="shop-summary">
            <div><dt>Người nhận</dt><dd>{order.customerName}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{order.customerPhone}</dd></div>
            <div><dt>Địa chỉ</dt><dd>{order.shippingAddress}</dd></div>
          </dl>
          <hr />
          <dl className="shop-summary">
            {order.subtotalAmount !== undefined && order.subtotalAmount > 0 && (
              <div><dt>Tạm tính</dt><dd>{money(order.subtotalAmount)}</dd></div>
            )}
            {order.discountAmount !== undefined && order.discountAmount > 0 && (
              <div className="shop-summary__discount"><dt>Giảm giá{order.promotionCode ? ` (${order.promotionCode})` : ''}</dt><dd>−{money(order.discountAmount)}</dd></div>
            )}
            <div className="shop-summary__total"><dt>Tổng thanh toán</dt><dd>{money(order.totalAmount)}</dd></div>
          </dl>
        </aside>
      </div>

      {dialog === 'cancel' && (
        <Dialog title="Hủy đơn hàng?" onClose={closeDialog} busy={actionBusy}>
          <form onSubmit={handleCancel}>
            <p>Đơn <strong>{order.orderCode}</strong> sẽ chuyển sang “Đã hủy”. Thao tác này không thể hoàn tác.</p>
            <p className="shop-muted">
              {order.paymentStatus === 'Pending'
                ? 'Đơn chưa được thanh toán nên hủy không phát sinh phí. Sản phẩm đã giữ cho bạn được trả lại cửa hàng.'
                : 'Khoản đã thanh toán của đơn được xử lý hoàn tiền (mô phỏng) sau khi nhân viên xác nhận.'}
            </p>
            <label className="shop-field">Lý do hủy (không bắt buộc)
              <input value={cancelReason} maxLength={300} onChange={e => setCancelReason(e.target.value)} placeholder="Tôi đổi ý, đặt nhầm sản phẩm..." />
            </label>
            {actionError && <p className="shop-alert shop-alert--error" role="alert">{actionError}</p>}
            <div className="shop-dialog-actions">
              <button type="submit" className="btn-danger" disabled={actionBusy}>{actionBusy ? 'Đang hủy…' : 'Xác nhận hủy'}</button>
              <button type="button" className="btn-outline" onClick={closeDialog} disabled={actionBusy}>Giữ đơn</button>
            </div>
          </form>
        </Dialog>
      )}

      {dialog === 'return' && (
        <Dialog title="Yêu cầu trả hàng" onClose={closeDialog} busy={actionBusy}>
          <form onSubmit={handleReturn}>
            <p>Bản demo chỉ hỗ trợ <strong>trả toàn bộ đơn</strong>. Yêu cầu sẽ gồm:</p>
            <ul className="shop-dialog-lines">
              {order.items?.map(i => <li key={i.id}><span>{i.productName}</span><strong>× {i.quantity}</strong></li>)}
            </ul>
            <p className="shop-muted">Cửa hàng duyệt yêu cầu, nhận và kiểm định hàng trả. Tiền chỉ được hoàn (mô phỏng) khi hàng đạt kiểm định và khoản thanh toán của đơn đã được đối soát.</p>
            <label className="shop-field">Lý do trả hàng
              <textarea required minLength={5} rows={3} maxLength={500} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Sản phẩm bị lỗi bao bì, giao sai quy cách..." />
            </label>
            {actionError && <p className="shop-alert shop-alert--error" role="alert">{actionError}</p>}
            <div className="shop-dialog-actions">
              <button type="submit" disabled={actionBusy}>{actionBusy ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
              <button type="button" className="btn-outline" onClick={closeDialog} disabled={actionBusy}>Đóng</button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  )
}

// ==========================================
// C12: CUSTOMER REQUESTS & TICKETS
// ==========================================
function AccountRequestsPage() {
  const { user } = useAuth()
  const ticketsResource = useResource<SupportTicket[]>('/me/tickets')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Order')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!user) return <LoginRequired title="Vui lòng đăng nhập để xem yêu cầu">Đăng nhập để gửi và theo dõi yêu cầu hỗ trợ của bạn.</LoginRequired>

  async function handleSubmitTicket(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setSubmitError('')
    setNotice('')
    try {
      await postJson('/me/tickets', { subject: subject.trim(), category, message: message.trim() })
      setSubject('')
      setMessage('')
      setNotice('Đã gửi yêu cầu hỗ trợ. Bạn có thể theo dõi trạng thái ở danh sách bên cạnh.')
      ticketsResource.retry()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Không thể gửi yêu cầu. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const tickets = Array.isArray(ticketsResource.data) ? ticketsResource.data : []

  return (
    <>
      <nav className="shop-breadcrumb" aria-label="Đường dẫn"><Link href="/">Trang chủ</Link> / <Link href="/account/orders">Tài khoản</Link> / <span>Hỗ trợ khách hàng</span></nav>
      <h1>Hỗ trợ khách hàng</h1>

      {notice && <div className="shop-alert shop-alert--success" role="status"><Icon name="check" /> {notice}</div>}

      <div className="shop-requests-layout">
        <section className="shop-panel">
          <h2>Gửi yêu cầu mới</h2>
          <form onSubmit={handleSubmitTicket} className="shop-form-stack">
            <label className="shop-field">Phân loại
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {ticketCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="shop-field">Tiêu đề
              <input required maxLength={200} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Tóm tắt yêu cầu cần giải quyết..." />
            </label>
            <label className="shop-field">Nội dung chi tiết
              <textarea required rows={4} maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả cụ thể sự cố hoặc câu hỏi, kèm mã đơn nếu có..." />
            </label>
            {submitError && <p className="shop-alert shop-alert--error" role="alert">{submitError}</p>}
            <button type="submit" disabled={submitting}>{submitting ? 'Đang gửi…' : 'Gửi yêu cầu'}</button>
          </form>
        </section>

        <section>
          <h2>Yêu cầu đã gửi</h2>
          {ticketsResource.error ? <ErrorState retry={ticketsResource.retry} /> : !ticketsResource.data ? <LoadingState /> : tickets.length === 0 ? (
            <EmptyState>Bạn chưa có yêu cầu hỗ trợ nào.</EmptyState>
          ) : (
            <ul className="shop-ticket-list">
              {tickets.map(t => (
                <li key={t.id} className="shop-panel">
                  <div className="shop-ticket-list__head">
                    <strong className="shop-code">{t.ticketCode}</strong>
                    <StatusBadge meta={ticketStatusMeta(t.status)} />
                  </div>
                  <h3>{t.subject}</h3>
                  <small>{ticketCategoryLabel(t.category)} · {new Date(t.createdAt).toLocaleDateString('vi-VN')}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

function NotFound() {
  return (
    <section className="shop-state">
      <h1>404 · Không tìm thấy</h1>
      <p>Trang hoặc sản phẩm này không tồn tại.</p>
      <Link href="/products">Về danh sách sản phẩm</Link>
    </section>
  )
}

// ==========================================
// ADMIN PANEL
// ==========================================
export function AdminLayout() {
  const { user, logout } = useAuth()

  // If visitor is guest without staff role, show standard M1 compatible shell
  if (!user || user.role === 'Customer') {
    return (
      <div className="shop admin-shell">
        <aside>
          <Link href="/" className="shop-brand">KTHT <span>Admin</span></Link>
          <h2>Phân hệ quản trị</h2>
          <nav aria-label="Module quản trị">
            {['Dashboard', 'Sản phẩm', 'Đơn hàng', 'Khách hàng', 'Kho', 'Vận chuyển', 'Hậu mãi', 'Thanh toán', 'Báo cáo', 'Nhân viên', 'Cấu hình'].map(module => (
              <span key={module} aria-disabled="true">{module}<small>Sắp có</small></span>
            ))}
          </nav>
        </aside>
        <div>
          <header><strong>Trung tâm vận hành</strong><Link href="/">Về cửa hàng</Link></header>
          <main>
            <nav aria-label="Đường dẫn">Quản trị / Đăng nhập</nav>
            <div className="admin-page-heading">
              <div><span className="admin-eyebrow">Truy cập nội bộ</span><h1>Đăng nhập để tiếp tục</h1></div>
              <p>Dành cho nhân viên được phân quyền.</p>
            </div>
            <div className="admin-access-card">
              <p><strong>Tài khoản demo</strong></p>
              <ul style={{ paddingLeft: 20, fontSize: 13, color: '#475569' }}>
                <li>Admin: <code>admin@ktht.local</code> / <code>Ktht@2026</code></li>
                <li>Sales: <code>sales@ktht.local</code> / <code>Ktht@2026</code></li>
                <li>Warehouse: <code>warehouse@ktht.local</code> / <code>Ktht@2026</code></li>
                <li>Support: <code>support@ktht.local</code> / <code>Ktht@2026</code></li>
              </ul>
            </div>
          </main>
        </div>
      </div>
    )
  }

  return <AdminLivePanel user={user} logout={logout} />
}

function AdminLivePanel({ user, logout }: { user: User; logout: () => void }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'inventory' | 'returns' | 'tickets' | 'flashsale' | 'copilot'>('dashboard')
  const dashboard = useResource<DashboardStats>('/admin/dashboard')
  const inventory = useResource<InventoryBalance[]>('/admin/inventory')
  const orders = useResource<{ items: Order[] }>('/admin/orders')
  const returns = useResource<ReturnRequest[]>('/admin/returns')
  const tickets = useResource<SupportTicket[]>('/admin/tickets')

  // Live operational dashboard for authorized staff!
  return (
    <div className="shop admin-shell">
      <aside>
        <Link href="/" className="shop-brand">V-Pharma <span>Admin</span></Link>
        <div className="admin-user-card">
          <strong>{user.fullName}</strong>
          <small>{user.role} · {user.email}</small>
        </div>
        <nav aria-label="Module quản trị">
          <button className={`shop-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Tổng quan</button>
          <button className={`shop-tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>Đơn hàng</button>
          <button className={`shop-tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>Tồn kho</button>
          <button className={`shop-tab ${activeTab === 'flashsale' ? 'active' : ''}`} onClick={() => setActiveTab('flashsale')}>⚡ Flash Sale</button>
          <button className={`shop-tab ${activeTab === 'copilot' ? 'active' : ''}`} onClick={() => setActiveTab('copilot')}>🤖 AI Copilot</button>
          <button className={`shop-tab ${activeTab === 'returns' ? 'active' : ''}`} onClick={() => setActiveTab('returns')}>Đổi trả</button>
          <button className={`shop-tab ${activeTab === 'tickets' ? 'active' : ''}`} onClick={() => setActiveTab('tickets')}>Hỗ trợ</button>
        </nav>
        <div style={{ marginTop: 40 }}>
          <button onClick={logout} className="btn-secondary btn-sm" style={{ width: '100%' }}>Đăng xuất</button>
        </div>
      </aside>

      <div>
        <header>
          <strong>V-Pharma · Trung tâm Vận hành Quản trị</strong>
          <Link href="/">Xem cửa hàng →</Link>
        </header>
        <main>
          {activeTab === 'dashboard' && (
            <div>
              <div className="admin-page-heading">
                <div><span className="admin-eyebrow">Tổng quan</span><h1>Hiệu quả vận hành</h1></div>
                <p>Dữ liệu cập nhật từ hệ thống.</p>
              </div>

              {dashboard.data ? (
                <>
                  <div className="admin-dashboard-grid">
                    <div className="admin-stat-card">
                      <span>Doanh thu</span>
                      <h3>{money(dashboard.data.totalRevenue)}</h3>
                      <small>Đã trừ đơn hủy</small>
                    </div>
                    <div className="admin-stat-card">
                      <span>Đơn hàng</span>
                      <h3>{dashboard.data.totalOrders}</h3>
                      <small>{dashboard.data.pendingOrders} đơn chờ xử lý</small>
                    </div>
                    <div className="admin-stat-card">
                      <span>Sản phẩm</span>
                      <h3>{dashboard.data.totalProducts}</h3>
                      <small>Đang niêm yết</small>
                    </div>
                    <div className="admin-stat-card">
                      <span>Cảnh báo tồn kho</span>
                      <h3 style={{ color: dashboard.data.lowStockAlerts > 0 ? '#dc2626' : '#16a34a' }}>{dashboard.data.lowStockAlerts}</h3>
                      <small>SKU có U ≤ B</small>
                    </div>
                  </div>

                  <h2>Đơn hàng gần đây</h2>
                  <div className="shop-table-wrapper">
                    <table className="shop-table">
                      <thead>
                        <tr>
                          <th>Mã đơn</th>
                          <th>Khách hàng</th>
                          <th>Tổng tiền</th>
                          <th>Trạng thái</th>
                          <th>Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.data.recentOrders.map(o => (
                          <tr key={o.id}>
                            <td><strong>{o.orderCode}</strong></td>
                            <td>{o.customerName}</td>
                            <td>{money(o.totalAmount)}</td>
                            <td><span className={`shop-badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                            <td>{new Date(o.createdAt).toLocaleString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : <LoadingState />}
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              <div className="admin-page-heading"><div><span className="admin-eyebrow">Bán hàng</span><h1>Đơn hàng</h1></div><p>Xử lý theo đúng trạng thái.</p></div>
              <div className="shop-table-wrapper">
                <table className="shop-table">
                  <thead>
                    <tr>
                      <th>Mã đơn</th>
                      <th>Khách hàng</th>
                      <th>Tổng tiền</th>
                      <th>Thanh toán</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data?.items.map(o => (
                      <tr key={o.id}>
                        <td><strong>{o.orderCode}</strong></td>
                        <td>{o.customerName} ({o.customerPhone})</td>
                        <td>{money(o.totalAmount)}</td>
                        <td>{paymentMethodLabel(o.paymentMethod)}<br /><StatusBadge meta={paymentStatusMeta(o.paymentStatus)} /></td>
                        <td><StatusBadge meta={orderStatusMeta(o.status)} /></td>
                        <td>
                          {o.status === 'Pending' && (
                            <button className="btn-sm btn-success" onClick={async () => { await postJson(`/admin/orders/${o.id}/confirm`); orders.retry() }}>
                              Xác nhận
                            </button>
                          )}
                          {o.status === 'Confirmed' && (
                            <button className="btn-sm shop-primary" onClick={async () => { await postJson(`/admin/orders/${o.id}/fulfill`); orders.retry() }}>
                              Xuất kho
                            </button>
                          )}
                          {o.status === 'Shipped' && (
                            <button className="btn-sm btn-success" onClick={async () => { await postJson(`/admin/orders/${o.id}/deliver`); orders.retry() }}>
                              Đã giao
                            </button>
                          )}
                          {o.status === 'Delivered' && o.paymentStatus === 'Pending' && (
                            <button className="btn-sm btn-success" onClick={async () => {
                              try { await postJson(`/admin/orders/${o.id}/confirm-payment`) } catch { /* trạng thái mới được tải lại bên dưới */ }
                              orders.retry()
                            }}>
                              Xác nhận đã thu tiền
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'inventory' && (
            <div>
              <div className="admin-page-heading"><div><span className="admin-eyebrow">Kho</span><h1>Tồn kho</h1></div><p><strong>U = P − Q − B − R − A</strong></p></div>
              <div className="shop-table-wrapper">
                <table className="shop-table">
                  <thead>
                    <tr>
                      <th>Mã SKU</th>
                      <th>Vật lý (P)</th>
                      <th>Cách ly (Q)</th>
                      <th>An toàn (B)</th>
                      <th>Đã giữ (R)</th>
                      <th>Hạn mức (A)</th>
                      <th>Khả dụng (U)</th>
                      <th>Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.data?.slice(0, 50).map(b => (
                      <tr key={b.id}>
                        <td><strong>{b.sku}</strong></td>
                        <td>{b.p}</td>
                        <td>{b.q}</td>
                        <td>{b.b}</td>
                        <td>{b.r}</td>
                        <td>{b.a}</td>
                        <td><strong style={{ color: b.availableStock <= b.b ? '#dc2626' : '#15803d' }}>{b.availableStock}</strong></td>
                        <td>{b.isLowStock ? <span className="shop-badge badge-cancelled">Tồn thấp</span> : <span className="shop-badge badge-delivered">Đầy đủ</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'returns' && (
            <div>
              <div className="admin-page-heading"><div><span className="admin-eyebrow">Hậu mãi</span><h1>Đổi trả</h1></div><p>Tiếp nhận, kiểm định và hoàn tiền.</p></div>
              <div className="shop-table-wrapper">
                <table className="shop-table">
                  <thead>
                    <tr>
                      <th>Mã RMA</th>
                      <th>Mã đơn</th>
                      <th>Lý do</th>
                      <th>Số tiền hoàn</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returns.data?.map(r => (
                      <tr key={r.id}>
                        <td><strong>{r.returnCode}</strong></td>
                        <td>{r.orderCode}</td>
                        <td>{r.reason}</td>
                        <td>{money(r.refundAmount)}</td>
                        <td><span className="shop-badge badge-pending">{r.status}</span></td>
                        <td>
                          {r.status === 'Requested' && (
                            <button className="btn-sm" onClick={async () => { await postJson(`/admin/returns/${r.id}/approve`); returns.retry() }}>Duyệt yêu cầu</button>
                          )}
                          {r.status === 'Approved' && (
                            <button className="btn-sm btn-secondary" onClick={async () => { await postJson(`/admin/returns/${r.id}/receive`); returns.retry() }}>Tiếp nhận</button>
                          )}
                          {r.status === 'Received' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn-sm btn-success" onClick={async () => { await postJson(`/admin/returns/${r.id}/qc`, { isPassed: true }); returns.retry() }}>Đạt QC</button>
                              <button className="btn-sm btn-danger" onClick={async () => { await postJson(`/admin/returns/${r.id}/qc`, { isPassed: false }); returns.retry() }}>Không đạt</button>
                            </div>
                          )}
                          {r.status === 'QC_Completed' && (
                            <button className="btn-sm btn-success" onClick={async () => { await postJson(`/admin/returns/${r.id}/refund`); returns.retry() }}>Hoàn tiền</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'tickets' && (
            <div>
              <div className="admin-page-heading"><div><span className="admin-eyebrow">CSKH</span><h1>Yêu cầu hỗ trợ</h1></div><p>Theo dõi và phân loại yêu cầu.</p></div>
              <div className="shop-table-wrapper">
                <table className="shop-table">
                  <thead>
                    <tr>
                      <th>Mã yêu cầu</th>
                      <th>Khách hàng</th>
                      <th>Tiêu đề</th>
                      <th>Phân loại</th>
                      <th>Độ ưu tiên</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.data?.map(t => (
                      <tr key={t.id}>
                        <td><strong>{t.ticketCode}</strong></td>
                        <td>{t.customerName}</td>
                        <td>{t.subject}</td>
                        <td>{t.category}</td>
                        <td>{t.priority}</td>
                        <td><span className="shop-badge badge-pending">{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'flashsale' && <AdminFlashSaleManager />}

          {activeTab === 'copilot' && <AdminCopilotPanel user={user} />}

        </main>
      </div>
    </div>
  )
}

function AdminFlashSaleManager() {
  const resource = useResource<any[]>('/admin/flash-sales')
  const [toggling, setToggling] = useState<number | null>(null)

  async function handleToggle(id: number) {
    setToggling(id)
    try {
      await putJson(`/admin/flash-sales/${id}/toggle`)
      resource.retry()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể thay đổi trạng thái')
    } finally {
      setToggling(null)
    }
  }

  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">Khuyến mãi & Sự kiện</span>
          <h1>Quản lý Flash Sale</h1>
        </div>
        <p>Chiến dịch giảm giá giờ vàng với số lượng giới hạn.</p>
      </div>

      {resource.data ? (
        <div style={{ display: 'grid', gap: 24 }}>
          {resource.data.map((fs: any) => (
            <div key={fs.id} style={{ background: 'white', borderRadius: 14, border: '1px solid var(--shop-border)', padding: 24, boxShadow: '0 4px 14px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>{fs.name}</h3>
                  <small style={{ color: '#64748b' }}>
                    {new Date(fs.startTime).toLocaleString('vi-VN')} → {new Date(fs.endTime).toLocaleString('vi-VN')}
                  </small>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`shop-badge ${fs.isActive ? 'badge-delivered' : 'badge-cancelled'}`}>
                    {fs.isActive ? 'ĐANG CHẠY' : 'TẠM DỪNG'}
                  </span>
                  <button
                    className={`btn-sm ${fs.isActive ? 'btn-secondary' : 'btn-success'}`}
                    disabled={toggling === fs.id}
                    onClick={() => handleToggle(fs.id)}
                  >
                    {fs.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <small style={{ color: '#64748b' }}>Sản phẩm tham gia</small>
                  <strong style={{ display: 'block', fontSize: 16 }}>{fs.totalItems} SKU</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <small style={{ color: '#64748b' }}>Tổng số lượng đã bán</small>
                  <strong style={{ display: 'block', fontSize: 16, color: '#dc2626' }}>{fs.totalSold} suất</strong>
                </div>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                  <small style={{ color: '#64748b' }}>Doanh thu Flash Sale</small>
                  <strong style={{ display: 'block', fontSize: 16, color: 'var(--shop-primary)' }}>{money(fs.totalRevenue)}</strong>
                </div>
              </div>

              <div className="shop-table-wrapper">
                <table className="shop-table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Tên sản phẩm</th>
                      <th>Giá gốc</th>
                      <th>Giá Flash Sale</th>
                      <th>Giảm</th>
                      <th>Hạn mức / Đã bán</th>
                      <th>Tiến độ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fs.items.map((item: any) => {
                      const percent = Math.min(100, Math.round((item.soldCount * 100) / Math.max(1, item.quantityLimit)))
                      return (
                        <tr key={item.id}>
                          <td><strong>{item.sku}</strong></td>
                          <td>{item.productName}</td>
                          <td style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{money(item.originalPrice)}</td>
                          <td style={{ color: '#dc2626', fontWeight: 700 }}>{money(item.flashSalePrice)}</td>
                          <td><span className="shop-badge" style={{ background: '#fee2e2', color: '#dc2626' }}>-{item.discountPercentage}%</span></td>
                          <td>{item.soldCount} / {item.quantityLimit}</td>
                          <td style={{ minWidth: 100 }}>
                            <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: '#dc2626' }} />
                            </div>
                            <small style={{ color: '#64748b', fontSize: 10 }}>{percent}%</small>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : <LoadingState />}
    </div>
  )
}

function AdminCopilotPanel({ user }: { user: User }) {
  const [messages, setMessages] = useState<Array<{ id: string; sender: 'user' | 'bot'; text: string; time: string; data?: any }>>([
    {
      id: 'welcome',
      sender: 'bot',
      text: `Xin chào ${user.fullName} (${user.role})! Tôi là V-Pharma Admin Copilot.\nBạn có thể hỏi tôi về:\n- Báo cáo tồn kho (P, Q, B, R, A, U)\n- Doanh thu và hiệu suất bán hàng\n- Tình hình chiến dịch Flash Sale`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(textToSend?: string) {
    const text = (textToSend ?? input).trim()
    if (!text || loading) return

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: 'user' as const,
      text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await postJson<{ reply: string; data?: any }>('/chat/admin', { message: text })
      setMessages(prev => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: res.reply,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          data: res.data
        }
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'bot',
          text: err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ trợ lý.',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">Trợ lý Quản trị</span>
          <h1>V-Pharma AI Copilot</h1>
        </div>
        <p>Hỏi đáp số liệu vận hành, tồn kho và đơn hàng theo thời gian thực.</p>
      </div>

      <div className="admin-copilot-card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="chat-chip" onClick={() => handleSend('Báo cáo tồn kho')}>📊 Báo cáo tồn kho</button>
          <button className="chat-chip" onClick={() => handleSend('Doanh thu và đơn hàng')}>📈 Báo cáo doanh thu & đơn hàng</button>
          <button className="chat-chip" onClick={() => handleSend('Flash sale')}>⚡ Kiểm tra Flash Sale</button>
        </div>

        <div style={{ minHeight: 320, maxHeight: 480, overflowY: 'auto', background: '#f8fafc', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.map(m => (
            <div key={m.id} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <div style={{
                background: m.sender === 'user' ? 'var(--shop-primary)' : 'white',
                color: m.sender === 'user' ? 'white' : '#1e293b',
                padding: '12px 16px',
                borderRadius: 12,
                border: m.sender === 'bot' ? '1px solid #e2e8f0' : 'none',
                whiteSpace: 'pre-line',
                boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
                fontSize: 14,
                lineHeight: 1.5
              }}>
                {m.text}
              </div>
              <small style={{ display: 'block', color: '#94a3b8', fontSize: 10, marginTop: 4, textAlign: m.sender === 'user' ? 'right' : 'left' }}>{m.time}</small>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', background: 'white', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <small style={{ color: '#64748b' }}>Đang truy vấn số liệu máy chủ…</small>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={e => { e.preventDefault(); handleSend() }} style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Hỏi về tồn kho, đơn hàng, flash sale..."
            style={{ height: 44, borderRadius: 8, flex: 1, border: '1.5px solid #cbd5e1', paddingInline: 14 }}
          />
          <button type="submit" className="shop-primary" disabled={loading || !input.trim()} style={{ height: 44, borderRadius: 8, paddingInline: 20 }}>
            Gửi câu hỏi
          </button>
        </form>
      </div>
    </div>
  )
}

function AppContent() {
  const location = useLocation()
  const [path, search = ''] = location.split('?')
  const params = new URLSearchParams(search)
  const categories = useResource<Category[]>('/categories')

  if (path.startsWith('/admin')) return <AdminLayout />

  const productMatch = /^\/products\/([^/]+)$/.exec(path)
  let slug = ''
  try { slug = productMatch ? decodeURIComponent(productMatch[1]) : '' } catch { /* 404 */ }

  // Ẩn danh mục giữ chỗ của seed khỏi điều hướng; bộ lọc vẫn liệt kê đủ để lọc được.
  const visibleCategories = (categories.data || []).filter(category => !isPlaceholderCategory(category.name))

  const orderResultMatch = /^\/checkout\/result\/([^/]+)$/.exec(path)
  const orderResultCode = orderResultMatch ? decodeURIComponent(orderResultMatch[1]) : ''

  const orderDetailMatch = /^\/account\/orders\/([^/]+)$/.exec(path)
  const orderDetailCode = orderDetailMatch ? decodeURIComponent(orderDetailMatch[1]) : ''

  return (
    <CustomerLayout categories={visibleCategories} query={params.get('q') || ''}>
      {categories.error && <ErrorState retry={categories.retry} />}
      {!categories.data && !categories.error && <LoadingState />}
      {path === '/' ? <HomePage categories={visibleCategories} /> :
       path === '/products' ? <ProductsPage params={params} categories={categories.data || []} /> :
       path === '/cart' ? <CartPage /> :
       path === '/checkout' ? <CheckoutPage /> :
       orderResultCode ? <OrderResultPage orderCode={orderResultCode} /> :
       (path === '/account' || path === '/account/orders') ? <AccountOrdersPage /> :
       orderDetailCode ? <OrderDetailPage orderCode={orderDetailCode} /> :
       path === '/account/requests' ? <AccountRequestsPage /> :
       slug ? <DetailPage key={slug} slug={slug} params={params} /> :
       <NotFound />}
    </CustomerLayout>
  )
}

export default function App() {
  return <StoreProvider><AppContent /></StoreProvider>
}
