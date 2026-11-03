# Backlog M0–M6

Nguồn: README.md và AGENTS.md. Nghiệp vụ chỉ là đề xuất cho đến khi đối chiếu báo cáo KTHT, ERD và BPMN. Owner/reviewer là vai trò, không hàm ý có nhiều người.

| Mốc | Nội dung và kết quả | Phụ thuộc | Owner | Reviewer | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| M0 | Kiểm kê, use case, giả định/BR, trạng thái, quyền, API, ADR và kế hoạch kiểm thử | Nguồn KTHT để xác nhận | CO/BA/SA | DR/DB/QA/SEC | Tạm thời; chờ nguồn |
| M1 | FE/BE/SQL Server, đọc sản phẩm, xác thực, migration và seed | M0 cho từng phần; môi trường | BE/FE/DB | QA/SEC/DX | Đang bootstrap; xem TASK-002 |
| M2 | SKU, giỏ hàng, đặt đơn và giữ hàng nguyên tử | M1, quy tắc tồn và test SQL | BE/FE/DB | DR/QA | TODO |
| M3 | Xác nhận, xuất kho, giao mô phỏng, hủy | M2, state table | BE/FE | DR/QA | TODO |
| M4 | Hạn mức kênh, đơn sàn, retry và đối soát | M2–M3, chính sách kênh | INT/BE/DB | DR/QA | TODO |
| M5 | CSKH, đổi trả, bảo hành | M3, chính sách hậu mãi và tiền | BE/FE | DR/QA | TODO |
| M6 | Dashboard, E2E, đóng gói demo | Các hành trình được chọn từ M1–M5 | FE/DX | QA/BA | TODO |

README ưu tiên M1–M3 nhưng demo tối thiểu còn yêu cầu trường hợp M4–M5. Cần xác nhận phạm vi nghiệm thu cuối với nguồn KTHT/người dùng; không mặc định loại bỏ các trường hợp đó. Test và tài liệu đi cùng từng slice, không đợi M6.

## UI sitemap va thu tu trien khai TASK-006

| Slice | Man hinh | Dependency | Owner | Reviewer | Trang thai |
| --- | --- | --- | --- | --- | --- |
| M1-A | Auth/RBAC contract va shared layouts | ADR auth, identity schema, 401/403/404 | SA+BE+FE | SEC+QA | PLANNED |
| M1-B | C02 doc danh muc phan trang | `GET /api/products`, TASK-007 | FE+BE | QA | IN_PROGRESS — read slice da duoc QA kiem tra runtime; catalog contract day du van pending |
| M1-C | C01, C03 va catalog query/detail contract | category/SKU/slug/search/filter/sort | FE+BE+DB | BA+QA | PLANNED |
| M2-A | C04-C06, C10-C11, A05-A06, A09, A12 | OrderItem, reservation SKU-lo-kho, state table | FE+BE+DB | DR+QA+SEC | PLANNED |
| M3-A | A10-A11, A15-A16, A23 | fulfillment/payment contracts | FE+BE+DB+INT | DR+QA | PLANNED |
| M4-A | A13-A14, A27 | quota allocation, inbox/outbox, simulated adapters | INT+BE+DB+FE | DR+QA+SEC | PLANNED |
| M5-A | C12-C13, A17-A22 | RMA/QC/refund/warranty/ticket contracts | FE+BE+DB | DR+QA+SEC | PLANNED |
| M6-A | A01, A24, E2E/demo packaging | source data from M2-M5 | FE+DX | BA+QA | PLANNED |

C01-C13 va A01-A27 chi duoc chuyen `IMPLEMENTED` khi tung route goi contract FE-BE-DB that. `VERIFIED` yeu cau test phu hop va finding chan nghiem thu da duoc dong.
