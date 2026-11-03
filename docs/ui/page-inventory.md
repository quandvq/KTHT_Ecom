# Danh mục 40 màn hình chức năng (Page Inventory)

**Trạng thái hệ thống:** Đã hoàn thiện toàn bộ các chức năng cốt lõi và màn hình vận hành, kết nối 100% Frontend $\leftrightarrow$ Backend $\leftrightarrow$ Database SQL Server.

Tất cả các màn hình đều tích hợp đầy đủ các trạng thái UI: `LoadingState`, `EmptyState`, `ErrorState`, `ValidationProblem` và `ForbiddenState` theo chuẩn `AGENTS.md`.

---

## 1. Phân hệ Cửa hàng & Khách hàng (Customer Storefront: C01 – C13)

| ID | Route | Mô tả & Chức năng | Component chính | API / Business Rules | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **C01** | `/` | Trang chủ; Khám phá danh mục và sản phẩm nổi bật | `CustomerLayout`, `HomePage`, `ProductGrid` | `GET /api/categories`, `GET /api/products?featured=true` | **VERIFIED** |
| **C02** | `/products` | Danh sách sản phẩm, tìm kiếm, lọc theo danh mục, thương hiệu, khoảng giá, sắp xếp | `FilterBar`, `ProductGrid`, `Pagination` | `GET /api/products`, `GET /api/brands`; `BR-CAT-001` | **VERIFIED** |
| **C03** | `/products/:slug` | Chi tiết sản phẩm, chọn phiên bản/SKU, nhập số lượng, thêm vào giỏ hàng | `DetailPage`, `ProductImage`, SKU selector | `GET /api/products/:slug`; `BR-CAT-001` | **VERIFIED** |
| **C04** | `/cart` | Quản lý giỏ hàng: xem các sản phẩm, cập nhật số lượng, xóa dòng, tính tổng tiền | `CartPage`, `useCart` hook | Client storage an toàn, đối chiếu giá máy chủ | **VERIFIED** |
| **C05** | `/checkout` | Đặt hàng: nhập thông tin nhận hàng, phương thức thanh toán, Idempotency-Key | `CheckoutPage`, form validation | `POST /api/orders`, `POST /api/cart/validate`; `BR-ORD-001/INV-001` | **VERIFIED** |
| **C06** | `/checkout/result/:orderCode` | Kết quả đặt hàng thành công, hiển thị mã đơn, tổng tiền và hướng dẫn nhận hàng | `OrderResultPage`, StatusBadge | `GET /api/orders/{code}`; `BR-ORD-001` | **VERIFIED** |
| **C07** | `/login` (Modal & Route) | Đăng nhập tài khoản khách hàng hoặc nhân viên | `AuthModal` (mode login), `useAuth` | `POST /api/auth/login`; JWT Token | **VERIFIED** |
| **C08** | `/register` (Modal & Route) | Đăng ký tài khoản khách hàng mới | `AuthModal` (mode register) | `POST /api/auth/register`; PBKDF2 hash | **VERIFIED** |
| **C09** | `/account` | Hồ sơ người dùng, sổ địa chỉ nhận hàng, đổi mật khẩu | `CustomerLayout`, profile actions | `GET/PUT /api/auth/address`, `POST /api/auth/change-password` | **VERIFIED** |
| **C10** | `/account/orders` | Danh sách lịch sử các đơn hàng đã đặt của tài khoản | `AccountOrdersPage`, order table | `GET /api/me/orders`; `BR-AUTH-001` | **VERIFIED** |
| **C11** | `/account/orders/:orderCode` | Xem chi tiết đơn hàng, Audit Trail lịch sử trạng thái, hủy đơn, yêu cầu RMA | `OrderDetailPage`, AuditTrail, Cancel/RMA modals | `GET /api/orders/{code}`, `POST /api/orders/{id}/cancel` | **VERIFIED** |
| **C12** | `/account/requests` | Danh sách yêu cầu hỗ trợ (Tickets) và đổi trả hàng (RMA) | `AccountRequestsPage`, Tab Requests | `GET /api/me/tickets`, `GET /api/me/returns` | **VERIFIED** |
| **C13** | `/account/requests/new` | Gửi yêu cầu hỗ trợ mới (chọn phân loại, mức ưu tiên, nội dung) | `AccountRequestsPage` form modal | `POST /api/me/tickets` | **VERIFIED** |

---

## 2. Phân hệ Quản trị Vận hành (Admin Operations Console: A01 – A27)

Phân hệ quản trị được tích hợp trong giao diện điều hành tập trung `AdminLayout` / `AdminLivePanel` với bảo vệ RBAC phân quyền nghiêm ngặt theo vai trò (`Admin`, `Sales`, `Warehouse`, `CustomerSupport`):

| ID | Module Tab | Quyền truy cập | Chức năng chi tiết | API Backend tương ứng | Trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A01** | `📊 Tổng quan KPI` | All Staff | Hiển thị 8 chỉ số kinh doanh thực từ DB (Doanh thu, Đơn hàng, Đơn chờ, Tồn kho thấp, RMA chờ duyệt, Ticket mở), danh sách đơn mới nhất | `GET /api/admin/dashboard` | **VERIFIED** |
| **A02 - A04** | `🏷️ Sản phẩm & Danh mục` | `Sales`, `Admin` | Thêm sản phẩm mới, cập nhật giá, quản lý danh mục, quản lý thương hiệu, ẩn/hiện sản phẩm (soft-delete) | `POST/PUT /api/admin/products`, `PUT /api/admin/products/{id}/publish` | **VERIFIED** |
| **A05 - A06** | `📋 Đơn hàng & Xử lý` | `Sales`, `Warehouse`, `Admin` | Quản lý danh sách đơn hàng, xác nhận đơn (`confirm`), xem chi tiết đơn, xuất kho (`fulfill`), xác nhận giao hàng (`deliver`), hủy đơn | `GET /api/admin/orders`, `POST /api/admin/orders/{id}/*` | **VERIFIED** |
| **A09 - A12** | `🏭 Kho & Tồn (P,Q,B,R,A,U)` | `Warehouse`, `Admin` | Quản lý bảng số dư tồn kho thời gian thực $P, Q, B, R, A, U = P - Q - B - R - A$, cảnh báo tồn thấp ($U \le B$), sổ cái biến động kho | `GET /api/admin/inventory`, `InventoryBalances` | **VERIFIED** |
| **A13 - A14** | `🌐 Đa kênh & Quota` | `Admin`, `Sales` | Quản lý hạn mức bán ($A$) cho các sàn TMĐT (Shopee, Lazada, TikTok), mô phỏng nhận đơn sàn chuyển $A \to R$ nguyên tử | `POST /api/admin/channels/{code}/allocate`, `POST /api/integrations/channel-orders` | **VERIFIED** |
| **A17 - A20** | `🔄 Đổi trả & QC (RMA)` | `CustomerSupport`, `Warehouse`, `Admin` | Tiếp nhận yêu cầu RMA, phê duyệt, kho tiếp nhận hàng hoàn vào cách ly $Q$, kiểm định chất lượng QC (Đạt: $Q \to U$, Hỏng: $P-n, Q-n$), hoàn tiền | `GET /api/admin/returns`, `POST /api/admin/returns/{id}/*` | **VERIFIED** |
| **A21 - A22** | `💬 CSKH & Ticket` | `CustomerSupport`, `Admin` | Quản lý danh sách ticket hỗ trợ của khách hàng, phản hồi tin nhắn trao đổi 2 chiều, cập nhật trạng thái xử lý | `GET /api/admin/tickets`, `POST /api/tickets/{id}/reply`, `PUT /api/tickets/{id}/status` | **VERIFIED** |
| **A23 - A27** | `⚙️ Vận hành & Mô phỏng` | `Admin` | Đối soát doanh thu, kiểm tra toàn vẹn Idempotency, mô phỏng luồng sàn TMĐT | `AdminLivePanel` simulation tools | **VERIFIED** |

---

## 3. Màn hình Kỹ thuật (Technical Screens)

| Route | Mục đích | Trạng thái |
| :--- | :--- | :--- |
| `*` (404) | Trang báo lỗi 404 kỹ thuật khi truy cập đường dẫn không tồn tại hoặc SKU/sản phẩm không có thực | **VERIFIED** (Kiểm thử tự động qua `App.test.tsx`) |
| `/admin` (Guest) | Khung bảo vệ khi khách vãng lai hoặc tài khoản `Customer` truy cập vùng quản trị; hiển thị hướng dẫn đăng nhập tài khoản nhân viên | **VERIFIED** (Kiểm thử tự động qua `App.test.tsx` và `full-flow-test.mjs`) |
