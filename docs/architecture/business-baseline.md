# Use case, trạng thái và quyền: đề xuất M0

Dựa trên README mục 3–5 và AGENTS mục 7–9; chưa có nguồn KTHT trong `docs/source/`. Tên và chuyển trạng thái chỉ là đề xuất để thảo luận, không phải hợp đồng đã chốt. Nghiệp vụ tồn/tiền thuộc các mốc sau M1.

## Use case và tiêu chí dự kiến

| Use case | Actor / đầu vào → đầu ra | Given / When / Then và ngoại lệ |
| --- | --- | --- |
| Xem sản phẩm | Khách → yêu cầu danh sách → danh sách SKU được phép | Given không có sản phẩm, When đọc danh sách, Then trả danh sách rỗng; lỗi kết nối được thể hiện rõ. |
| Đặt đơn | Customer, SKU và số lượng → đơn và reservation | Given một dòng thiếu khả dụng, When đặt đơn, Then không tạo đơn hoặc reservation; tranh hàng cuối chỉ một yêu cầu thành công. |
| Hủy trước xuất | Customer hoặc Sales theo chính sách → đơn hủy | Given đơn đã xuất, When yêu cầu hủy trực tiếp, Then từ chối và chuyển quy trình hoàn/giao thất bại. Quyền cụ thể cần xác nhận. |
| Xuất đơn | Warehouse → xác nhận xuất → shipment và cập nhật tồn | Given hủy cạnh tranh xuất, When gửi đồng thời, Then chỉ một chuyển trạng thái thành công. |
| Nhận đơn sàn | Adapter, external ID và dòng hàng → đơn hoặc ngoại lệ | Given event trùng, When nhận lại, Then không tạo đơn/reservation trùng; thiếu A vào ngoại lệ. |
| Nhận và kiểm hàng trả | CustomerService/Warehouse → yêu cầu/kiểm hàng → phân loại | Given hàng chưa kiểm đạt, When tiếp nhận yêu cầu, Then không tăng tồn bán được. |

## Bảng chuyển trạng thái đề xuất

Đây là bản phác thảo; phải xác nhận điều kiện, quyền và nhánh lỗi trước khi code từng mốc. Điều kiện sai hoặc xung đột đồng thời bị từ chối và giữ nguyên dữ liệu; retry hữu hạn với lỗi phù hợp.

| Đối tượng / từ | Hành động, điều kiện / role dự kiến | Đến | Tồn / tiền | Sự kiện hoặc lỗi |
| --- | --- | --- | --- | --- |
| Order / mới | Đặt hợp lệ / Customer | Đã tiếp nhận | Tăng R cùng transaction tạo đơn; không giảm P | Audit; thiếu hàng rollback |
| Order / đã tiếp nhận | Hủy trước xuất / Customer hoặc Sales, chờ chốt | Đã hủy | Giảm R một lần; không đổi P | Audit; cạnh tranh xuất trả conflict |
| Order / đã tiếp nhận | Xác nhận / Sales | Đã xác nhận | Không đổi tồn/tiền | Audit; sai trạng thái trả conflict |
| Order / đã xác nhận | Xuất / Warehouse | Đã xuất | Giảm P và R tương ứng một lần | Audit; lỗi rollback; cạnh tranh hủy trả conflict |
| Shipment / đang giao | Xác nhận giao mô phỏng / role chờ chốt | Đã giao | Không tự xác nhận thu tiền COD | Audit; event cũ không lùi trạng thái |
| Return / đã yêu cầu | Nhận và kiểm từng dòng yêu cầu / Warehouse, chính sách duyệt theo TASK-004 | Đã kiểm | Hàng kiểm đạt mới được đưa vào tồn bán được; kết quả kiểm hỗn hợp theo dòng | Ghi phân loại; không đủ điều kiện từ chối; đổi/trả một phần theo dòng, không vượt lượng đã giao đủ điều kiện |
| Payment / chờ đối soát | Xác nhận đối soát / role chờ chốt | Đã đối soát | Ghi nhận theo chứng cứ, tách shipment | Audit; lặp không ghi tiền hai lần |

Chi tiết vòng đời Shipment, Payment, Return và các nhánh thất bại chưa chốt; không suy ra chuyển trạng thái khác từ bảng này.

## Ma trận quyền dự kiến

`✓` là quyền dự kiến cần xác nhận và BE kiểm tra; `—` là chưa cấp trong đề xuất. Admin không mặc nhiên có mọi quyền nghiệp vụ.

| Hành động / đối tượng | Customer | Sales | Warehouse | CustomerService | Manager | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Xem sản phẩm công khai | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Xem/sửa thông tin bản thân | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Đặt/xem đơn của mình | ✓ | — | — | — | — | — |
| Tiếp nhận/xác nhận đơn | — | ✓ | — | — | — | — |
| Soạn/xuất/kiểm hàng trả | — | — | ✓ | — | — | — |
| Tiếp nhận ticket/hậu mãi | — | — | — | ✓ | — | — |
| Xem báo cáo/phê duyệt ngoại lệ | — | — | — | — | ✓ | — |
| Quản lý tài khoản/role/cấu hình | — | — | — | — | — | ✓ |

Quyền xem đơn của nhân viên, hủy đơn, đối soát, giả lập và phạm vi đối tượng chưa được xác nhận. BE mặc định từ chối quyền chưa cấp và kiểm tra quyền sở hữu Customer.
