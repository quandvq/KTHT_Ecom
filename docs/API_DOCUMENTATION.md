# Tài liệu Đặc tả API Hệ thống KTHT E-commerce (API Documentation)

**Phiên bản API:** v1.0.0 (Minimal APIs, .NET 10)  
**Base URL:** `http://localhost:5080/api` (hoặc `http://127.0.0.1:5080/api`)  
**Định dạng dữ liệu:** JSON (`application/json`)  
**Chuẩn mã hóa ký tự:** UTF-8  

---

## 1. Cơ chế Xác thực & Phân quyền (Authentication & Authorization)

Hệ thống sử dụng **JSON Web Token (JWT)** qua tiêu đề HTTP `Authorization`:
```http
Authorization: Bearer <TOKEN>
```

| Role | Quyền hạn & Phạm vi truy cập |
| :--- | :--- |
| `Customer` | Đăng ký, đăng nhập, xem catalog, đặt hàng, xem đơn của mình, yêu cầu RMA, gửi ticket CSKH |
| `Sales` | Quản lý sản phẩm, danh mục, thương hiệu, xác nhận đơn hàng, xem dashboard |
| `Warehouse` | Quản lý tồn kho, xuất kho (fulfill), giao hàng (deliver), nhận hàng hoàn vào cách ly $Q$ |
| `CustomerSupport`| Tiếp nhận và phản hồi Ticket hỗ trợ, duyệt/từ chối yêu cầu đổi trả RMA |
| `Admin` | Toàn quyền trên mọi module: cấu hình hệ thống, phân bổ quota đa kênh, hoàn tiền (refund) |

---

## 2. Danh mục Endpoint theo từng Module

### MODULE 1 — AUTHENTICATION & PROFILE

#### 1.1. Đăng ký khách hàng mới
- **Endpoint:** `POST /api/auth/register`
- **Quyền:** Public
- **Request Body:**
  ```json
  {
    "email": "customer@ktht.local",
    "password": "Password@123",
    "fullName": "Nguyễn Văn A",
    "phoneNumber": "0901234567"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "email": "customer@ktht.local",
      "fullName": "Nguyễn Văn A",
      "role": "Customer",
      "phoneNumber": "0901234567"
    }
  }
  ```

#### 1.2. Đăng nhập
- **Endpoint:** `POST /api/auth/login`
- **Quyền:** Public
- **Request Body:**
  ```json
  {
    "email": "customer@ktht.local",
    "password": "Password@123"
  }
  ```
- **Response (200 OK):** Trả về `token` và thông tin `user`.

#### 1.3. Lấy thông tin cá nhân & sổ địa chỉ
- **Endpoint:** `GET /api/auth/me`
- **Quyền:** Yêu cầu đăng nhập (`Bearer Token`)
- **Response (200 OK):** Thông tin user và danh sách địa chỉ đã lưu.

#### 1.4. Cập nhật địa chỉ nhận hàng
- **Endpoint:** `POST /api/auth/address`
- **Quyền:** Yêu cầu đăng nhập
- **Request Body:**
  ```json
  {
    "recipientName": "Nguyễn Văn A",
    "phoneNumber": "0901234567",
    "streetAddress": "123 Đường 3/2",
    "ward": "Phường 12",
    "district": "Quận 10",
    "city": "TP. Hồ Chí Minh"
  }
  ```

#### 1.5. Đổi mật khẩu
- **Endpoint:** `POST /api/auth/change-password`
- **Quyền:** Yêu cầu đăng nhập
- **Request Body:**
  ```json
  {
    "currentPassword": "Password@123",
    "newPassword": "NewPassword@2026"
  }
  ```

---

### MODULE 2 — PRODUCT CATALOG (PUBLIC)

#### 2.1. Lấy danh mục sản phẩm
- **Endpoint:** `GET /api/categories`
- **Quyền:** Public
- **Response (200 OK):** Mảng các danh mục (`id`, `name`, `slug`).

#### 2.2. Lấy danh sách thương hiệu
- **Endpoint:** `GET /api/brands`
- **Quyền:** Public
- **Response (200 OK):** Mảng 63 thương hiệu nạp từ Pharmacity (`id`, `name`, `slug`).

#### 2.3. Danh sách sản phẩm (Lọc, Tìm kiếm, Phân trang)
- **Endpoint:** `GET /api/products`
- **Quyền:** Public
- **Query Parameters:**
  - `q`: Từ khóa tìm kiếm theo tên hoặc SKU (tối đa 200 ký tự).
  - `category`: Slug danh mục.
  - `brand`: Slug thương hiệu.
  - `minPrice`: Giá tối thiểu (DECIMAL).
  - `maxPrice`: Giá tối đa (DECIMAL).
  - `sort`: `featured` | `name` | `price-asc` | `price-desc`.
  - `page`: Số trang (mặc định 1).
  - `pageSize`: Kích thước trang (1 đến 100, mặc định 12).
  - `featured`: `true` để lấy sản phẩm nổi bật.
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "name": "Khăn bông mềm",
        "slug": "demo-san-pham-01",
        "sku": "KTHT-DEMO-01",
        "price": 25000,
        "imageUrl": null,
        "category": { "id": 1, "name": "Chăm sóc cá nhân", "slug": "cham-soc-ca-nhan" },
        "brand": null,
        "packageSize": null,
        "saleUnit": null,
        "currency": "VND",
        "isFeatured": true
      }
    ],
    "page": 1,
    "pageSize": 12,
    "totalCount": 150
  }
  ```

#### 2.4. Chi tiết sản phẩm & biến thể
- **Endpoint:** `GET /api/products/{slug}`
- **Quyền:** Public
- **Response (200 OK):** Trả về chi tiết sản phẩm và danh sách `variants` đang hoạt động.

---

### MODULE 3 — PRODUCT MANAGEMENT (ADMIN & SALES)

#### 3.1. Thêm sản phẩm mới
- **Endpoint:** `POST /api/admin/products`
- **Quyền:** `Sales` hoặc `Admin`
- **Request Body:**
  ```json
  {
    "name": "Men vi sinh Bifina",
    "sku": "BIFINA-01",
    "price": 360000,
    "categoryId": 1,
    "brandId": 12,
    "description": "Bổ sung lợi khuẩn cho đường ruột",
    "packageSize": "Hộp 30 gói",
    "saleUnit": "Hộp",
    "isPublished": true,
    "isFeatured": false
  }
  ```
- **Response (200 OK):** Tạo sản phẩm, biến thể mặc định và khởi tạo tồn kho $P=100, B=10$.

#### 3.2. Cập nhật thông tin sản phẩm
- **Endpoint:** `PUT /api/admin/products/{id}`
- **Quyền:** `Sales` hoặc `Admin`

#### 3.3. Ẩn/Hiện sản phẩm (Soft-delete / Toggle Publish)
- **Endpoint:** `PUT /api/admin/products/{id}/publish`
- **Quyền:** `Sales` hoặc `Admin`
- **Request Body:** `{ "isPublished": false }`

---

### MODULE 4 — SHOPPING CART & VALIDATION

#### 4.1. Xác thực giỏ hàng & tính lại giá máy chủ
- **Endpoint:** `POST /api/cart/validate`
- **Quyền:** Public / Authenticated
- **Request Body:**
  ```json
  {
    "items": [
      { "sku": "KTHT-DEMO-01-S", "quantity": 2 }
    ]
  }
  ```
- **Response (200 OK):** Trả về giá chuẩn, kiểm tra tồn khả dụng $U$, cờ `allValid` và tổng tiền chuẩn xác.

---

### MODULE 5 — CHECKOUT & ORDER MANAGEMENT

#### 5.1. Đặt hàng & Giữ tồn kho nguyên tử
- **Endpoint:** `POST /api/orders`
- **Quyền:** Public / Authenticated
- **Header:** `Idempotency-Key: <UUID>` (Bắt buộc để chống đặt trùng khi lag mạng)
- **Request Body:**
  ```json
  {
    "customerName": "Nguyễn Văn A",
    "customerEmail": "nguyenvana@gmail.com",
    "customerPhone": "0901234567",
    "shippingAddress": "123 Đường 3/2, Quận 10, TP.HCM",
    "paymentMethod": "COD",
    "items": [
      { "sku": "KTHT-DEMO-01-S", "quantity": 2 }
    ]
  }
  ```
- **Response (200 OK / 201 Created):**
  ```json
  {
    "message": "Đặt hàng thành công!",
    "order": {
      "id": 10,
      "orderCode": "ORD-20261103-58472",
      "status": "Pending",
      "totalAmount": 50000,
      "customerName": "Nguyễn Văn A"
    }
  }
  ```

#### 5.2. Tra cứu chi tiết đơn hàng
- **Endpoint:** `GET /api/orders/{orderCode}`
- **Quyền:** Public (khách vãng lai tra cứu qua mã đơn) hoặc Authenticated

#### 5.3. Xem danh sách đơn của tôi
- **Endpoint:** `GET /api/me/orders`
- **Quyền:** `Customer`

#### 5.4. Hủy đơn hàng (Khách hàng hủy)
- **Endpoint:** `POST /api/orders/{id}/cancel`
- **Quyền:** `Customer` sở hữu đơn hoặc `Admin`
- **Business Rule:** Chỉ được hủy khi đơn ở trạng thái `Pending` hoặc `Confirmed`. Tự động giải phóng Reservation: $R \to U$.

---

### MODULE 6 — INVENTORY MANAGEMENT

#### 6.1. Xem danh sách tồn kho theo SKU
- **Endpoint:** `GET /api/admin/inventory`
- **Quyền:** `Warehouse` hoặc `Admin`
- **Response (200 OK):**
  ```json
  [
    {
      "id": 1,
      "sku": "KTHT-DEMO-01-S",
      "warehouseCode": "WH-CENTRAL",
      "p": 100,
      "q": 0,
      "b": 10,
      "r": 2,
      "a": 0,
      "availableStock": 88,
      "isLowStock": false
    }
  ]
  ```

#### 6.2. Xuất kho đơn hàng (Fulfillment)
- **Endpoint:** `POST /api/admin/orders/{id}/fulfill`
- **Quyền:** `Warehouse` hoặc `Admin`
- **Effect:** Trừ vật lý $P - n$, trừ reservation $R - n$, chuyển trạng thái đơn sang `Shipped`.

#### 6.3. Xác nhận giao hàng thành công
- **Endpoint:** `POST /api/admin/orders/{id}/deliver`
- **Quyền:** `Warehouse` hoặc `Admin`
- **Effect:** Chuyển trạng thái đơn sang `Delivered`, cập nhật `PaymentStatus = 'Paid'`.

---

### MODULE 7 — KHUYẾN MÃI & MÃ GIẢM GIÁ (PROMOTIONS)
*(Đã loại bỏ chức năng kết nối sàn đa kênh theo yêu cầu dự án; chuyển đổi tập trung bán hàng trực tiếp website với hệ thống mã khuyến mãi)*

#### 7.1. Kiểm tra và áp dụng mã khuyến mãi
- **Endpoint:** `POST /api/promotions/validate`
- **Quyền:** Public / Customer
- **Request Body:**
  ```json
  {
    "code": "SALE10-01",
    "items": [
      { "sku": "KTHT-DEMO-01-S", "quantity": 2 }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "code": "SALE10-01",
    "description": "Giảm 10% tối đa 50.000đ",
    "subtotal": 120000,
    "discountAmount": 12000,
    "totalAmount": 108000
  }
  ```
- **Business Rules:**
  - Hệ thống hỗ trợ 50 mã demo phân bổ theo các mức (`SALE10-01`..`20`, `GIAM20K-01`..`15`, `GIAM50K-01`..`10`, `VIP15-01`..`05`).
  - Mỗi đơn hàng chỉ áp dụng duy nhất 1 mã khuyến mãi.
  - Giá và mức chiết khấu do máy chủ tính toán lại từ database, không chấp nhận frontend tự định giá.

---

### MODULE 8 — RETURNS, REFUNDS & QC (RMA)

#### 8.1. Khách gửi yêu cầu đổi/trả hàng (RMA)
- **Endpoint:** `POST /api/me/returns`
- **Quyền:** `Customer`
- **Request Body:**
  ```json
  {
    "orderId": 10,
    "reason": "Sản phẩm bị móp méo bao bì trong quá trình vận chuyển",
    "items": [
      { "orderItemId": 12, "quantity": 1, "note": "Hộp rách góc" }
    ]
  }
  ```

#### 8.2. Duyệt phiếu RMA
- **Endpoint:** `POST /api/admin/returns/{id}/approve`
- **Quyền:** `CustomerSupport` hoặc `Admin`

#### 8.3. Kho nhận hàng trả về khu vực cách ly $Q$
- **Endpoint:** `POST /api/admin/returns/{id}/receive`
- **Quyền:** `Warehouse` hoặc `Admin`
- **Effect:** Tăng tồn vật lý $P + n$, tăng tồn cách ly $Q + n$. Tồn bán $U$ không tăng.

#### 8.4. Kiểm định chất lượng (QC Inspection)
- **Endpoint:** `POST /api/admin/returns/{id}/qc`
- **Quyền:** `Warehouse` hoặc `Admin`
- **Request Body:**
  ```json
  {
    "isPassed": true,
    "note": "Kiểm tra sản phẩm còn nguyên tem niêm phong, đủ điều kiện tái nhập bán"
  }
  ```
- **Effect:**
  - Nếu `isPassed = true`: Giảm cách ly $Q - n$, trả về tồn bán $U + n$.
  - Nếu `isPassed = false`: Giảm tồn vật lý $P - n$, giảm cách ly $Q - n$. Không tăng $U$.

#### 8.5. Hoàn tiền cho khách hàng
- **Endpoint:** `POST /api/admin/returns/{id}/refund`
- **Quyền:** `Admin`
- **Effect:** Cập nhật trạng thái RMA thành `Refunded`, cập nhật trạng thái đơn thành `Refunded`.

---

### MODULE 9 — CUSTOMER SUPPORT TICKETS

#### 9.1. Tạo ticket hỗ trợ mới
- **Endpoint:** `POST /api/me/tickets`
- **Quyền:** Public / `Customer`
- **Request Body:**
  ```json
  {
    "customerName": "Nguyễn Văn A",
    "customerEmail": "customer@gmail.com",
    "subject": "Cần hỗ trợ về hóa đơn VAT",
    "category": "Thanh toán",
    "priority": "Normal",
    "message": "Vui lòng xuất hóa đơn VAT theo mã số thuế doanh nghiệp...",
    "relatedOrderId": 10
  }
  ```

#### 9.2. Phản hồi tin nhắn trong ticket
- **Endpoint:** `POST /api/tickets/{id}/reply`
- **Quyền:** Authenticated (`Customer` hoặc `Staff`)
- **Request Body:**
  ```json
  {
    "message": "Bộ phận kế toán đã nhận được thông tin và sẽ gửi hóa đơn điện tử trong 48h.",
    "senderName": "Nhân viên CSKH"
  }
  ```

---

### MODULE 10 — ADMIN DASHBOARD & REPORTING

#### 10.1. Lấy chỉ số tổng quan thời gian thực (Real Metrics)
- **Endpoint:** `GET /api/admin/dashboard`
- **Quyền:** `Sales`, `Warehouse`, `CustomerSupport`, `Admin`
- **Response (200 OK):**
  ```json
  {
    "totalProducts": 152,
    "totalOrders": 14,
    "totalRevenue": 1850000,
    "pendingOrders": 3,
    "shippedOrders": 5,
    "deliveredOrders": 4,
    "cancelledOrders": 2,
    "lowStockAlerts": 0,
    "pendingReturns": 1,
    "openTickets": 2,
    "recentOrders": [
      {
        "id": 14,
        "orderCode": "ORD-20261103-58472",
        "customerName": "Nguyễn Văn A",
        "totalAmount": 50000,
        "status": "Delivered",
        "createdAt": "2026-11-03T11:21:00Z"
      }
    ]
  }
  ```

