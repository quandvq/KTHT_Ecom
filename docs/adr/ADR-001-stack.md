# ADR-001: Stack cho demo cục bộ

Trạng thái: đề xuất tạm thời theo README; chờ đối chiếu nguồn KTHT. Chọn React/TypeScript/Vite/Bootstrap, ASP.NET Core modular monolith và SQL Server với EF Core. SDK .NET được pin 10.0.402, bản ổn định đã thấy trong môi trường kiểm kê; cần runtime tương ứng khi chạy nơi khác. Không sử dụng dịch vụ bên ngoài cho demo.

Ứng dụng chia API, Application, Domain và Infrastructure; FE chỉ truy cập API. Phiên bản thư viện cụ thể và lệnh cài phải được ghi theo các file thực tế sau bootstrap. Không có nghĩa rằng môi trường hay tích hợp đã được xác minh.
