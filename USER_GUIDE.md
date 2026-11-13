# Hướng dẫn chạy KTHT E-commerce

## 1. Chuẩn bị

Cài .NET SDK theo `global.json`, Node.js, npm và SQL Server LocalDB hoặc SQL Server Developer. Git và SSMS là tùy chọn hữu ích.

```powershell
dotnet --version
node --version
npm.cmd --version
```

## 2. Chuẩn bị database

Chạy từ thư mục gốc:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=(localdb)\mssqllocaldb;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
$env:ASPNETCORE_ENVIRONMENT = "Development"

dotnet tool restore
dotnet ef database update --project backend/src/Ktht.Infrastructure --startup-project backend/src/Ktht.Api
dotnet run --project backend/src/Ktht.Api -- --import-pharmacity
dotnet run --project backend/src/Ktht.Api -- --seed-demo
```

Import nạp catalog từ file nguồn. Seed nạp tài khoản, tồn kho và khuyến mãi; có thể chạy lại mà không nhân đôi dữ liệu.

## 3. Chạy ứng dụng

Terminal thứ nhất:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=(localdb)\mssqllocaldb;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet run --project backend/src/Ktht.Api --urls http://localhost:5080
```

Terminal thứ hai:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev -- --host localhost --port 5173
```

Mở `http://localhost:5173`. Nếu PowerShell chưa nhận Node.js:

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
```

## 4. Tài khoản Demo & Mã khuyến mãi

### 4.1. Tài khoản đăng nhập thử nghiệm (Mật khẩu chung: `Ktht@2026`)

| Vai trò | Email đăng nhập | Mô tả quyền hạn |
| --- | --- | --- |
| Quản trị viên (Admin) | `admin@ktht.local` | Toàn quyền cấu hình, quản lý Flash Sale, xem mọi báo cáo và AI Copilot |
| Nhân viên Bán hàng (Sales) | `sales@ktht.local` | Quản lý đơn hàng, xem báo cáo doanh thu & chiến dịch Flash Sale |
| Thủ kho (Warehouse) | `warehouse@ktht.local` | Quản lý tồn kho, điều chỉnh $P, Q, B, R, A, U$, tiếp nhận nhập kho |
| CSKH (CustomerSupport) | `support@ktht.local` | Hỗ trợ ticket, tiếp nhận & xử lý yêu cầu đổi trả (RMA) |
| Khách hàng (Customer) | `customer@ktht.local` | Đặt hàng, theo dõi đơn, trò chuyện với Trợ lý Dược sĩ |

### 4.2. 50 Mã khuyến mãi demo (Mỗi đơn tối đa 1 mã)

- `SALE10-01` đến `SALE10-20`: Giảm 10% tối đa 50.000đ cho đơn từ 100.000đ.
- `GIAM20K-01` đến `GIAM20K-15`: Giảm 20.000đ cho đơn từ 150.000đ.
- `GIAM50K-01` đến `GIAM50K-10`: Giảm 50.000đ cho đơn từ 500.000đ.
- `VIP15-01` đến `VIP15-05`: Giảm 15% tối đa 100.000đ cho đơn từ 300.000đ.

### 4.3. Các tính năng V-Pharma mới

- **Flash Sale Giờ Vàng**: Hiển thị trên trang chủ với đồng hồ đếm ngược trực tiếp. Sản phẩm trong Flash Sale tự động giảm giá và trừ hạn mức khi đặt hàng. Quản trị viên có thể bật/tắt kích hoạt tại tab `⚡ Flash Sale` trong Admin.
- **Trợ lý Dược sĩ V-Pharma**: Nút chat ở góc dưới bên phải màn hình cửa hàng, hỗ trợ tìm thuốc, kiểm tra đơn hàng theo mã `ORD-...`, tư vấn giao hàng 2h và cảnh báo y tế chuẩn mực.
- **V-Pharma AI Copilot**: Tab `🤖 AI Copilot` trong Admin Live Panel cho phép nhân viên tra cứu nhanh tồn kho, KPI đơn hàng và kiểm tra tính toàn vẹn của Invariant tồn kho.

## 5. Kiểm tra code

```powershell
dotnet build backend/Ktht.sln --no-restore
dotnet run --project backend/tests/Ktht.Catalog.Checks
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run test -- --run
npm.cmd --prefix frontend run build
```

Script trong `tests/e2e/` gọi API thật và có thể tạo đơn hoặc thay đổi tồn. Hãy dùng database test riêng.

## 6. Lỗi thường gặp

- Không kết nối được DB: kiểm tra instance và `ConnectionStrings__DefaultConnection`.
- Port đang dùng: dừng tiến trình cũ hoặc đổi đồng thời port API và proxy FE.
- `npm.ps1` bị chặn: dùng `npm.cmd`.
- Không thấy sản phẩm: chạy migration, import rồi seed theo đúng thứ tự.

Ứng dụng dùng để demo cục bộ. Không mở public API hoặc database ra Internet khi chưa bổ sung cấu hình bảo mật triển khai.
