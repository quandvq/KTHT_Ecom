# Quy tắc nghiệp vụ tạm thời

Nguồn: README mục 5, AGENTS mục 7–9. Đây là đề xuất, chưa được xác nhận theo KTHT: `docs/source/` chưa có báo cáo, ERD hay BPMN. Cần đối chiếu khi có nguồn.

| ID | Quy tắc đề xuất | Mốc |
| --- | --- | --- |
| BR-CAT-001 | Chỉ công khai sản phẩm được phép; SKU đặt mua phải tồn tại và hoạt động. | M1–M2 |
| BR-INV-001 | Theo SKU–kho: U = P − Q − B − R − A; các thành phần không âm và U >= 0 khi vận hành bình thường. Thiếu tồn so với cam kết phải ghi ngoại lệ và khóa cam kết mới. | M2–M4 |
| BR-INV-002 | Tạo đơn và reservation mọi dòng cùng transaction; lỗi một dòng rollback. Tranh hàng được bảo vệ tại DB. | M2 |
| BR-INV-003 | Giữ hàng không giảm P; xuất giảm P và tất toán R một lần; hủy trước xuất giải phóng R một lần. Hủy/expire cạnh tranh xuất chỉ một bên thắng. | M2–M3 |
| BR-INV-004 | Nhận đơn sàn chuyển A sang R nguyên tử; thiếu A vào ngoại lệ. Xác nhận giảm hạn mức trước khi tăng nơi khác; timeout giữ cam kết chưa chắc thu hồi. | M4 |
| BR-INV-005 | Hủy đơn sàn không tự giải phóng về U nếu sàn có thể tự bổ sung; chốt chính sách đối soát trước khi giải phóng. | M4 |
| BR-ORD-001 | BE kiểm tra SKU, số lượng, tính tiền decimal và lưu giá dòng đơn lịch sử. Giá và làm tròn cần xác nhận. | M2 |
| BR-ORD-002 | Hủy một phần và đổi/trả một phần theo dòng hàng được hỗ trợ từ M2; chỉ áp dụng trong lượng chưa xuất hoặc đã giao còn đủ điều kiện, với reservation/RMA/QC và giới hạn hoàn tiền theo TASK-004. | M2–M5 |
| BR-IDEM-001 | Cùng key và payload trả cùng kết quả; khác payload bị từ chối. Đơn ngoài unique theo kênh và external ID; event chống trùng bền vững. | M2–M4 |
| BR-EVT-001 | Event trễ/sai thứ tự không làm lùi trạng thái; retry hữu hạn, theo dõi lỗi; dùng outbox/inbox hoặc ADR tương đương cho giao nhận bất đồng bộ. | M4 |
| BR-PAY-001 | Order, Payment, Shipment, Return có vòng đời riêng; giao COD thành công không chứng minh đã đối soát tiền. | M3–M5 |
| BR-RET-001 | Chỉ hàng đã nhận và kiểm đạt mới tăng tồn bán được; phân loại bán lại/cách ly/hỏng có lịch sử; bảo hành không mặc nhiên tăng tồn. | M5 |
| BR-RET-002 | Lượng trả chấp nhận không vượt lượng giao còn đủ điều kiện; tiền hoàn thành công và đang giữ không vượt số được hoàn theo chính sách. | M5 |
| BR-AUTH-001 | Customer chỉ truy cập tài nguyên của mình; BE kiểm tra quyền hành động và đối tượng, không nhận quyền quản trị từ FE. | M1 trở đi |
| BR-AUD-001 | Ghi actor, thời gian UTC, entity, hành động và lý do phù hợp; không ghi secret. | M2 trở đi |

Ví dụ BR-INV-001/004: P=10, Q=B=0, R=2, A=3 thì U=5; nhận một đơn sàn thành R=3, A=2 thì U vẫn 5; xuất một đơn thành P=9, R=2, A=2 thì U vẫn 5.

Chưa chốt: nguồn KTHT, giá và làm tròn, điều kiện hủy, timeout reservation, đối soát kênh, chính sách trả/hoàn tiền, ma trận quyền và trạng thái chính thức.

## Quyết định thay thế TASK-004

`docs/architecture/decision-register-task-004.md` là nguồn chi tiết hiện hành của `BR-ORD-002`: từ M2 hệ thống hỗ trợ hủy một phần và đổi/trả một phần theo dòng hàng, trong các giới hạn và lifecycle đã nêu tại quyết định này. `business-baseline.md` và test plan phải dùng quyết định đó thay cho câu từ chối xử lý một phần.

`BR-INV-006`: Quota campaign/kênh là A; khi đơn tiêu thụ quota, giảm A và tăng R nguyên tử. Khi hủy/expiry, chuyển R về A: quota còn hiệu lực trở về allocation đang hoạt động, quota đã hết hiệu lực trở thành A chờ đối soát. Chỉ release A về U sau xác nhận; timeout không phải xác nhận. Allocation phải khóa theo SKU–lô–kho. Định nghĩa P/Q/B/R/A/U và các chuyển động chuẩn ở `docs/architecture/inventory-model.md`.
