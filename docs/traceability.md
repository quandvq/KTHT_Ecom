# Truy vết nghiệp vụ tạm thời

Nguồn hiện có: README mục 3–5 và AGENTS mục 7–10; chưa có báo cáo/ERD/BPMN KTHT trong `docs/source/`. API, bảng và test dưới đây là mục tiêu, không khẳng định đã tồn tại.

| Quy trình / mốc | Quy tắc | Màn hình → API → dữ liệu dự kiến | Kiểm thử cần có | Trạng thái |
| --- | --- | --- | --- | --- |
| Xem sản phẩm M1 | BR-CAT-001 | Danh sách → API đọc → sản phẩm/SKU | FE đọc dữ liệu thật; rỗng/lỗi | Chưa xác minh |
| Đặt đơn M2 | BR-CAT-001, BR-ORD-001, BR-INV-001/002, BR-IDEM-001 | Giỏ/đặt hàng → API đơn → order, item, reservation, tồn SKU–kho | Tranh hàng cuối, rollback nhiều dòng, lặp key/khác payload trên SQL Server test riêng | Chưa triển khai |
| Hủy/xuất M3 | BR-INV-003, BR-PAY-001, BR-AUD-001 | Quản lý đơn/kho → API trạng thái → order, reservation, shipment | Hủy cạnh tranh xuất; lặp request; COD chưa đối soát | Chưa triển khai |
| Đơn sàn M4 | BR-INV-004/005, BR-IDEM-001, BR-EVT-001 | Kênh → adapter → allocation, order, inbox/outbox | Trùng/trễ/sai thứ tự, timeout chuyển hạn mức, lỗi sau commit | Chưa triển khai |
| Trả hàng M5 | BR-RET-001/002, quyết định TASK-004 | Hậu mãi → API trả hàng → return, kiểm hàng, refund | Không tăng tồn trước kiểm đạt; giới hạn số lượng/tiền; lặp yêu cầu; partial theo dòng hàng | Chưa triển khai |
| Quyền M1 trở đi | BR-AUTH-001 | Đăng nhập/tài nguyên → API → user/role | Không đăng nhập, sai role, đổi ID sang tài nguyên người khác | Chưa xác minh |

Khi có nguồn, bổ sung ID và vị trí chính xác của quy trình, bảng ERD, API thực tế và đường dẫn test cùng kết quả; ghi khác biệt thay vì sửa âm thầm.
