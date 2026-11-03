---
id: TASK-003
title: Theme storefront cho danh mục sản phẩm
status: IN_REVIEW
owner: FE
reviewers: [QA]
review_mode: sequential-self-review
scope_paths: [frontend/src, docs/tasks/TASK-003.md, docs/reviews/TASK-003.md]
depends_on: [TASK-002]
business_rules: [BR-CAT-001]
source_refs: [README.md, AGENTS.md]
assumptions: [Thông số tham khảo giao diện do người dùng cung cấp; chưa có trang chi tiết sản phẩm]
---

## Mục tiêu và ngoài phạm vi

Tích hợp theme storefront vào header, danh sách sản phẩm, thông báo và phân trang hiện có. Không đổi API, nghiệp vụ, dữ liệu hoặc thêm chức năng chưa tồn tại.

## Tiêu chí chấp nhận

- Given danh mục có dữ liệu, When trang hiển thị, Then thẻ dùng theme sáng, tên và giá đọc được trên các kích thước màn hình.
- Given trang đang tải, rỗng hoặc lỗi, When trạng thái xuất hiện, Then thông báo và thao tác thử lại vẫn hiển thị.
- Given điều hướng bằng bàn phím, When nút nhận focus, Then focus hiển thị rõ; nút vô hiệu hóa có trạng thái phân biệt.
- Given frontend chưa chạy được, When bàn giao, Then không tuyên bố đã kiểm tra trình duyệt hay build.

## Hợp đồng và rủi ro

Không ảnh hưởng API hay schema. CSS có phạm vi storefront và dùng token riêng; tên sản phẩm giữ đầy đủ do chưa có trang chi tiết. Responsive, zoom và tương phản trong trình duyệt cần kiểm chứng khi môi trường chạy được.

## Bàn giao

`frontend/src/styles/storefront-theme.css`, `App.tsx`, `main.tsx`; không thêm dependency. `git diff --check` thành công cho file được Git theo dõi. `npm.cmd --prefix frontend run lint` và `npm.cmd --prefix frontend run build` không chạy được vì npm không có trong PATH; chưa kiểm tra trình duyệt. Xem review để tiếp tục xác minh.
