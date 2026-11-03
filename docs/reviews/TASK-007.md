# Review TASK-007

review_mode: independent-agent
reviewer: QA/BE
status: VERIFIED_FOR_TASK_SCOPE

| ID | Severity | State | Finding | Evidence retest |
| --- | --- | --- | --- | --- |
| F-007-REVIEW-01 | P2 | VERIFIED | Test ban đầu chỉ có happy path, thiếu EmptyState, lỗi/retry và phân trang. | Reviewer độc lập kiểm tra test mới: `items: []`; rejected fetch → alert → retry; query page 1→2→1. Author chạy Vitest 6/6 và build thành công. |

## Phạm vi xác minh và điểm còn lại

Reviewer chấp nhận mã C02 trong phạm vi API M1 hiện có: gọi `GET /api/products`, không hardcode sản phẩm, không dựng filter/search/sort giả và không có side effect tồn kho/đơn.

C02 trong `page-inventory.md` vẫn là `IN_PROGRESS (partial M1)`, không phải `IMPLEMENTED` hay `VERIFIED`: runtime FE–Vite proxy–BE đã chạy thật, nhưng còn thiếu contract catalog cho search, filter, sort và slug/detail, CustomerLayout/router, cùng test contract/backend tự động.

## Bổ sung kiểm tra tích hợp độc lập

QA đã kiểm tra trực tiếp các tiến trình đang chạy trên cổng `5080` và `5173`:

| Kiểm tra | Kết quả |
| --- | --- |
| `GET /api/products` trực tiếp và qua Vite proxy | `200`; cùng payload một sản phẩm seed với `id`, `name`, `sku`, `price`, `page`, `pageSize`, `totalCount` |
| `GET /api/products?page=2&pageSize=20` | `200`; `items` rỗng, `page=2`, `totalCount=1` |
| `page=0` hoặc `pageSize=101` | `400 ValidationProblem` cho pagination, trực tiếp và qua proxy |
| Rò rỉ tồn kho | Không thấy: BE chỉ map `Id`, `Name`, `Sku`, `Price`; entity/migration hiện không có reservation hay quota |

Không phát hiện P0/P1. P2 còn mở ở mức M1: chưa có test contract/backend tự động cho response, validation và chỉ trả sản phẩm published.
