# Quyết định nghiệp vụ TASK-004

Tài liệu này thay thế các giả định mâu thuẫn trước đó trong `business-rules.md`, `traceability.md` và `business-baseline.md`. Nguồn căn cứ là `KTHT FINAL (3).md`.

## Giữ tồn khi chờ review

Sau validation cấu trúc, chống trùng, kiểm tra SKU/lô/kho và tính giá, đơn tạo reservation nguyên tử. Đơn chờ risk review hoặc tư vấn dược sĩ giữ reservation 24 giờ. Nhân viên có thẩm quyền chỉ được gia hạn một lần tối đa 24 giờ và phải ghi lý do. Từ chối, hủy hoặc expiry giải phóng reservation theo mô hình tồn kho; nếu đơn đã hết reservation mà sau đó được duyệt, hệ thống kiểm tra lại U/quota và giữ lại từ đầu trước khi xác nhận.

Không giữ tồn khi mới thêm vào giỏ. Thanh toán thành công không tự bỏ qua risk review/dược sĩ. Hủy/expiry và xuất kho dùng state transition có điều kiện nên chỉ một thao tác thắng.

## Hủy, đổi trả và giao một phần

Chính sách chuẩn hỗ trợ hủy một phần và đổi/trả một phần theo dòng hàng vì nguồn KTHT có `ChiTietDonHang` và `ChiTietDoiTra` ở cấp dòng. Hủy chỉ áp dụng với phần chưa xuất; mỗi lượng hủy giải phóng đúng reservation nguồn. Đổi/trả chỉ áp dụng cho lượng đã giao còn đủ điều kiện và phải qua RMA/QC; lúc nhận hàng trả ghi `P + n, Q + n`, QC đạt chỉ giảm Q, còn không đạt/tiêu hủy giảm cả P và Q. Hoàn tiền không vượt số tiền thực trả còn có thể hoàn.

Đơn nhiều điểm xuất có thể có nhiều shipment. Đây là partial shipment vận hành, không cho phép tự ý coi toàn đơn đã giao khi chỉ một shipment hoàn tất. M2 phải mô hình hóa dòng hàng và reservation theo dòng; M3 mới triển khai shipment tách nếu nguồn lực cho phép.
