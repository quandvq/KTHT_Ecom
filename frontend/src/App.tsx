import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import {
  ApiError, getJson, postJson, putJson, safeStorageGet, safeStorageSet, safeStorageRemove,
  type Category, type Brand, type Product, type ProductPage, type ProductDetail,
  type User, type CartItem, type Order, type DashboardStats, type InventoryBalance,
  type ReturnRequest, type SupportTicket, type PromotionValidation,
  type ActiveFlashSaleResponse, type FlashSaleItem, type ChatMessage
} from './products'
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

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return <AuthContext.Provider value={{ user, saveAuth, logout }}>
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, totalCount, totalAmount }}>
      {children}
    </CartContext.Provider>
  </AuthContext.Provider>
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
          {/* Cột 1: V-Pharma & Giới thiệu */}
          <div className="shop-footer-col">
            <div className="shop-footer-brand">
              <span aria-hidden="true">V</span>
              <span>V-Pharma</span>
            </div>
            <p>Hệ thống nhà thuốc trực tuyến đạt chuẩn <strong>GPP</strong> — Đồng hành cùng sức khỏe gia đình Việt với 100% thuốc & thực phẩm chức năng chính hãng.</p>
            <p style={{ fontSize: 12, color: '#64748b' }}>
              Giấy chứng nhận ĐKKD số: 0312345678 do Sở KH&ĐT TP.HCM cấp.<br />
              Chứng chỉ hành nghề Dược số: 009876/CCHN-D-HCM.
            </p>
          </div>

          {/* Cột 2: Về V-Pharma */}
          <div className="shop-footer-col">
            <h3>Về V-Pharma</h3>
            <ul className="shop-footer-links">
              <li><Link href="/products">Giới thiệu hệ thống</Link></li>
              <li><Link href="/products">Hệ thống nhà thuốc</Link></li>
              <li><Link href="/products">Giấy phép kinh doanh dược</Link></li>
              <li><Link href="/products">Tuyển dụng dược sĩ</Link></li>
              <li><Link href="/products">Chính sách bảo mật</Link></li>
            </ul>
          </div>

          {/* Cột 3: Hỗ trợ khách hàng */}
          <div className="shop-footer-col">
            <h3>Hỗ trợ khách hàng</h3>
            <ul className="shop-footer-links">
              <li><Link href="/cart">Hướng dẫn mua hàng</Link></li>
              <li><Link href="/cart">Chính sách đổi trả 30 ngày</Link></li>
              <li><Link href="/cart">Chính sách giao hàng 2h</Link></li>
              <li><Link href="/cart">Phương thức thanh toán</Link></li>
              <li><Link href="/account/orders">Tra cứu đơn hàng</Link></li>
            </ul>
          </div>

          {/* Cột 4: Hotline & Liên hệ */}
          <div className="shop-footer-col">
            <h3>Tổng đài tư vấn miễn phí</h3>
            <a href="tel:18006828" className="shop-footer-hotline">
              📞 1800 6828
            </a>
            <p style={{ fontSize: 12, marginBottom: 14 }}>Tư vấn sử dụng thuốc & CSKH (8:00 - 21:30 hàng ngày, miễn phí cước gọi)</p>

            <div className="shop-footer-contact-item">
              <span>✉️</span>
              <div>
                <strong>Email hỗ trợ:</strong>
                <span>cskh@vpharma.vn</span>
              </div>
            </div>

            <div className="shop-footer-contact-item">
              <span>📍</span>
              <div>
                <strong>Trụ sở chính:</strong>
                <span>59C Nguyễn Đình Chiểu, P. Võ Thị Sáu, Q. 3, TP. Hồ Chí Minh</span>
              </div>
            </div>

            <div className="shop-footer-contact-item">
              <span>🕒</span>
              <div>
                <strong>Giờ hoạt động:</strong>
                <span>07:00 - 22:00 (Tất cả các ngày trong tuần)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="shop-footer-bottom">
          <p>© 2026 V-Pharma. Tất cả các quyền được bảo lưu. Nền tảng Dược phẩm & Chăm sóc Sức khỏe Trực tuyến.</p>
          <p>Lưu ý: Mọi thông tin trên website chỉ mang tính chất tham khảo. Vui lòng tham khảo ý kiến Bác sĩ hoặc Dược sĩ trước khi dùng thuốc.</p>
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
      text: 'Xin chào! Em là Trợ lý Dược sĩ V-Pharma 🌿.\nEm có thể hỗ trợ bạn tìm kiếm thuốc, vitamin, kiểm tra đơn hàng hoặc giải đáp chính sách giao nhận 2h.',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      suggestions: ['Tìm vitamin C', 'Flash Sale hôm nay', 'Chính sách đổi trả', 'Hotline 1800 6828']
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
      const res = await postJson<{ reply: string; suggestions?: string[]; products?: any[] }>('/chat/customer', { message: text })
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
          text: 'Rất tiếc, hệ thống đang bận. Bạn vui lòng liên hệ Hotline trực tiếp **1800 6828** (miễn phí) để được Dược sĩ V-Pharma hỗ trợ ngay nhé!',
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
          <span className="badge-pulse" aria-hidden="true" />
          <span>💬 Trợ lý Dược sĩ V-Pharma</span>
        </button>
      )}

      {isOpen && (
        <div className="shop-chatbot-window" role="dialog" aria-label="Khung chat V-Pharma">
          <div className="shop-chatbot-header">
            <div className="shop-chatbot-header-info">
              <div className="shop-chatbot-avatar">V</div>
              <div>
                <div className="shop-chatbot-title">Dược sĩ V-Pharma</div>
                <div className="shop-chatbot-subtitle">Trực tuyến 24/7</div>
              </div>
            </div>
            <button className="shop-chatbot-close" onClick={() => setIsOpen(false)} aria-label="Đóng chat">✕</button>
          </div>

          <div className="shop-chatbot-disclaimer">
            <span>⚕️</span>
            <span>Tư vấn thông tin sản phẩm. Không thay thế chẩn đoán y khoa.</span>
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
                          <div style={{ width: 44, height: 44, background: '#e2e8f0', borderRadius: 6, display: 'grid', placeItems: 'center', fontSize: 16 }}>💊</div>
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
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  )
}

export function CustomerLayout({ children, categories, query }: { children: ReactNode; categories: Category[]; query: string }) {
  const { user, logout } = useAuth()
  const { totalCount } = useCart()
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)

  return (
    <div className="shop">
      <a className="shop-skip" href="#main-content">Đến nội dung</a>
      <div className="shop-announcement">V-Pharma · Hệ thống nhà thuốc trực tuyến chính hãng & Giao hàng 2 giờ · Hotline: 1800 6828</div>
      <header className="shop-header shop-container">
        <Link href="/" className="shop-brand">
          <span aria-hidden="true">V</span>V-Pharma<span className="shop-brand-sub">Nhà thuốc trực tuyến</span>
        </Link>
        <SearchBar query={query} />
        <div className="shop-account">
          <Link href="/cart" style={{ fontWeight: 600 }}>
            Giỏ hàng ({totalCount})
            <small>Xem giỏ & đặt hàng</small>
          </Link>
          {user ? (
            <div>
              <Link href="/account/orders" style={{ color: 'inherit', textDecoration: 'none' }}>
                <strong>{user.fullName}</strong>
              </Link>
              <small>
                {user.role !== 'Customer' && <Link href="/admin">Quản trị ({user.role}) · </Link>}
                <Link href="/account/orders">Đơn hàng</Link> · <button onClick={logout} style={{ background: 'none', border: 0, color: '#dc2626', padding: 0, font: 'inherit', cursor: 'pointer' }}>Đăng xuất</button>
              </small>
            </div>
          ) : (
            <div>
              <span>Tài khoản</span>
              <small>
                <button onClick={() => setAuthModal('login')} style={{ background: 'none', border: 0, color: 'var(--shop-primary)', padding: 0, font: 'inherit', cursor: 'pointer' }}>Đăng nhập</button>
                {' / '}
                <button onClick={() => setAuthModal('register')} style={{ background: 'none', border: 0, color: 'var(--shop-primary)', padding: 0, font: 'inherit', cursor: 'pointer' }}>Đăng ký</button>
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

      {authModal && <AuthModal mode={authModal} onClose={() => setAuthModal(null)} />}
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

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (currentMode === 'login') {
        const res = await postJson<{ token: string; user: User }>('/auth/login', { email, password })
        saveAuth(res.token, res.user)
        onClose()
        if (res.user.role !== 'Customer') {
          navigate('/admin')
        } else if (window.location.pathname === '/' || window.location.pathname === '/account') {
          navigate('/account/orders')
        }
      } else {
        const res = await postJson<{ token: string; user: User }>('/auth/register', { email, password, fullName, phoneNumber: phone })
        saveAuth(res.token, res.user)
        onClose()
        navigate('/account/orders')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác không thành công.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="shop-modal-backdrop" onClick={onClose}>
      <div className="shop-modal" onClick={e => e.stopPropagation()}>
        <div className="shop-modal-header">
          <h2>{currentMode === 'login' ? 'Đăng nhập V-Pharma' : 'Đăng ký tài khoản mới'}</h2>
          <button onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        {error && <div className="shop-alert-error" role="alert">{error}</div>}
        <form onSubmit={submit}>
          {currentMode === 'register' && (
            <>
              <label className="shop-field">Họ và tên
                <input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
              </label>
              <label className="shop-field">Số điện thoại
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901234567" />
              </label>
            </>
          )}
          <label className="shop-field">Email
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
          </label>
          <label className="shop-field">Mật khẩu
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
          </label>
          <button type="submit" className="btn-modal-submit" disabled={loading}>
            {loading ? 'Đang xử lý…' : (currentMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản')}
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: 13, textAlign: 'center', color: '#64748b' }}>
          {currentMode === 'login' ? (
            <>Chưa có tài khoản? <button onClick={() => { setCurrentMode('register'); setError('') }} style={{ background: 'none', border: 0, color: 'var(--shop-primary)', padding: 0, font: 'inherit', cursor: 'pointer', fontWeight: 700 }}>Đăng ký ngay</button></>
          ) : (
            <>Đã có tài khoản? <button onClick={() => { setCurrentMode('login'); setError('') }} style={{ background: 'none', border: 0, color: 'var(--shop-primary)', padding: 0, font: 'inherit', cursor: 'pointer', fontWeight: 700 }}>Đăng nhập</button></>
          )}
        </p>
      </div>
    </div>
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
  const hours = Math.floor(secondsLeft / 3600)
  const minutes = Math.floor((secondsLeft % 3600) / 60)
  const seconds = secondsLeft % 60

  return (
    <section className="shop-flashsale-section">
      <div className="shop-flashsale-header">
        <div className="shop-flashsale-title">
          <span>⚡</span> {campaign.name}
        </div>
        <div className="shop-flashsale-countdown">
          <span>KẾT THÚC TRONG:</span>
          <span className="shop-countdown-box">{String(hours).padStart(2, '0')}</span> :
          <span className="shop-countdown-box">{String(minutes).padStart(2, '0')}</span> :
          <span className="shop-countdown-box">{String(seconds).padStart(2, '0')}</span>
        </div>
      </div>

      <div className="shop-product-grid">
        {campaign.items.slice(0, 4).map(item => {
          const percentSold = Math.min(100, Math.round((item.soldCount * 100) / Math.max(1, item.quantityLimit)))
          return (
            <article key={item.id} className="shop-product-card shop-flashsale-card">
              <span className="shop-flashsale-badge">-{item.discountPercentage}%</span>
              <Link href={`/products/${item.productSlug}`}>
                <ProductImage src={item.imageUrl} name={item.productName} />
                <div className="shop-card-content">
                  <small>{item.variantName || item.sku}</small>
                  <h3>{item.productName}</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBlock: 'auto 6px' }}>
                    <strong style={{ color: '#dc2626', fontSize: 18 }}>{money(item.flashSalePrice)}</strong>
                    <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: 12 }}>{money(item.originalPrice)}</span>
                  </div>

                  <div className="shop-flashsale-progress">
                    <div className="shop-flashsale-progress-bar" style={{ width: `${percentSold}%` }} />
                    <span className="shop-flashsale-progress-text">ĐÃ BÁN {item.soldCount}/{item.quantityLimit}</span>
                  </div>

                  <button
                    type="button"
                    style={{ marginTop: 12, width: '100%', background: '#dc2626', borderRadius: 8, height: 38, padding: 0 }}
                    onClick={e => {
                      e.preventDefault()
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
                    {addedSku === item.sku ? '✓ Đã thêm vào giỏ' : 'Săn deal ngay'}
                  </button>
                </div>
              </Link>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return src && !failed ? (
    <img className="shop-product-image" src={src} alt={name} onError={() => setFailed(true)} />
  ) : (
    <div className="shop-image-placeholder" role="img" aria-label={'Chưa có ảnh: ' + name}>
      <span aria-hidden="true">▧</span>
      <small>Ảnh sản phẩm đang cập nhật</small>
    </div>
  )
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="shop-product-card">
      <Link href={'/products/' + encodeURIComponent(product.slug)}>
        <ProductImage src={product.imageUrl} name={product.name} />
        <div className="shop-card-content">
          <small>{product.brand?.name ? `${product.brand.name} · ` : ''}{product.category.name}</small>
          <h3>{product.name}</h3>
          <p>Từ <strong>{money(product.price)}</strong></p>
          <span>Xem chi tiết →</span>
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
          <p className="shop-eyebrow">CHĂM SÓC SỨC KHỎE CÙNG V-PHARMA</p>
          <h1>Lựa chọn mỗi ngày,<br />dễ dàng hơn.</h1>
          <p>Thuốc, vitamin và thực phẩm chức năng chính hãng 100%. Tư vấn tận tâm bởi đội ngũ dược sĩ chuyên môn.</p>
          <Link href="/products" className="shop-primary">Khám phá sản phẩm →</Link>
        </div>
        <div className="shop-hero-art" role="img" aria-label="Hình minh họa danh mục">
          <span>V-Pharma</span>
          <small>Hệ thống nhà thuốc đạt chuẩn GPP</small>
        </div>
      </section>
      <FlashSaleSection />
      <section className="shop-section">
        <h2>Khám phá danh mục</h2>
        {categories.length ? (
          <div className="shop-category-grid">
            {categories.map(category => (
              <Link key={category.id} href={'/products?category=' + category.slug}>
                <span aria-hidden="true">↗</span>{category.name}
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
    const next = new URLSearchParams()
    for (const key of ['q', 'category', 'brand', 'sort', 'minPrice', 'maxPrice']) {
      const value = (filters[key as keyof typeof filters] || '').trim()
      if (value) next.set(key, value)
    }
    const minimum = next.get('minPrice'), maximum = next.get('maxPrice')
    if (minimum && maximum && Number(minimum) > Number(maximum)) {
      setError('Giá tối thiểu không được lớn hơn giá tối đa.')
      return
    }
    setError('')
    navigate('/products?' + next)
  }

  const brands = Array.isArray(brandsResource.data) ? brandsResource.data : []

  return (
    <form className="shop-filters" onSubmit={submit}>
      <label>Từ khóa
        <input name="q" type="search" value={filters.q} onChange={event => setFilters(current => ({ ...current, q: event.target.value }))} maxLength={200} placeholder="Tên sản phẩm, SKU..." />
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
        <input name="minPrice" type="number" min="0" step="0.01" value={filters.minPrice} onChange={event => setFilters(current => ({ ...current, minPrice: event.target.value }))} />
      </label>
      <label>Giá đến (đ)
        <input name="maxPrice" type="number" min="0" step="0.01" value={filters.maxPrice} onChange={event => setFilters(current => ({ ...current, maxPrice: event.target.value }))} />
      </label>
      <label>Sắp xếp
        <select name="sort" value={filters.sort || params.get('sort') || 'featured'} onChange={event => setFilters(current => ({ ...current, sort: event.target.value }))}>
          <option value="featured">Nổi bật</option>
          <option value="name">Tên A–Z</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
        </select>
      </label>
      <button type="submit">Áp dụng</button>
      <Link href="/products">Xóa bộ lọc</Link>
      {error && <p role="alert">{error}</p>}
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
      <p className="shop-eyebrow">DANH MỤC KTHT</p>
      <h1>Sản phẩm</h1>
      <FilterBar params={params} categories={categories} />
      {resource.error ? <ErrorState retry={resource.retry} /> : !resource.data ? <LoadingState /> : (
        <>
          <p className="shop-result-count">{resource.data.totalCount} sản phẩm phù hợp</p>
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

  function handleAddToCart() {
    if (!selected || !validQuantity) return
    addItem({
      sku: selected.sku,
      productId: product.id,
      productName: product.name,
      variantName: selected.name,
      imageUrl: selected.imageUrl || product.imageUrl,
      price: selected.price,
      quantity: Number(quantity)
    })
    setCartNotice(`Đã thêm ${quantity} sản phẩm vào giỏ hàng!`)
    setTimeout(() => setCartNotice(''), 4000)
  }

  return (
    <>
      <nav className="shop-breadcrumb" aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link> / <Link href="/products">Sản phẩm</Link> / <span>{product.name}</span>
      </nav>
      <article className="shop-detail">
        <ProductImage src={selected?.imageUrl || product.imageUrl} name={product.name} />
        <div>
          <p className="shop-eyebrow">
            {product.brand?.name ? `${product.brand.name} · ` : ''}{product.category.name}
          </p>
          <h1>{product.name}</h1>
          {selected && <p className="shop-detail-price">{money(selected.price)}</p>}
          <p className="shop-description">{product.description}</p>
          {product.packageSize && <p>Quy cách đóng gói: <strong>{product.packageSize}</strong></p>}
          {product.saleUnit && <p>Đơn vị bán: <strong>{product.saleUnit}</strong></p>}

          <label className="shop-field">Phiên bản / SKU
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
                <option key={variant.id} value={variant.sku}>{variant.name} · {variant.sku}</option>
              ))}
            </select>
          </label>

          {!selected && <p role="alert">{requested ? 'SKU không tồn tại hoặc không còn được niêm yết. Vui lòng chọn phiên bản khác.' : 'Chưa có phiên bản được niêm yết.'}</p>}
          {selected && <p>Mã SKU: <strong>{selected.sku}</strong></p>}

          <label className="shop-field">Số lượng
            <input
              aria-invalid={!validQuantity}
              aria-describedby={!validQuantity ? 'quantity-error' : undefined}
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={event => setQuantity(event.target.value)}
            />
          </label>
          {!validQuantity && <p role="alert" id="quantity-error">Số lượng phải là số nguyên dương.</p>}

          <div style={{ marginBlock: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
            <button
              type="button"
              disabled={!selected || !validQuantity}
              onClick={handleAddToCart}
              style={{ padding: '14px 28px', fontSize: 16 }}
            >
              Thêm vào giỏ hàng
            </button>
            {selected && (
              <button
                type="button"
                className="btn-secondary"
                disabled={!validQuantity}
                onClick={() => { handleAddToCart(); navigate('/cart') }}
              >
                Mua ngay
              </button>
            )}
          </div>

          {cartNotice && (
            <div style={{ padding: 12, background: '#dcfce7', color: '#15803d', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
              ✓ {cartNotice} <Link href="/cart" style={{ marginLeft: 8, textDecoration: 'underline' }}>Đến giỏ hàng →</Link>
            </div>
          )}

          <div className="shop-purchase-note">
            Dữ liệu demo KTHT E-commerce. Bạn có thể thêm vào giỏ và đặt hàng thực tế để thử nghiệm quy trình giữ tồn kho tự động. (Giỏ hàng chưa triển khai thanh toán tiền thật).
          </div>
        </div>
      </article>
    </>
  )
}

// ==========================================
// C04: SHOPPING CART PAGE
// ==========================================
function CartPage() {
  const { items, updateQuantity, removeItem, totalAmount } = useCart()

  if (items.length === 0) {
    return (
      <div className="shop-state">
        <h2>Giỏ hàng của bạn đang trống</h2>
        <p>Hãy khám phá các sản phẩm dược phẩm và tiêu dùng để đặt hàng.</p>
        <Link href="/products" className="shop-primary">Tiếp tục mua sắm →</Link>
      </div>
    )
  }

  return (
    <>
      <nav className="shop-breadcrumb"><Link href="/">Trang chủ</Link> / <span>Giỏ hàng</span></nav>
      <h1>Giỏ hàng của bạn</h1>
      <div className="shop-cart-grid">
        <div className="shop-cart-items">
          {items.map(item => (
            <div key={item.sku} className="shop-cart-line">
              <img src={item.imageUrl || ''} alt={item.productName} style={{ width: 64, height: 64, objectFit: 'contain', background: '#f8fafc', borderRadius: 6 }} />
              <div>
                <strong>{item.productName}</strong>
                <small style={{ display: 'block', color: '#64748b' }}>Phiên bản: {item.variantName} (SKU: {item.sku})</small>
                <span style={{ color: 'var(--shop-primary)', fontWeight: 600 }}>{money(item.price)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn-secondary btn-sm" onClick={() => updateQuantity(item.sku, item.quantity - 1)}>-</button>
                <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
                <button className="btn-secondary btn-sm" onClick={() => updateQuantity(item.sku, item.quantity + 1)}>+</button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong style={{ display: 'block' }}>{money(item.price * item.quantity)}</strong>
                <button onClick={() => removeItem(item.sku)} style={{ background: 'none', border: 0, color: '#dc2626', fontSize: 12, padding: 0, cursor: 'pointer' }}>Xóa</button>
              </div>
            </div>
          ))}
        </div>

        <div className="shop-cart-summary">
          <h2>Tóm tắt đơn hàng</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBlock: 16 }}>
            <span>Tạm tính ({items.length} món):</span>
            <strong>{money(totalAmount)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <span>Phí vận chuyển:</span>
            <span>Miễn phí</span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--shop-border)', marginBottom: 20 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, marginBottom: 24 }}>
            <span>Tổng cộng:</span>
            <strong style={{ color: 'var(--shop-primary)' }}>{money(totalAmount)}</strong>
          </div>
          <Link href="/checkout" className="shop-primary" style={{ display: 'block', textAlign: 'center', padding: 14 }}>
            Tiến hành đặt hàng →
          </Link>
        </div>
      </div>
    </>
  )
}

// ==========================================
// C05: CHECKOUT PAGE
// ==========================================
function CheckoutPage() {
  const { items, totalAmount, clearCart } = useCart()
  const { user } = useAuth()
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

  if (items.length === 0) {
    return (
      <div className="shop-state">
        <h2>Không có sản phẩm để thanh toán</h2>
        <Link href="/products" className="shop-primary">Quay lại mua sắm</Link>
      </div>
    )
  }

  async function handlePlaceOrder(e: FormEvent) {
    e.preventDefault()
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
      setError(err instanceof Error ? err.message : 'Đặt hàng không thành công. Vui lòng kiểm tra lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <nav className="shop-breadcrumb"><Link href="/">Trang chủ</Link> / <Link href="/cart">Giỏ hàng</Link> / <span>Đặt hàng</span></nav>
      <h1>Thông tin thanh toán & giao nhận</h1>
      {error && <div style={{ padding: 14, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, marginBottom: 20 }}>{error}</div>}

      <form onSubmit={handlePlaceOrder} className="shop-checkout-grid">
        <div className="shop-checkout-card">
          <h2><span>📍</span> Địa chỉ nhận hàng</h2>
          <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
            <label className="shop-checkout-field">Họ và tên người nhận
              <input required value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nguyễn Văn A" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <label className="shop-checkout-field">Số điện thoại
                <input required value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="0901234567" />
              </label>
              <label className="shop-checkout-field">Email nhận thông báo
                <input required type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="email@example.com" />
              </label>
            </div>
            <label className="shop-checkout-field">Địa chỉ chi tiết (Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành)
              <input required value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="59C Nguyễn Đình Chiểu, Phường Võ Thị Sáu, Quận 3, TP.HCM" />
            </label>
            <label className="shop-checkout-field">Ghi chú giao hàng (Tùy chọn)
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Giao giờ hành chính, gọi trước khi giao..." />
            </label>
          </div>

          <h2 style={{ marginTop: 32 }}><span>💳</span> Phương thức thanh toán</h2>
          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <label className={`shop-payment-option ${paymentMethod === 'COD' ? 'active' : ''}`}>
              <input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === 'COD'} onChange={() => setPaymentMethod('COD')} />
              <div>
                <strong>Thanh toán tiền mặt khi nhận hàng (COD)</strong>
                <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>Thanh toán trực tiếp cho nhân viên giao vận sau khi đồng kiểm bao bì sản phẩm</small>
              </div>
            </label>
            <label className={`shop-payment-option ${paymentMethod === 'BankTransfer' ? 'active' : ''}`}>
              <input type="radio" name="paymentMethod" value="BankTransfer" checked={paymentMethod === 'BankTransfer'} onChange={() => setPaymentMethod('BankTransfer')} />
              <div>
                <strong>Chuyển khoản ngân hàng / VNPay (Mô phỏng)</strong>
                <small style={{ display: 'block', color: '#64748b', marginTop: 2 }}>Quét mã QR VietQR hoặc chuyển khoản Internet Banking an toàn & bảo mật</small>
              </div>
            </label>
          </div>
        </div>

        <div className="shop-checkout-summary">
          <h2 style={{ fontSize: 18, marginTop: 0, marginBottom: 16 }}>Đơn hàng ({items.length} món)</h2>
          <div style={{ marginBlock: 16, maxHeight: 260, overflowY: 'auto' }}>
            {items.map(i => (
              <div key={i.sku} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.productName} (x{i.quantity})</span>
                <strong>{money(i.price * i.quantity)}</strong>
              </div>
            ))}
          </div>
          <div style={{ borderBlock: '1px solid var(--shop-border)', paddingBlock: 16, marginBottom: 16 }}>
            <label className="shop-field" htmlFor="promotion-code" style={{ marginBottom: 8, fontWeight: 700 }}>Mã khuyến mãi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="promotion-code"
                value={promotionInput}
                onChange={event => { setPromotionInput(event.target.value.toUpperCase()); if (promotion) setPromotion(null) }}
                disabled={promotionLoading}
                maxLength={50}
                placeholder="Nhập một mã"
                style={{ height: 42, borderRadius: 8 }}
              />
              {promotion ? (
                <button type="button" className="btn-secondary" onClick={removePromotion} style={{ borderRadius: 8, height: 42, paddingInline: 14 }}>Bỏ mã</button>
              ) : (
                <button type="button" onClick={applyPromotion} disabled={promotionLoading || !promotionInput.trim()} style={{ borderRadius: 8, height: 42, paddingInline: 16 }}>
                  {promotionLoading ? 'Đang kiểm tra…' : 'Áp dụng'}
                </button>
              )}
            </div>
            {promotionError && <p role="alert" style={{ color: '#b91c1c', fontSize: 13, marginTop: 8 }}>{promotionError}</p>}
            {promotion && <p role="status" style={{ color: '#15803d', fontSize: 13, marginTop: 8, fontWeight: 600 }}>Đã áp dụng {promotion.code}: {promotion.description}</p>}
            <small style={{ display: 'block', color: '#64748b', marginTop: 6 }}>Mỗi đơn hàng chỉ áp dụng một mã. Mã sẽ được kiểm tra lại khi đặt hàng.</small>
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>Tạm tính:</span><span>{money(promotion?.subtotal ?? totalAmount)}</span></div>
            {promotion && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d', fontSize: 14, fontWeight: 600 }}>
                <span>Giảm giá ({promotion.code}):</span><span>−{money(promotion.discountAmount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span>Phí vận chuyển:</span>
              <span style={{ color: '#15803d', fontWeight: 600 }}>Miễn phí (Toàn quốc)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, borderTop: '1px solid var(--shop-border)', paddingTop: 14, marginTop: 4 }}>
              <strong>Tổng tiền:</strong>
              <strong style={{ color: 'var(--shop-primary)', fontSize: 20 }}>{money(promotion?.totalAmount ?? totalAmount)}</strong>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="shop-primary" style={{ width: '100%', height: 46, fontSize: 16, fontWeight: 700, borderRadius: 8 }}>
            {submitting ? 'Đang tạo đơn & giữ tồn kho…' : 'Xác nhận Đặt hàng →'}
          </button>
        </div>
      </form>
    </>
  )
}

// ==========================================
// C06: ORDER RESULT PAGE
// ==========================================
function OrderResultPage({ orderCode }: { orderCode: string }) {
  const resource = useResource<Order>(`/orders/${orderCode}`)

  if (resource.error) return <NotFound />
  if (!resource.data) return <LoadingState />

  const order = resource.data
  return (
    <div style={{ maxWidth: 640, marginInline: 'auto', background: 'white', padding: 36, borderRadius: 14, border: '1px solid var(--shop-border)', textAlign: 'center', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.06)' }}>
      <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#dcfce7', color: '#15803d', display: 'grid', placeItems: 'center', fontSize: 34, margin: '0 auto 16px' }}>✓</div>
      <h1>Đặt hàng thành công!</h1>
      <p>Cảm ơn bạn đã mua sắm tại V-Pharma. Mã đơn hàng của bạn là:</p>
      <div style={{ background: '#edf4ff', padding: 14, borderRadius: 8, fontSize: 22, fontWeight: 800, color: 'var(--shop-primary)', marginBlock: 16 }}>
        {order.orderCode}
      </div>
      <p>Tổng thanh toán: <strong>{money(order.totalAmount)}</strong> ({order.paymentMethod})</p>
      <p style={{ color: '#64748b', fontSize: 13 }}>Địa chỉ giao hàng: {order.shippingAddress}</p>
      <div style={{ marginTop: 28, display: 'flex', gap: 14, justifyContent: 'center' }}>
        <Link href={`/account/orders/${order.orderCode}`} className="shop-primary">Xem chi tiết đơn hàng</Link>
        <Link href="/products" className="btn-secondary" style={{ padding: '10px 18px', borderRadius: 8, fontWeight: 600 }}>Tiếp tục mua sắm</Link>
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
    return (
      <div className="shop-state">
        <h2>Vui lòng đăng nhập</h2>
        <p>Bạn cần đăng nhập để theo dõi danh sách đơn hàng của mình.</p>
      </div>
    )
  }

  if (resource.error) return <ErrorState retry={resource.retry} />
  if (!resource.data) return <LoadingState />

  const rawOrders = resource.data
  const orders: Order[] = Array.isArray(rawOrders) ? rawOrders : (Array.isArray((rawOrders as { items?: Order[] })?.items) ? (rawOrders as { items: Order[] }).items : [])
  return (
    <>
      <nav className="shop-breadcrumb"><Link href="/">Trang chủ</Link> / <span>Đơn hàng của tôi</span></nav>
      <h1>Lịch sử đơn hàng</h1>
      {orders.length === 0 ? (
        <EmptyState>Bạn chưa có đơn hàng nào.</EmptyState>
      ) : (
        <div className="shop-table-wrapper">
          <table className="shop-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Ngày đặt</th>
                <th>Sản phẩm</th>
                <th>Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => (
                <tr key={order.id}>
                  <td><strong>{order.orderCode || `ORD-${order.id}`}</strong></td>
                  <td>{order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : ''}</td>
                  <td>{order.items?.map(i => `${i.productName} (${i.quantity})`).join(', ') || '-'}</td>
                  <td><strong>{money(order.totalAmount || 0)}</strong></td>
                  <td>{order.paymentMethod || 'COD'}</td>
                  <td>
                    <span className={`shop-badge badge-${(order.status || 'Pending').toLowerCase()}`}>
                      {order.status === 'Confirmed' ? 'Đã xác nhận' :
                       order.status === 'Shipped' ? 'Đang giao' :
                       order.status === 'Delivered' ? 'Đã giao' :
                       order.status === 'Cancelled' ? 'Đã hủy' : 'Chờ xác nhận'}
                    </span>
                  </td>
                  <td>
                    <Link href={`/account/orders/${order.orderCode}`} style={{ color: 'var(--shop-primary)', fontWeight: 600 }}>
                      Xem chi tiết →
                    </Link>
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
  const resource = useResource<Order>(`/orders/${orderCode}`)
  const [cancelModal, setCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [returnModal, setReturnModal] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [actionNotice, setActionNotice] = useState('')

  if (resource.error) return <NotFound />
  if (!resource.data) return <LoadingState />

  const order = resource.data

  async function handleCancel() {
    try {
      await postJson(`/orders/${order.id}/cancel`, { reason: cancelReason })
      setCancelModal(false)
      setActionNotice('Đã hủy đơn hàng và giải phóng lượng tồn kho giữ.')
      resource.retry()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể hủy đơn.')
    }
  }

  async function handleReturn() {
    try {
      await postJson('/me/returns', {
        orderId: order.id,
        reason: returnReason,
        items: order.items?.map(i => ({ orderItemId: i.id, quantity: i.quantity, note: '' })) || []
      })
      setReturnModal(false)
      setActionNotice('Đã tạo yêu cầu đổi/trả hàng. Vui lòng chờ nhân viên xét duyệt.')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể tạo yêu cầu đổi trả.')
    }
  }

  return (
    <>
      <nav className="shop-breadcrumb">
        <Link href="/">Trang chủ</Link> / <Link href="/account/orders">Đơn hàng của tôi</Link> / <span>{order.orderCode}</span>
      </nav>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Chi tiết đơn hàng {order.orderCode}</h1>
        <div>
          {order.status === 'Pending' || order.status === 'Confirmed' ? (
            <button className="btn-danger" onClick={() => setCancelModal(true)}>Hủy đơn hàng</button>
          ) : order.status === 'Delivered' ? (
            <button className="btn-secondary" onClick={() => setReturnModal(true)}>Yêu cầu Đổi/Trả hàng</button>
          ) : null}
        </div>
      </div>

      {actionNotice && <div style={{ padding: 14, background: '#dcfce7', color: '#15803d', borderRadius: 8, marginBottom: 20 }}>✓ {actionNotice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        <div>
          <div className="shop-table-wrapper" style={{ marginBottom: 24 }}>
            <table className="shop-table">
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
                    <td><strong>{i.productName}</strong><small style={{ display: 'block', color: '#64748b' }}>{i.variantName}</small></td>
                    <td>{i.sku}</td>
                    <td>{money(i.unitPrice)}</td>
                    <td>{i.quantity}</td>
                    <td><strong>{money(i.lineTotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Lịch sử trạng thái (Audit Trail)</h2>
          <div style={{ background: 'white', borderRadius: 12, padding: 20, border: '1px solid var(--shop-border)' }}>
            {order.timeline?.map((t, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 14, paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: 'var(--shop-primary)', fontWeight: 700 }}>●</span>
                <div>
                  <strong>{t.toStatus}</strong> (bởi {t.actor}) — <small>{new Date(t.createdAt).toLocaleString('vi-VN')}</small>
                  {t.note && <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>{t.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid var(--shop-border)', height: 'fit-content' }}>
          <h2>Thông tin giao nhận</h2>
          <p>Người nhận: <strong>{order.customerName}</strong></p>
          <p>Số điện thoại: <strong>{order.customerPhone}</strong></p>
          <p>Địa chỉ: <strong>{order.shippingAddress}</strong></p>
          <p>Thanh toán: <strong>{order.paymentMethod}</strong> ({order.paymentStatus})</p>
          <p>Trạng thái đơn: <span className={`shop-badge badge-${order.status.toLowerCase()}`}>{order.status}</span></p>
          <hr style={{ border: 0, borderTop: '1px solid var(--shop-border)', marginBlock: 16 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
            <span>Tổng thanh toán:</span>
            <strong style={{ color: 'var(--shop-primary)' }}>{money(order.totalAmount)}</strong>
          </div>
        </div>
      </div>

      {cancelModal && (
        <div className="shop-modal-backdrop" onClick={() => setCancelModal(false)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <h2>Xác nhận hủy đơn hàng</h2>
            <p>Hệ thống sẽ cập nhật trạng thái đơn thành 'Đã hủy' và tự động giải phóng tồn kho đã giữ.</p>
            <label className="shop-field">Lý do hủy
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Tôi đổi ý, đặt nhầm sản phẩm..." />
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn-danger" onClick={handleCancel}>Xác nhận hủy</button>
              <button className="btn-secondary" onClick={() => setCancelModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {returnModal && (
        <div className="shop-modal-backdrop" onClick={() => setReturnModal(false)}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <h2>Yêu cầu đổi / trả hàng</h2>
            <p>Quy trình sẽ tạo mã RMA và chuyển thông tin tới bộ phận CSKH để xử lý.</p>
            <label className="shop-field">Lý do đổi trả
              <textarea rows={3} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="Sản phẩm bị lỗi bao bì, giao sai quy cách..." />
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={handleReturn}>Gửi yêu cầu</button>
              <button className="btn-secondary" onClick={() => setReturnModal(false)}>Đóng</button>
            </div>
          </div>
        </div>
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

  if (!user) return <div className="shop-state"><h2>Vui lòng đăng nhập để xem yêu cầu</h2></div>

  async function handleSubmitTicket(e: FormEvent) {
    e.preventDefault()
    try {
      await postJson('/me/tickets', { subject, category, message })
      setSubject('')
      setMessage('')
      setNotice('Đã gửi ticket hỗ trợ thành công.')
      ticketsResource.retry()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể gửi ticket.')
    }
  }

  return (
    <>
      <nav className="shop-breadcrumb"><Link href="/">Trang chủ</Link> / <span>Yêu cầu hỗ trợ & Khiếu nại</span></nav>
      <h1>Hỗ trợ khách hàng</h1>

      {notice && <div style={{ padding: 14, background: '#dcfce7', color: '#15803d', borderRadius: 8, marginBottom: 20 }}>✓ {notice}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div style={{ background: 'white', padding: 24, borderRadius: 12, border: '1px solid var(--shop-border)' }}>
          <h2>Gửi yêu cầu mới</h2>
          <form onSubmit={handleSubmitTicket} style={{ display: 'grid', gap: 14, marginTop: 14 }}>
            <label className="shop-field">Phân loại
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option value="Order">Vấn đề đơn hàng</option>
                <option value="Product">Tư vấn sản phẩm</option>
                <option value="Shipping">Vận chuyển / Giao nhận</option>
                <option value="Return">Đổi trả / Bảo hành</option>
                <option value="General">Khác</option>
              </select>
            </label>
            <label className="shop-field">Tiêu đề
              <input required value={subject} onChange={e => setSubject(e.target.value)} placeholder="Tóm tắt yêu cầu cần giải quyết..." />
            </label>
            <label className="shop-field">Nội dung chi tiết
              <textarea required rows={4} value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả cụ thể sự cố hoặc câu hỏi..." />
            </label>
            <button type="submit">Gửi yêu cầu</button>
          </form>
        </div>

        <div>
          <h2>Danh sách yêu cầu đã gửi</h2>
          {ticketsResource.data?.length === 0 ? <EmptyState>Bạn chưa có yêu cầu hỗ trợ nào.</EmptyState> : (
            <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
              {ticketsResource.data?.map(t => (
                <div key={t.id} style={{ background: 'white', padding: 18, borderRadius: 10, border: '1px solid var(--shop-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{t.ticketCode}</strong>
                    <span className="shop-badge badge-pending">{t.status}</span>
                  </div>
                  <h3 style={{ marginBlock: 8, fontSize: 16 }}>{t.subject}</h3>
                  <small style={{ color: '#64748b' }}>Phân loại: {t.category} · {new Date(t.createdAt).toLocaleDateString('vi-VN')}</small>
                </div>
              ))}
            </div>
          )}
        </div>
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
                        <td>{o.paymentMethod}</td>
                        <td><span className={`shop-badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
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

  const orderResultMatch = /^\/checkout\/result\/([^/]+)$/.exec(path)
  const orderResultCode = orderResultMatch ? decodeURIComponent(orderResultMatch[1]) : ''

  const orderDetailMatch = /^\/account\/orders\/([^/]+)$/.exec(path)
  const orderDetailCode = orderDetailMatch ? decodeURIComponent(orderDetailMatch[1]) : ''

  return (
    <CustomerLayout categories={categories.data || []} query={params.get('q') || ''}>
      {categories.error && <ErrorState retry={categories.retry} />}
      {!categories.data && !categories.error && <LoadingState />}
      {path === '/' ? <HomePage categories={categories.data || []} /> :
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
