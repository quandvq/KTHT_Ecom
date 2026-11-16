// Bảng ánh xạ trạng thái tập trung (DESIGN.md: Status Badge là cách duy nhất hiển thị trạng thái).
// Giá trị gốc lấy từ backend (Order.Status, Order.PaymentStatus, ReturnRequest.Status, SupportTicket.Status).

export type StatusTone = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'qc' | 'neutral'
// term: thuật ngữ nghiệp vụ hiển thị ở dòng phụ (người dùng chốt 2026-11-13: lời khách trước, thuật ngữ sau).
export type StatusMeta = { label: string; tone: StatusTone; term?: string }

const orderStatus: Record<string, StatusMeta> = {
  New: { label: 'Mới tạo', tone: 'neutral' },
  Pending: { label: 'Chờ xác nhận', tone: 'pending' },
  Confirmed: { label: 'Đã xác nhận', tone: 'confirmed' },
  Shipped: { label: 'Đã xuất kho · Đang giao', tone: 'shipped' },
  Delivered: { label: 'Đã giao', tone: 'delivered' },
  Cancelled: { label: 'Đã hủy', tone: 'cancelled' }
}

const paymentStatus: Record<string, StatusMeta> = {
  Pending: { label: 'Chưa thanh toán', tone: 'pending', term: 'Chờ đối soát' },
  Paid: { label: 'Đã thanh toán', tone: 'delivered' },
  Refunded: { label: 'Đã hoàn tiền', tone: 'qc' },
  Failed: { label: 'Thanh toán lỗi', tone: 'cancelled' }
}

const returnStatus: Record<string, StatusMeta> = {
  Requested: { label: 'Chờ duyệt đổi trả', tone: 'pending' },
  Approved: { label: 'Đã duyệt · Chờ gửi hàng', tone: 'confirmed' },
  Received: { label: 'Đã nhận hàng trả · Đang kiểm tra chất lượng', tone: 'shipped', term: 'Nghiệp vụ: nhập khu cách ly, chờ kiểm định' },
  QC_Completed: { label: 'Đã kiểm tra chất lượng · Chờ hoàn tiền', tone: 'qc', term: 'Nghiệp vụ: kiểm định hoàn tất' },
  Rejected: { label: 'Bị từ chối', tone: 'cancelled' },
  Refunded: { label: 'Đã hoàn tiền', tone: 'delivered' }
}

const ticketStatus: Record<string, StatusMeta> = {
  Open: { label: 'Mới gửi', tone: 'pending' },
  InProgress: { label: 'Đang xử lý', tone: 'confirmed' },
  Resolved: { label: 'Đã giải quyết', tone: 'delivered' },
  Closed: { label: 'Đã đóng', tone: 'neutral' }
}

const paymentMethod: Record<string, string> = {
  COD: 'Tiền mặt khi nhận hàng (COD)',
  BankTransfer: 'Chuyển khoản (mô phỏng)'
}

const ticketCategory: Record<string, string> = {
  Order: 'Vấn đề đơn hàng',
  Product: 'Tư vấn sản phẩm',
  Shipping: 'Vận chuyển / Giao nhận',
  Return: 'Đổi trả / Bảo hành',
  General: 'Khác'
}

function lookup(map: Record<string, StatusMeta>, value: string | null | undefined): StatusMeta {
  if (!value) return { label: 'Chưa rõ', tone: 'neutral' }
  // Giá trị lạ vẫn hiển thị nguyên văn để không che dữ liệu backend.
  return map[value] ?? { label: value, tone: 'neutral' }
}

export const orderStatusMeta = (value?: string | null) => lookup(orderStatus, value)
export const paymentStatusMeta = (value?: string | null) => lookup(paymentStatus, value)
export const returnStatusMeta = (value?: string | null) => lookup(returnStatus, value)
export const ticketStatusMeta = (value?: string | null) => lookup(ticketStatus, value)
export const paymentMethodLabel = (value?: string | null) => (value && paymentMethod[value]) || value || 'Chưa rõ'
export const ticketCategoryLabel = (value?: string | null) => (value && ticketCategory[value]) || value || 'Khác'
export const ticketCategories = Object.entries(ticketCategory)

export type Availability = 'InStock' | 'LowStock' | 'OutOfStock'
const availability: Record<Availability, StatusMeta> = {
  InStock: { label: 'Còn hàng', tone: 'delivered' },
  LowStock: { label: 'Sắp hết hàng', tone: 'pending' },
  OutOfStock: { label: 'Hết hàng', tone: 'cancelled' }
}
export const availabilityMeta = (value?: string | null): StatusMeta | null =>
  value && value in availability ? availability[value as Availability] : null
