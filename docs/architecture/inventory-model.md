# Mô hình tồn kho chuẩn

Trạng thái: quyết định TASK-004. Đơn vị hạch toán là SKU–lô–kho. Không dùng tổng tồn sản phẩm để quyết định bán hoặc phân bổ.

## Số dư

| Ký hiệu | Ý nghĩa | Tính vào lượng bán được |
| --- | --- | --- |
| P | Tồn vật lý đã nhận và ghi sổ tại kho | Có, trước các khoản trừ |
| Q | Hàng cách ly, khóa, thu hồi hoặc không đủ điều kiện bảo quản | Không |
| B | Tồn an toàn của phần còn đủ điều kiện | Không |
| R | Reservation đang hiệu lực của đơn chưa xuất | Không |
| A | Quota campaign/kênh đã cam kết nhưng chưa là reservation của đơn | Không |
| I | Hàng về đã xác nhận nhưng chưa nhận kho | Không |
| U | Lượng chung chưa cam kết: `P − Q − B − R − A` | Có |

Mọi thành phần và U phải không âm trong vận hành bình thường. Nếu Q tăng khiến không đủ cho R/A đã cam kết, ghi ngoại lệ, khóa cam kết mới và xử lý đơn ảnh hưởng; không tự xóa reservation.

## Chuyển động chuẩn

| Sự kiện | Thay đổi | Điều kiện |
| --- | --- | --- |
| Đơn website hợp lệ | `R + n` | U đủ; tạo đơn và R cùng transaction |
| Đơn dùng quota campaign/kênh | `A − n`, `R + n` | Cùng transaction; thiếu A vào ngoại lệ |
| Hủy/expire đơn website | `R − n` | Reservation còn hiệu lực |
| Hủy/expire đơn dùng quota còn hiệu lực | `R − n`, `A + n` | Quota còn hiệu lực; không tự trả U |
| Hủy/expire khi quota đã hết hiệu lực | `R − n`, `A + n` | A chuyển thành cam kết chờ đối soát; chỉ sau khi xác nhận kênh không thể tự bổ sung mới release A về U |
| Kết thúc/release quota được xác nhận | `A − n` | Sau đối soát; U tăng |
| Xuất kho | `P − n`, `R − n` | Một chuyển trạng thái thắng; U không đổi |
| Nhận hàng đạt QC | `P + n` | I chỉ thành P sau chứng từ nhận hợp lệ |
| Nhận hàng trả chờ QC | `P + n`, `Q + n` | Hàng đã hiện diện vật lý nhưng bị cách ly; U không đổi |
| Hàng trả đạt QC | `Q − n` | Không tăng P lần hai; U tăng |
| Hàng trả không đạt QC/tiêu hủy | `P − n`, `Q − n` | Ghi lý do và chứng từ; U không đổi |

Quota campaign và quota kênh là các loại A có `source`, `scope`, `effectiveFrom`, `effectiveTo`, `version` và trạng thái release. A chỉ được hạch toán qua bản ghi allocation khóa đúng SKU–lô–kho; quota tổng theo SKU chỉ là hạn mức kế hoạch, không trực tiếp trừ U. Việc tạo hoặc đổi allocation dùng transaction và FEFO (nếu còn nhiều lô), đồng thời tổng allocation không vượt quota tổng và mỗi allocation không vượt U tại grain đó. Một đơn không được đồng thời giữ cùng số lượng ở A và R.

Khi quota hết hạn trong lúc vẫn còn R, R tiếp tục bảo vệ đơn đang xử lý. Nếu đơn bị hủy hoặc hết reservation sau thời điểm đó, tạo release pending reconciliation; adapter xác nhận quota không thể tự bổ sung thì giải phóng allocation/cam kết còn lại để U tăng. Timeout hoặc thiếu xác nhận không được coi là release.

## Bảo vệ dữ liệu

Kiểm tra và cập nhật dùng conditional update/locking hoặc optimistic concurrency có retry hữu hạn trên SQL Server. Mỗi yêu cầu có idempotency key; cùng key/cùng payload trả kết quả đã ghi, cùng key/khác payload bị từ chối. Event kênh có ID bền vững, version/order và reconciliation; không giữ transaction SQL khi chờ mạng.
