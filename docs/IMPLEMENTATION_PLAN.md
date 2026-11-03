# Kế hoạch Triển khai Chi tiết (Implementation Plan)

**Mục tiêu:** Hiện thực hóa toàn bộ 10 module nghiệp vụ của dự án KTHT E-commerce, kết nối trọn vẹn Front-end → Back-end Web API → SQL Server cục bộ (`KTHT_Ecom_Dev`).

---

## 1. Nguyên tắc triển khai và Trách nhiệm vai trò (Role Mapping)

Tuân thủ nghiêm ngặt theo [`AGENTS.md`](../AGENTS.md):
- **Software Architect (SA):** Xác định ranh giới entity, API contract, cơ chế xác thực JWT/Cookie, Idempotency.
- **Database Engineer (DB):** Thiết kế bảng quan hệ (Foreign Keys, Indexes, Constraints), EF Core Migrations, Transaction boundaries.
- **Backend Engineer (BE):** Xây dựng Minimal APIs, Application Services, Domain Business Logic, bảo vệ concurrency trên SQL Server.
- **Frontend Engineer (FE):** Xây dựng các trang UI, Modal/Drawer, Form validation, trạng thái Loading/Empty/Error/Success.
- **Business Analyst (BA) & Domain Logic Reviewer (DR):** Kiểm tra tính nhất quán quy tắc nghiệp vụ ($P, Q, B, R, A, U$, hủy một phần, đổi trả có kiểm định QC).
- **QA & Security Reviewer (QA/SEC):** Viết và chạy unit tests, integration tests, E2E headless verification, kiểm tra ma trận phân quyền RBAC.

---

## 2. Kế hoạch Sprint

### Sprint 1: Foundation (Xác thực, Phân quyền & Mở rộng Catalog)
1. **DB & Domain:**
   - Tạo thực thể `User`, `Role`, `UserRole`, `CustomerAddress`.
   - Cung cấp seed tài khoản chuẩn:
     - `admin@ktht.local` (Role: Admin)
     - `sales@ktht.local` (Role: Sales)
     - `warehouse@ktht.local` (Role: Warehouse)
     - `support@ktht.local` (Role: CustomerSupport)
     - `customer@ktht.local` (Role: Customer)
   - Lưu trữ mật khẩu an toàn bằng `HMACSHA256` hoặc `PBKDF2` với Salt duy nhất.
2. **BE API:**
   - `POST /api/auth/register`: Đăng ký tài khoản khách hàng.
   - `POST /api/auth/login`: Xác thực và trả về JWT Bearer Token + thông tin User / Roles.
   - `GET /api/auth/me`: Lấy thông tin phiên hiện tại.
   - Mở rộng `GET /api/products`: Thêm query parameter `brand` và trả về `BrandItem`.
   - `GET /api/brands`: Danh sách thương hiệu để hiển thị bộ lọc.
3. **FE:**
   - `AuthContext`: Quản lý token, người dùng đăng nhập, quyền hạn.
   - Modal / Màn hình Đăng nhập (`/login`) & Đăng ký (`/register`).
   - Header hiển thị tên người dùng đã đăng nhập hoặc nút Đăng nhập / Đăng ký.
   - Thêm dropdown chọn Thương hiệu trên `FilterBar`.

---

### Sprint 2: Core Commerce (Quản lý sản phẩm, Giỏ hàng, Đặt hàng & Tra cứu đơn)
1. **DB & Domain:**
   - Thực thể `Order`, `OrderItem`, `OrderStatusHistory`.
   - Snapshot giá, tên sản phẩm, SKU tại thời điểm đặt.
   - Bảng `ProductAudit` / Cột `IsDeleted` cho Soft Delete sản phẩm.
2. **BE API:**
   - `POST /api/cart/validate`: Kiểm tra tính hợp lệ của giỏ hàng (tồn tại, giá mới nhất, đang hoạt động).
   - `POST /api/orders`: Tạo đơn hàng (yêu cầu header `Idempotency-Key`), tự động sinh mã đơn dạng `ORD-yyyyMMdd-XXXX`.
   - `GET /api/me/orders`: Danh sách đơn của khách hàng đang đăng nhập.
   - `GET /api/me/orders/{id}`: Chi tiết đơn hàng.
   - Admin Product APIs:
     - `POST /api/admin/products`: Tạo mới sản phẩm & biến thể.
     - `PUT /api/admin/products/{id}`: Cập nhật sản phẩm.
     - `DELETE /api/admin/products/{id}`: Ẩn hoặc xóa mềm sản phẩm.
3. **FE:**
   - `CartContext`: Lưu trữ giỏ hàng ở LocalStorage, đồng bộ và hiển thị số lượng trên Header.
   - Trang Giỏ hàng (`/cart` — C04): Tăng/giảm số lượng, xóa sản phẩm, tính tổng tiền.
   - Trang Đặt hàng (`/checkout` — C05): Nhập địa chỉ giao hàng, phương thức thanh toán (COD / Chuyển khoản mô phỏng), ghi chú.
   - Trang Kết quả đơn hàng (`/checkout/result/:orderId` — C06).
   - Trang Đơn hàng của tôi (`/account/orders` — C10 & `/account/orders/:id` — C11).
   - Trang Quản trị Sản phẩm (`/admin/products` — A02 & Form A03).

---

### Sprint 3: Inventory & Fulfillment (Tồn kho chuẩn $P, Q, B, R, A, U$ & Xuất kho)
1. **DB & Domain:**
   - Bảng `InventoryBalance` (SKU, Kho, P, Q, B, R, A).
   - Bảng `InventoryReservation` (OrderId, OrderItemId, SKU, Quantity, Status: Active/Released/Fulfilled, ExpireAt).
   - Bảng `InventoryLedger` (Mã giao dịch, SKU, Loại biến động, Thay đổi, Số dư sau biến động, Lý do, Người thực hiện).
2. **BE API & Business Logic:**
   - Tích hợp giữ hàng nguyên tử: Khi `POST /api/orders` thành công $\rightarrow$ Tạo `InventoryReservation` và tăng `R` trong cùng 1 Transaction DB. Nếu $U = P - Q - B - R - A < \text{Số lượng yêu cầu}$, transaction tự động Rollback và trả về lỗi `409 Conflict`.
   - `POST /api/orders/{id}/cancel`: Khách hàng hoặc Sales hủy đơn khi đơn chưa xuất kho $\rightarrow$ Giải phóng reservation: giảm `R`, tăng lại `U`, cập nhật đơn sang `Cancelled`.
   - `POST /api/admin/orders/{id}/confirm`: Sales xác nhận đơn hàng $\rightarrow$ Trạng thái `Confirmed`.
   - `POST /api/admin/orders/{id}/fulfill`: Warehouse xuất kho $\rightarrow$ Giảm `P` và giảm `R` tương ứng, ghi nhận vào `InventoryLedger`, cập nhật đơn sang `Shipped`.
   - `GET /api/admin/inventory`: Xem danh sách tồn kho vật lý $P$, cách ly $Q$, an toàn $B$, đã giữ $R$, quota kênh $A$, khả dụng $U$.
3. **FE:**
   - Màn hình Quản trị Tồn kho (`/admin/inventory` — A09).
   - Màn hình Quản trị Đơn hàng (`/admin/orders` — A05 & `/admin/orders/:id` — A06): Thao tác Xác nhận, Hủy, Xuất kho theo đúng State Machine.

---

### Sprint 4: Advanced Business Processes (Đổi trả, Bảo hành, CSKH & Đa kênh)
1. **DB & Domain:**
   - Bảng `ReturnRequest`, `ReturnItem` (OrderId, Reason, Status: Pending/Approved/Inspected/Rejected/Refunded, QCResult: Passed/Failed).
   - Bảng `SupportTicket`, `TicketMessage` (CustomerId, Subject, Category, Priority, Status, AssigneeId).
   - Bảng `SalesChannel`, `ChannelAllocation` (Kênh bán, Quota phân bổ $A$).
2. **BE API:**
   - `POST /api/me/returns`: Khách hàng gửi yêu cầu đổi/trả cho các đơn đã giao thành công.
   - `POST /api/admin/returns/{id}/qc`: Nhân viên kho kiểm định hàng hoàn $\rightarrow$ Nếu đạt chuẩn (Passed): nhập lại tồn bán được ($Q - n, U + n$); Nếu hỏng (Failed): xuất hủy ($P - n, Q - n$).
   - `POST /api/admin/returns/{id}/refund`: Hoàn tất hoàn tiền theo chứng từ.
   - `POST /api/me/tickets` & `GET /api/admin/tickets`: Tiếp nhận và xử lý khiếu nại/hỗ trợ khách hàng.
   - `POST /api/integrations/channel-orders`: Endpoint mô phỏng nhận đơn từ sàn TMĐT (Shopee/Lazada) tiêu thụ quota $A \to R$ nguyên tử.
3. **FE:**
   - Giao diện gửi yêu cầu Đổi trả & Hỗ trợ trong tài khoản khách hàng (`/account/requests` — C12).
   - Giao diện Quản trị Đổi trả (`/admin/returns` — A17 & A18).
   - Giao diện Quản trị Ticket CSKH (`/admin/support` — A21 & A22).
   - Giao diện Quản trị Kênh bán & Quota (`/admin/channels` — A13).

---

### Sprint 5: Dashboard, Verification & Đóng gói
1. **BE API:**
   - `GET /api/admin/dashboard`: Thống kê tổng hợp thời gian thực từ CSDL: Doanh thu thực tế, Số đơn hàng theo trạng thái, Top sản phẩm bán chạy, Cảnh báo tồn kho thấp ($U \le B$).
2. **FE:**
   - Dashboard Quản trị hoàn chỉnh (`/admin` — A01) với biểu đồ và bảng chỉ số thực tế.
3. **Kiểm thử & Báo cáo:**
   - Chạy regression test: Catalog checks, API test suite, E2E headless verification.
   - Cập nhật toàn bộ tài liệu nghiệm thu.

