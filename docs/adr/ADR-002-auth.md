# ADR-002: Xác thực và phân quyền

Trạng thái: chưa chốt. README yêu cầu quyết định cookie/token, CSRF và CORS; nguồn KTHT chưa có ma trận quyền và môi trường bootstrap chưa được xác minh. Không coi vai trò gửi từ FE là quyền. Khi triển khai cần dùng thư viện xác thực được kiểm chứng, kiểm tra quyền đối tượng ở BE, chỉ cho phép origin FE cấu hình và kiểm thử CSRF nếu dùng cookie.

Ứng viên cho demo cùng máy: ASP.NET Core Identity với cookie HttpOnly, SameSite phù hợp và cơ chế chống CSRF cho thao tác thay đổi trạng thái. Đây là phương án để đánh giá, chưa phải contract đã xác nhận. Endpoint đọc danh mục công khai có thể triển khai độc lập; M1 chưa hoàn tất cho đến khi xác thực và phân quyền được kiểm thử.
