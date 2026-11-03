---
id: TASK-008
title: Catalog C01–C03 và hai layout
status: IN_PROGRESS
owner: CO+FE+BE+DB
reviewers: [QA, DR]
review_mode: independent-agent
scope_paths: [frontend, backend, tests/e2e, docs, README.md, AGENTS.md]
depends_on: [TASK-006, TASK-007]
business_rules: [BR-CAT-001]
source_refs: [docs/ui/sitemap.md, docs/architecture/inventory-model.md, docs/adr/ADR-003-local-demo-scope.md]
assumptions: [Nguồn KTHT chưa có trong docs/source; active SKU chỉ là đang niêm yết không chứng minh tồn bán được]
---

## Phạm vi và phân công

CO sở hữu contract, tài liệu và tích hợp. Agent catalog_fe sở hữu frontend; agent catalog_be sở hữu backend, schema và migration; catalog_review sở hữu tests/e2e và review độc lập QA/DR. Không sửa chung file. Contract thống nhất ở docs/api/catalog.md.

C01 trang chủ, C02 danh sách có query, C03 chi tiết SKU, CustomerLayout và AdminLayout shell. Ngoài phạm vi: giỏ hàng, auth, nghiệp vụ admin, tồn kho, đơn, thanh toán. Admin shell chỉ có cấu trúc không chứa dữ liệu quản trị; menu chưa triển khai là nhãn PLANNED không có liên kết giả.

## Tiêu chí Given/When/Then

- Given SQL có seed, When mở trang chủ, Then danh mục và sản phẩm nổi bật lấy từ API; ảnh thiếu ghi rõ placeholder.
- Given danh sách, When tìm/lọc/sắp xếp/chuyển trang, Then query URL phản ánh điều kiện và API trả đúng dữ liệu, thứ tự ổn định.
- Given chi tiết, When đổi SKU, Then giá/mã/ảnh phản ánh SKU chọn; số lượng hợp lệ; không báo thêm giỏ thành công khi giỏ chưa triển khai.
- Given sản phẩm/SKU không tồn tại hoặc chưa công khai, When truy cập, Then thông báo phù hợp, không suy diễn có hàng và không lộ số dư nội bộ.
- Given API tải/lỗi/rỗng, Then UI có trạng thái và retry khi phù hợp.
- Given mobile hoặc bàn phím, Then không tràn ngang, form có label và focus rõ.
- Given migration đã chạy, When chạy lại, Then không nhân đôi seed và giữ dữ liệu cũ.

## Contract, schema và rủi ro

GET categories, products query và products/{slug}; xem docs/api/catalog.md. Bổ sung Categories và ProductVariants; giữ dữ liệu Product cũ, backfill variant, slug duy nhất. Giá decimal; giá danh sách là giá thấp nhất trong SKU hoạt động. Không thay mô hình SKU–lô–kho.

Rủi ro: EF translation, migration giữ dữ liệu, URL input lỗi, stale request khi đổi filter/SKU. Kiểm tra build/lint/typecheck/test và smoke SQL thật; browser chỉ ghi đã kiểm tra khi chạy được.

## Bàn giao

Đang triển khai. Kết quả và finding cập nhật sau review.
