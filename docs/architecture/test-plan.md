# Kế hoạch kiểm thử tạm thời

Nguồn: README mục 5, 9 và AGENTS mục 7–10. Các kỳ vọng cần đối chiếu nguồn KTHT; không xem danh sách này là kết quả đã chạy.

| Mốc | Trường hợp và kỳ vọng | Môi trường cần có |
| --- | --- | --- |
| M1 | Danh mục công khai, rỗng, lỗi, phân trang và giá trị phân trang sai; FE dùng API thật | FE, API, SQL Server test |
| M1 | Không đăng nhập, sai role và đổi ID tài nguyên của người khác bị từ chối | Auth hoàn chỉnh, API và SQL Server test |
| M2 | Hai request đồng thời tranh hàng cuối: tối đa một thành công, U không âm | SQL Server test riêng, kết nối đồng thời |
| M2 | Một dòng trong đơn nhiều dòng thiếu tồn: không có đơn hay reservation được commit | SQL Server test riêng |
| M2 | Cùng key/cùng payload trả kết quả cũ; khác payload bị từ chối, kể cả sau retry | SQL Server test riêng |
| M3 | Hủy/expire cạnh tranh xuất: chỉ một chuyển trạng thái thắng; lặp không xuất hoặc giải phóng hai lần | SQL Server test riêng |
| M4 | Đơn sàn trùng/trễ, hạn mức timeout, event sai thứ tự và lỗi sau commit trước khi gửi | Adapter mô phỏng và SQL Server test riêng |
| M5 | Chưa kiểm hàng không tăng tồn; lượng và tiền hoàn không vượt giới hạn được chốt | SQL Server test riêng |

Đặt hàng và giữ hàng cần test tính tiền, state transition, rollback, retry hữu hạn/deadlock và failure path trước khi coi slice hoàn thành. Test EF InMemory và request tuần tự không chứng minh concurrency SQL Server. Không chạy test phá dữ liệu trên database demo.
