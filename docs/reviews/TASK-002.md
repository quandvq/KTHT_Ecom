# Review TASK-002

Chế độ: `independent-agent`; FE và BA/DR review chéo tài liệu M0 và FE, Coordinator review hợp đồng và tích hợp. Các vai trò là agent, không phải người duyệt độc lập bên ngoài.

## F-001 — P2: Không thể quay lại khi trang sản phẩm rỗng

- Reviewer: BA/DR; nguồn: TASK-002, tiêu chí hiển thị rỗng; file: `frontend/src/App.tsx`.
- Tái hiện: ở trang 2, dữ liệu giảm còn tối đa một trang, sau đó tải lại. Dự kiến có thể quay về trang 1; thực tế trước sửa điều hướng bị ẩn và báo không có sản phẩm.
- Owner: FE. Đã đưa điều hướng ra ngoài nhánh rỗng, phân biệt thông báo và thêm test hành vi. Reviewer kiểm tra lại mã thấy xử lý phù hợp, nhưng test chưa chạy vì thiếu Node/npm.
- Trạng thái: FIXED_PENDING_RETEST. Chạy test và xác minh hành vi khi môi trường sẵn sàng.

## F-002 — P2: Diễn đạt xử lý hàng trả chưa rõ

- Reviewer: FE; nguồn: BR-ORD-002, AGENTS mục 8; file: `docs/architecture/business-baseline.md`.
- Tái hiện: đọc chuyển trạng thái Return trước sửa; có thể hiểu cho phép hoàn một phần dù MVP từ chối. Dự kiến phân biệt chính sách hoàn một phần với kết quả kiểm hàng.
- Owner: BA. Đã làm rõ kiểm toàn bộ yêu cầu, từ chối hoàn một phần và để ngỏ chính sách kiểm hỗn hợp. Reviewer kiểm tra lại câu chữ.
- Trạng thái: VERIFIED đối với diễn đạt; chính sách kiểm hỗn hợp vẫn chờ nguồn KTHT.
