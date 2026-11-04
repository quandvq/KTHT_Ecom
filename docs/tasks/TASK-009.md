---
id: TASK-009
title: Loại bỏ đa kênh và bổ sung mã khuyến mãi
status: DONE
owner: CO+FE+BE+DB
reviewers: [QA, DR, SEC]
review_mode: independent-agent
scope_paths: [frontend, backend, tests/e2e, docs, README.md, USER_GUIDE.md]
depends_on: [TASK-008]
business_rules: [BR-ORD-001, BR-IDEM-001, BR-AUTH-001]
source_refs: [docs/architecture/inventory-model.md, docs/ui/page-inventory.md]
assumptions: [Chỉ bán trực tiếp trên website; một đơn chỉ áp dụng tối đa một promotion code]
---

## Mục tiêu và ngoài phạm vi

Loại bỏ tiếp nhận đơn và quota từ các sàn; xóa dữ liệu đơn sàn demo nhưng giữ nguyên đơn website. Sửa state đăng nhập/giỏ hàng để UI cập nhật ngay, giữ lựa chọn sort theo URL. Bổ sung promotion code được BE tính và kiểm tra, đúng một mã trên mỗi đơn, cùng 50 mã demo idempotent.

Không bổ sung voucher chồng mã, khuyến mãi tự động, campaign theo kênh, thanh toán thật hoặc trang quản trị promotion trong đợt này.

## Phân công

- CO: contract, tích hợp, migration/cleanup database và tài liệu.
- BE+DB: bỏ endpoint/schema sàn; promotion model, API, order calculation, migration và seed.
- FE: shared auth/cart state, sort query và giao diện áp/xóa một mã.
- QA+DR+SEC: test độc lập giá/giới hạn/quyền, DB thật và hành trình UI.

## Tiêu chí Given/When/Then

- Given dữ liệu cũ có đơn `EXT-*`, When cleanup, Then chỉ đơn sàn và quota liên quan bị xóa; reservation được hoàn nguyên và đơn website còn nguyên.
- Given API mới, When gọi endpoint channel cũ, Then không còn route xử lý; UI không còn tab/nút mô phỏng sàn.
- Given đăng nhập thành công, When modal đóng, Then header và trang tài khoản nhận user ngay mà không reload.
- Given sort được áp dụng, When kết quả tải lại hoặc category tải bất đồng bộ, Then select vẫn phản ánh query URL.
- Given một code hợp lệ, When áp tại checkout, Then BE tính subtotal/discount/total từ SKU hiện hành và FE hiển thị kết quả.
- Given code thứ hai, When áp, Then nó thay thế mã đang chọn; payload đơn chỉ có một `promotionCode`.
- Given code sai/hết hạn/hết lượt/chưa đạt tối thiểu, Then đơn không nhận giảm giá và trả lỗi rõ.
- Given retry cùng idempotency key/payload, Then không tăng usage hoặc tạo đơn lần hai.

## Contract và dữ liệu

`POST /api/promotions/validate` nhận `{code, items:[{sku,quantity}]}`. `POST /api/orders` nhận thêm một trường `promotionCode`. Order lưu snapshot code, subtotal và discount; total do BE tính. Promotion có code unique, loại `Percent|Fixed`, giá trị, đơn tối thiểu, trần giảm, thời gian hiệu lực, giới hạn lượt, số lượt dùng và trạng thái.

## Bàn giao

Đang triển khai. Kết quả kiểm tra và finding được ghi ở `docs/reviews/TASK-009.md`.
