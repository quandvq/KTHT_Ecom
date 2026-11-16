# V-Pharma E-commerce

Nền tảng thương mại điện tử dược phẩm trực tuyến **V-Pharma** chạy cục bộ với React, ASP.NET Core và SQL Server. Hệ thống nhận đơn trực tiếp từ website, kiểm tra giá và bảo toàn nguyên tử tồn kho theo invariant $U = P - Q - B - R - A \ge 0$.

## Tính năng nổi bật

- **Nhận diện thương hiệu V-Pharma**: Hệ thống nhà thuốc trực tuyến chuẩn GPP với giao diện hiện đại, hotline 1800 6828, chính sách giao hàng 2h và đổi trả trong 30 ngày.
- **Trợ lý Dược sĩ V-Pharma (Customer Chatbot)**: Hỗ trợ khách hàng tìm kiếm thuốc & vitamin từ dữ liệu thật, tra cứu trạng thái đơn hàng theo mã `ORD-...`, tư vấn chính sách giao nhận và cảnh báo y tế chuẩn mực.
- **V-Pharma AI Copilot (Admin Chatbot)**: Hỗ trợ nhân viên và quản trị viên tra cứu số liệu tồn kho theo thời gian thực ($P, Q, B, R, A, U$), báo cáo doanh thu, đơn hàng và tình hình khuyến mãi.
- **Flash Sale Giờ Vàng**: Chiến dịch giảm giá có thời hạn với đồng hồ đếm ngược trực tiếp, hạn mức bán giới hạn, trừ tồn theo thời gian thực và tự động áp dụng giá ưu đãi tại giỏ hàng & thanh toán.
- **Khuyến mãi & Voucher**: Mỗi đơn áp dụng tối đa 1 mã giảm giá; hệ thống seed sẵn 50 mã demo (`SALE10-xx`, `GIAM20K-xx`, `GIAM50K-xx`, `VIP15-xx`).
- **Tối ưu hóa UI/UX**:
  - Popup đăng nhập hiện đại với backdrop blur, căn giữa, trường nhập 44px đồng đều.
  - Trang Checkout bố cục 2 cột chuyên nghiệp trên desktop (Form thông tin giao nhận bên trái, Tóm tắt đơn hàng & Voucher bên phải), co giãn 1 cột trên mobile.
  - Thẻ sản phẩm chuẩn hóa chiều cao, giới hạn tiêu đề 2 dòng đồng đều.
  - Chân trang 4 nhóm đầy đủ thông tin pháp lý, giấy phép kinh doanh dược, hotline và địa chỉ trụ sở.
- **Dữ liệu**: SQL Server LocalDB mặc định, EF Core migration và seed lặp không nhân đôi dữ liệu.

## Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Front-end | React 18, TypeScript, Vite, CSS Responsive |
| Back-end | ASP.NET Core Web API, Entity Framework Core |
| Cơ sở dữ liệu | SQL Server LocalDB / Developer |
| Kiểm thử | Vitest (29 bài test FE), Bộ kiểm tra nghiệp vụ .NET (25 bài checks), E2E test scripts (gồm `tests/e2e/task010-api.mjs` kiểm tra quyền và tranh chấp trên SQL Server test) |

Phiên bản .NET được pin trong `global.json`; dependency JavaScript được khóa trong `frontend/package-lock.json`.

## Chạy nhanh trên Windows

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=(localdb)\mssqllocaldb;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
$env:ASPNETCORE_ENVIRONMENT = "Development"

dotnet tool restore
dotnet ef database update --project backend/src/Ktht.Infrastructure --startup-project backend/src/Ktht.Api
dotnet run --project backend/src/Ktht.Api -- --import-pharmacity
dotnet run --project backend/src/Ktht.Api -- --seed-demo
dotnet run --project backend/src/Ktht.Api --urls http://localhost:5080
```

Mở terminal khác:

```powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix frontend run dev -- --host localhost --port 5173
```

Truy cập `http://localhost:5173`. Nếu terminal chưa nhận Node.js:

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
```

Xem hướng dẫn đầy đủ hơn tại `USER_GUIDE.md`.

## Kiểm tra

```powershell
dotnet build backend/Ktht.sln --no-restore
dotnet run --project backend/tests/Ktht.Catalog.Checks
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run test -- --run
npm.cmd --prefix frontend run build
```

E2E có thay đổi dữ liệu phải dùng database test riêng. Ví dụ: chạy API với `KTHT_Ecom_Test` ở cổng 5081 rồi `$env:KTHT_TEST_DB = "KTHT_Ecom_Test"; node tests/e2e/task010-api.mjs http://127.0.0.1:5081` (script từ chối chạy nếu tên database không kết thúc bằng `_Test`; cách tạo database xem `docs/tasks/TASK-010.md`). Kết quả gần nhất nằm trong `docs/TEST_REPORT.md` và `docs/reviews/TASK-010.md`; không suy rộng kết quả cũ cho code mới.

Đặt hàng, xem và hủy đơn yêu cầu đăng nhập (tài khoản demo `customer@ktht.local` / `Ktht@2026`).

## Tài liệu chính

- `AGENTS.md`: quy tắc làm việc và điều kiện nghiệm thu.
- `docs/ui/page-inventory.md`: trạng thái 40 màn hình.
- `docs/architecture/inventory-model.md`: mô hình tồn kho.
- `docs/business-rules.md`: quy tắc nghiệp vụ.
- `docs/tasks/` và `docs/reviews/`: phạm vi, bàn giao và finding.

Nguồn KTHT chính thức cần đặt trong `docs/source/`. Thư mục này chưa có nguồn ngoài `.gitkeep`, nên các quyết định chưa có nguồn vẫn là giả định của bản demo.
