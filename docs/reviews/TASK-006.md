# Review TASK-006

review_mode: independent-agent
reviewer: DR/QA
status: DEFERRED_FOR_IMPLEMENTATION

| ID | Severity | Finding | Owner | Huong xu ly |
| --- | --- | --- | --- | --- |
| F-006-01 | P1 | Chua co auth/authorization contract. C07-C13 va A01-A27 khong duoc trien khai/ghi nhan hoan tat dua tren route guard FE. | SA+BE+SEC | Chot ADR auth, 401/403/404, ownership va role-action matrix truoc protected routes. |
| F-006-02 | P1 | Chua co contract order-reservation-fulfillment. C04-C06, C10-C11, A05-A16 phai PLANNED. | SA+BE+DB | Chot OrderItem/reservation SKU-lo-kho, idempotency, price server-side, conflict va state table M2-M3. |
| F-006-03 | P1 | `GET /api/products` khong co slug/category/search/filter/sort/detail; landing About us khong phai C01. | FE+BE | Chot public catalog projection, C01-C03 va khong lo ton/quota noi bo. |
| F-006-04 | P2 | Partial, review duoc si/risk, P/Q/B/R/A/U, payment/refund, integration va simulator can action matrix/contract rieng. | BA+SA+BE+DB+INT | Dua vao user flows va milestone phu hop; khong tao generic action control. |

F-006-01 den F-006-04 la blocker de chuyen man hinh lien quan sang IMPLEMENTED/VERIFIED; khong chan viec chot inventory, sitemap va user flow.

## Giai quyet

F-006-01 den F-006-04 khong vi pham dau ra B1-B2; chung la blocker implementation va da duoc dua vao docs/backlog.md (M1-A/M1-C/M2-A/M4-A/M5-A/M6-A). TASK-006 chi dong pham vi quy hoach; moi slice code phai mo task/review rieng truoc khi chuyen trang sang IMPLEMENTED.

