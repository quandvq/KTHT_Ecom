# Lịch sử Thay đổi Cơ sở dữ liệu (Database Changes)

Tài liệu này theo dõi toàn bộ các phiên bản schema, migrations và tác động cấu trúc dữ liệu trên SQL Server (`KTHT_Ecom_Dev`).

---

## 1. Danh sách Migrations đã áp dụng

| Phiên bản Migration | Ngày áp dụng | Mục tiêu | Bảng & Cột bị ảnh hưởng | Tác động dữ liệu |
| :--- | :--- | :--- | :--- | :--- |
| `20261102015846_InitialCatalog` | 2026-11-02 | Khởi tạo bảng danh mục và sản phẩm cơ bản | `Categories`, `Products` | Tạo bảng ban đầu |
| `20261103074147_CatalogVariants` | 2026-11-03 | Bổ sung bảng biến thể SKU cho Catalog | `ProductVariants` | Liên kết 1-nhiều với `Products` |
| `20261103092805_AddBrandsAndProductPackageFields` | 2026-11-03 | Bổ sung thực thể Brand và các trường theo đặc tả Pharmacity | Tạo `Brands`; bổ sung `BrandId`, `PackageSize`, `SaleUnit`, `Currency` vào `Products` | Tương thích dữ liệu CSV 132 sản phẩm, không mất dữ liệu |

---

## 2. Kế hoạch Migrations cho các Sprint tiếp theo

### Migration Sprint 1: `20261103_AddAuthAndUserTables`
- **Bảng `Users`:**
  - `Id` (int, PK, Identity)
  - `Email` (nvarchar(256), Unique, Index)
  - `FullName` (nvarchar(200))
  - `PasswordHash` (nvarchar(500))
  - `PasswordSalt` (nvarchar(500))
  - `Role` (nvarchar(50), default 'Customer')
  - `PhoneNumber` (nvarchar(20), nullable)
  - `CreatedAt` (datetime2, default UtcNow)
- **Bảng `CustomerAddresses`:**
  - `Id` (int, PK, Identity)
  - `UserId` (int, FK -> Users)
  - `RecipientName` (nvarchar(200))
  - `Phone` (nvarchar(20))
  - `StreetAddress` (nvarchar(500))
  - `Ward` (nvarchar(100))
  - `District` (nvarchar(100))
  - `City` (nvarchar(100))
  - `IsDefault` (bit)

### Migration Sprint 2: `20261103_AddOrderAndCartTables`
- **Bảng `Orders`:**
  - `Id` (int, PK, Identity)
  - `OrderCode` (nvarchar(64), Unique, Index)
  - `UserId` (int, nullable, FK -> Users)
  - `CustomerName` (nvarchar(200))
  - `CustomerEmail` (nvarchar(256))
  - `CustomerPhone` (nvarchar(20))
  - `ShippingAddress` (nvarchar(1000))
  - `PaymentMethod` (nvarchar(50))
  - `Status` (nvarchar(50): Pending, Confirmed, Shipped, Delivered, Cancelled)
  - `TotalAmount` (decimal(18,2))
  - `CreatedAt` (datetime2)
  - `UpdatedAt` (datetime2)
  - `IdempotencyKey` (nvarchar(128), nullable, Index)
- **Bảng `OrderItems`:**
  - `Id` (int, PK, Identity)
  - `OrderId` (int, FK -> Orders)
  - `ProductId` (int, FK -> Products)
  - `VariantId` (int, nullable, FK -> ProductVariants)
  - `Sku` (nvarchar(64))
  - `ProductName` (nvarchar(200))
  - `VariantName` (nvarchar(200), nullable)
  - `UnitPrice` (decimal(18,2))
  - `Quantity` (int)
  - `LineTotal` (decimal(18,2))

### Migration Sprint 3: `20261103_AddInventoryAndLedgerTables`
- **Bảng `InventoryBalances`:**
  - `Id` (int, PK, Identity)
  - `Sku` (nvarchar(64), Unique, Index)
  - `WarehouseCode` (nvarchar(50), default 'WH-CENTRAL')
  - `P` (int): On-hand
  - `Q` (int): Quarantined
  - `B` (int): Safety Stock
  - `R` (int): Reserved
  - `A` (int): Channel Quota
- **Bảng `InventoryReservations`:**
  - `Id` (int, PK, Identity)
  - `OrderId` (int, FK -> Orders)
  - `Sku` (nvarchar(64))
  - `Quantity` (int)
  - `Status` (nvarchar(50): Active, Fulfilled, Released)
  - `CreatedAt` (datetime2)
- **Bảng `InventoryLedger`:**
  - `Id` (int, PK, Identity)
  - `TransactionCode` (nvarchar(64))
  - `Sku` (nvarchar(64))
  - `MovementType` (nvarchar(50): Receive, Reserve, Release, Issue, Quarantine, QC_Pass, QC_Fail)
  - `DeltaP` (int), `DeltaQ` (int), `DeltaR` (int), `DeltaA` (int)
  - `Reason` (nvarchar(500))
  - `Actor` (nvarchar(100))
  - `CreatedAt` (datetime2)

### Migration Sprint 4: `20261103_AddReturnsSupportAndChannels`
- **Bảng `ReturnRequests` & `ReturnItems`:** Quản lý đổi trả và QC kiểm định.
- **Bảng `SupportTickets` & `TicketMessages`:** Quản lý ticket CSKH.
- **Bảng `SalesChannels` & `ChannelAllocations`:** Phân bổ hạn mức đa kênh.

