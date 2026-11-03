# Danh sách Vấn đề & Quyết định còn tồn tại (Remaining Issues)

Tài liệu này ghi nhận các vấn đề nghiệp vụ, chính sách kỹ thuật cần làm rõ hoặc quyết định an toàn được đưa ra trong quá trình phát triển hệ thống KTHT E-commerce.

---

## 1. Các quyết định kỹ thuật an toàn được áp dụng (Safe Defaults)

1. **Cơ chế Xác thực (Authentication):**
   - *Vấn đề:* Dự án chưa có hệ thống OAuth2/OpenID Connect bên ngoài.
   - *Giải pháp an toàn:* Sử dụng cơ chế mã hóa mật khẩu chuẩn PBKDF2/HMACSHA256 với Salt ngẫu nhiên 128-bit kết hợp JWT Token (hoặc Session Cookie HTTP-only) cho cả Khách hàng và Nhân viên. Đảm bảo không lưu mật khẩu thô trong database.
2. **Quản lý Giỏ hàng (Cart Persistence):**
   - *Vấn đề:* Có cần lưu giỏ hàng trong database cho khách vãng lai không?
   - *Giải pháp an toàn:* Sử dụng Client-side Cart (LocalStorage) cho khách chưa đăng nhập / đang mua sắm; khi tiến hành thanh toán (Checkout), Backend sẽ kiểm tra lại toàn bộ trạng thái sản phẩm, đơn giá và tính khả dụng để chống gian lận giá.
3. **Mã đơn hàng duy nhất (Order Code):**
   - *Giải pháp an toàn:* Sinh mã đơn có cấu trúc `ORD-yyyyMMdd-XXXXX` kết hợp ràng buộc duy nhất (`UNIQUE INDEX`) trên SQL Server để đảm bảo truy vết và không trùng lặp.
4. **Tồn kho ban đầu cho 132 sản phẩm Pharmacity:**
   - *Vấn đề:* File CSV không chứa số lượng tồn kho.
   - *Giải pháp an toàn:* Để hệ thống có thể demo bán hàng và giữ hàng thực tế theo đúng công thức $P, Q, B, R, A, U$, khi khởi tạo số dư kho (`InventoryBalances`), hệ thống sẽ nạp tồn vật lý thực tế $P = 100$, tồn an toàn $B = 10$, $Q = 0, R = 0, A = 0 \to U = 90$ cho mỗi SKU đang hoạt động, có ghi nhãn rõ ràng là dữ liệu nạp ban đầu cho demo.

---

## 2. Nhật ký vấn đề đang theo dõi

| ID | Vấn đề | Tác động | Trạng thái | Hướng xử lý |
| :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | Cổng thanh toán thực tế (VNPAY / MoMo / Stripe) | Không thể xử lý tiền thật | Giữ ở chế độ Mô phỏng (Simulated) | Cung cấp phương thức COD (Tiền mặt khi nhận hàng) và Chuyển khoản ngân hàng mô phỏng. |
| **ISSUE-02** | Đơn vị vận chuyển thực tế (GHTK / GHN) | Không có webhook trạng thái thật | Mô phỏng qua Admin Fulfillment | Warehouse xác nhận xuất kho và chuyển trạng thái giao hàng trong màn hình Admin. |
| **ISSUE-03** | API sàn TMĐT (Shopee / Lazada) | Không có kết nối sandbox trực tiếp | Mock Adapter | Cung cấp màn hình Simulator (A27) để phát sự kiện đơn sàn nhằm kiểm chứng chuyển động $A \to R$. |

