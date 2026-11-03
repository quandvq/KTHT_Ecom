export interface Category { id: number; name: string; slug: string }
export interface Brand { id: number; name: string; slug: string }

export interface Product {
  id: number
  name: string
  slug: string
  sku: string
  price: number
  imageUrl: string | null
  category: Category
  brand?: Brand | null
  packageSize?: string | null
  saleUnit?: string | null
  currency?: string
  isFeatured: boolean
}

export interface ProductPage { items: Product[]; page: number; pageSize: number; totalCount: number }
export interface Variant { id: number; sku: string; name: string; price: number; imageUrl: string | null; isActive: boolean }
export interface ProductDetail {
  id: number
  name: string
  slug: string
  description: string
  imageUrl: string | null
  category: Category
  brand?: Brand | null
  packageSize?: string | null
  saleUnit?: string | null
  currency?: string
  variants: Variant[]
}

export interface User {
  id: number
  email: string
  fullName: string
  role: string
  phoneNumber?: string | null
}

export interface UserAddress {
  recipientName: string
  phoneNumber: string
  streetAddress: string
  ward?: string | null
  district?: string | null
  city: string
}

export interface CartItem {
  sku: string
  productId: number
  productName: string
  variantName: string
  imageUrl: string | null
  price: number
  quantity: number
}

export interface OrderItem {
  id: number
  productId: number
  productName: string
  variantName?: string | null
  sku: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface OrderTimeline {
  fromStatus: string
  toStatus: string
  actor: string
  note?: string | null
  createdAt: string
}

export interface Order {
  id: number
  orderCode: string
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  paymentMethod: string
  paymentStatus: string
  status: string
  totalAmount: number
  note?: string | null
  createdAt: string
  items?: OrderItem[]
  timeline?: OrderTimeline[]
  itemCount?: number
}

export interface InventoryBalance {
  id: number
  sku: string
  warehouseCode: string
  p: number
  q: number
  b: number
  r: number
  a: number
  availableStock: number
  isLowStock: boolean
}

export interface ReturnItem {
  id: number
  sku: string
  quantity: number
  unitPrice: number
  qcStatus: string
  note?: string | null
}

export interface ReturnRequest {
  id: number
  returnCode: string
  orderCode: string
  reason: string
  status: string
  qcResult?: string | null
  refundAmount: number
  createdAt: string
  items: ReturnItem[]
}

export interface SupportTicketMessage {
  id: number
  senderName: string
  senderRole: string
  message: string
  createdAt: string
}

export interface SupportTicket {
  id: number
  ticketCode: string
  customerName: string
  customerEmail: string
  subject: string
  category: string
  priority: string
  status: string
  relatedOrderId?: number | null
  createdAt: string
  messages?: SupportTicketMessage[]
}

export interface DashboardStats {
  totalProducts: number
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  shippedOrders: number
  deliveredOrders: number
  cancelledOrders: number
  lowStockAlerts: number
  pendingReturns: number
  openTickets: number
  recentOrders: Array<{
    id: number
    orderCode: string
    customerName: string
    totalAmount: number
    status: string
    createdAt: string
  }>
}

export class ApiError extends Error {
  constructor(public status: number, message: string = 'Không thể tải dữ liệu. Vui lòng thử lại.') {
    super(message)
  }
}

export function safeStorageGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key)
    }
  } catch { /* ignore in non-browser/test environment */ }
  return null
}

export function safeStorageSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value)
    }
  } catch { /* ignore in non-browser/test environment */ }
}

export function safeStorageRemove(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key)
    }
  } catch { /* ignore in non-browser/test environment */ }
}

function getAuthHeader(): Record<string, string> {
  const token = safeStorageGet('ktht_auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const authHeader = getAuthHeader()
  const init: RequestInit = { signal }
  if (Object.keys(authHeader).length > 0) {
    init.headers = authHeader
  }
  const response = await fetch(`${apiBase}${path}`, init)
  if (!response.ok) {
    const errorJson = await response.json().catch(() => null)
    throw new ApiError(response.status, errorJson?.message || errorJson?.detail || 'Không thể tải dữ liệu. Vui lòng thử lại.')
  }
  return response.json() as Promise<T>
}

export async function postJson<T>(path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    const errorJson = await response.json().catch(() => null)
    throw new ApiError(response.status, errorJson?.message || errorJson?.detail || 'Thao tác không thành công.')
  }
  return response.json() as Promise<T>
}

export async function putJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'PUT',
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    const errorJson = await response.json().catch(() => null)
    throw new ApiError(response.status, errorJson?.message || errorJson?.detail || 'Thao tác không thành công.')
  }
  return response.json() as Promise<T>
}

export async function deleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader(), Accept: 'application/json' }
  })
  if (!response.ok) {
    const errorJson = await response.json().catch(() => null)
    throw new ApiError(response.status, errorJson?.message || errorJson?.detail || 'Thao tác không thành công.')
  }
  return response.json() as Promise<T>
}
