# Review TASK-010

- Vòng 1: `sequential-self-review` (tác giả tự rà soát) và critique giao diện do hai agent độc lập thực hiện.
- Vòng 2: `independent-agent`. Một agent DR/SEC/QA không viết code, chỉ đọc diff, contract, AGENTS.md và chạy test (finding R-xxx).
- Retest: tác giả sửa lỗi rồi chạy `tests/e2e/task010-api.mjs` trên SQL Server test riêng `KTHT_Ecom_Test`, có request đồng thời. Retest này chưa do người thứ ba thực hiện lại.

## Finding

| ID | Sev | Nguồn/BR | Vị trí | Tái hiện | Mong đợi / Thực tế trước khi sửa | Hướng sửa đã làm | Owner | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-001 | P1 | AGENTS §8, BR-AUTH-001 | `GET /api/orders/{codeOrId}` | Gọi `/api/orders/1`, `/2`… không token | Ai cũng xem được tên/SĐT/địa chỉ (ID tuần tự) | Bắt buộc đăng nhập; Customer chỉ xem đơn của mình (404 nếu khác), nhân viên xem được. Đặt hàng bắt buộc đăng nhập (chính sách người dùng chốt 2026-11-13). | BE+SEC | VERIFIED (task010-api: 401/404/200) |
| F-002 | P1 | AGENTS §8 | `POST /api/orders/{id}/cancel` | Hủy đơn người khác không token; hủy đồng thời | Hủy được đơn bất kỳ; hủy đồng thời gây deadlock 500 | Chỉ chủ đơn hoặc Sales/Admin; claim trạng thái bằng conditional update, giảm R nguyên tử; xung đột → 409 | BE+SEC | VERIFIED (404/403; race 1 thắng, R giảm đúng 1; 3 lần chạy, 0 lỗi 500) |
| F-003 | P1 | AGENTS §7 | `POST /api/orders` | Đặt SKU chưa có `InventoryBalances` | Tự tạo P=100, B=10 rồi giữ hàng | Rollback và trả 409; không tạo bản ghi tồn | BE+DB | VERIFIED (409, COUNT=0, availability=null) |
| F-004 | P2 | AGENTS §8 (COD giao ≠ đã đối soát) | `POST /api/admin/orders/{id}/deliver` | Giao đơn COD | `PaymentStatus` tự thành `Paid` | Giao hàng giữ `Pending`; thêm `POST /api/admin/orders/{id}/confirm-payment` (Sales/Admin, Pending→Paid một lần); hoàn tiền yêu cầu `Paid` | BA+BE | VERIFIED (Pending sau giao; 403 với Warehouse; race 200/409; refund chưa đối soát → 409) |
| F-005 | P1 | AGENTS §8 | `POST /api/me/returns` | RMA cho đơn người khác; nhiều RMA cho một đơn | Tạo được, không kiểm tra chủ | Chủ đơn mới tạo được; một RMA mỗi đơn trong transaction Serializable; deadlock/unique → 409 | BE | VERIFIED (404; 3 vòng × 3 request đồng thời: đúng 1 thành công, DB có 1 RMA) |
| F-006 | P0 | PRODUCT.md Brand Commitments | Footer, hero, thanh thông báo, chatbot | Mở trang chủ | Số ĐKKD/CCHN giả, "GPP", "chính hãng", "24/7" | Gỡ toàn bộ; thêm nhãn "Bản demo môn KTHT"; regex test mở rộng theo R-008 | FE | VERIFIED (unit test) |
| F-007 | P1 | Nguyên tắc 1 PRODUCT.md | Giỏ/checkout | Sửa giá trong localStorage | Tổng tiền đổi theo | Dùng `/api/cart/validate` | FE | VERIFIED (unit test) |
| F-008 | P3 | DESIGN.md | Console admin | — | 5 lỗi lint `any`, 39 inline style, Bootstrap CSS toàn cục | — | FE | DEFERRED (task admin riêng) |
| R-001 | P1 | AGENTS §8 (tổng trả ≤ đã giao) | `POST /api/me/returns` | Gửi 2 dòng trùng `orderItemId` | RMA 2 đơn vị cho dòng chỉ giao 1; BE nhận trả một phần | `ReturnPolicy.ValidateFullOrder` (Application): đúng mỗi dòng một lần, đủ số lượng đã giao; còn lại 400 | BE | VERIFIED (Checks 9 case; task010-api: dòng trùng 400, một phần 400) |
| R-002 | P2 | Giá BE nhất quán | `cart/validate`, `promotions/validate` so với `POST /api/orders` | Flash quota còn 1, giỏ có 3 | Validate báo giá flash × 3, đơn tính giá gốc | Cả hai validator dùng `QuantityLimit - SoldCount >= quantity` giống tạo đơn | BE | FIXED_PENDING_RETEST (chưa có test riêng cho flash quota) |
| R-003 | P3 | Độ bền | `POST /api/me/returns` | Deadlock ở bước SELECT; trùng mã RMA ngẫu nhiên | 500 / 409 sai thông điệp | Bắt `SqlException` 1205/3960/2601/2627 cho cả khối; mã `RMA-{OrderCode}` | BE | VERIFIED (log: 0 unhandled sau 3 lần chạy) |
| R-004 | P2 | State table | RMA `Rejected` | — | Trạng thái `Rejected` không bao giờ được gán | Ghi rõ: mỗi đơn chỉ một RMA (kể cả QC không đạt); bỏ nhánh `Rejected` ở FE/BE | BA | VERIFIED (contract cập nhật) — cần BA chốt nếu muốn cho gửi lại |
| R-005 | P2 | SEC | `latestReturn` trên GET đơn không xác thực | — | Lộ thông tin hoàn tiền | Đã khép cùng F-001 | BE | VERIFIED |
| R-006 | P3 | FE | `useCartValidation` | SKU chứa `|` | Tách dòng sai | Khóa phụ thuộc bằng JSON | FE | FIXED (unit test hiện có vẫn pass; chưa có case SKU đặc biệt) |
| R-007 | P3 | a11y | `Dialog` | Nút bị khóa khi busy; nút mở biến mất sau hủy | Focus rơi ra body/node rời | Panel `tabIndex=-1`, kéo focus về panel; fallback về `#main-content h1` | FE | FIXED (chưa có test tự động riêng) |
| R-008 | P3 | QA | `App.test.tsx` | — | Regex không bắt lại câu "chính hãng" cũ | Kiểm `document.body.textContent` với `/chính hãng\|GPP\|CCHN\|ĐKKD\|24\/7/` | QA | VERIFIED |
| R-009 | P1 | AGENTS §7.3 | `receive`, `qc`, `refund`, `approve`, `confirm`, `fulfill` (reviewer nêu `receive`; tác giả mở rộng) | Gọi lặp/đồng thời | Nhận hàng hai lần cộng P/Q hai lần; QC trừ hai lần; xác nhận có thể ghi đè đơn vừa hủy | Mỗi chuyển trạng thái claim bằng conditional update trước khi đọc; tồn kho cập nhật nguyên tử trong SQL | BE | VERIFIED (race receive/qc/refund/confirm-payment 200/409; hủy vs xuất kho 3×3 vòng, đủ cả hai kết quả, R/P khớp; xác nhận vs hủy nhất quán) |

## Bằng chứng retest (2026-11-13)

- `dotnet build backend/Ktht.sln --no-restore`: thành công, 0 warning.
- `dotnet run --project backend/tests/Ktht.Catalog.Checks`: 25/25 PASS.
- `npm.cmd --prefix frontend run test -- --run`: 29/29 PASS (thêm test chặn đăng nhập C06/C11, copy hủy/bước tiếp theo, ẩn copy seed giữ chỗ, bộ lọc thu gọn, Enter ở ô mã giảm giá, đăng ký giữ nguyên checkout, nhãn trạng thái đổi trả). Typecheck và build thành công. Lint còn 5 lỗi `any` có sẵn ở admin (F-008).
- `KTHT_TEST_DB=KTHT_Ecom_Test node tests/e2e/task010-api.mjs http://127.0.0.1:5081`: chạy 3 lần liên tiếp, mỗi lần 47/47 PASS. Log API: 0 "unhandled exception". Deadlock vẫn được EF ghi log nhưng đều trả 409.
- `tests/e2e/full-flow-test.mjs` (cập nhật theo contract mới): 36 PASS. `tests/e2e/promotion-api.mjs` (`KTHT_ALLOW_MUTATING_E2E=1`): 10 PASS. Cả hai chạy trên `KTHT_Ecom_Test`.
- Critique storefront lần 2 (dual-agent, `.impeccable/critique/2026-11-13T08-02-00Z__frontend-src-app-tsx.md`): 26/40 (lần 1: 19/40). P1 "C06/C11 chưa chặn đăng nhập ở UI" đã sửa bằng `OrderAccessError` (401 → đăng nhập; 403/404 → không tìm thấy đơn). Detector nguồn `[]`.

## Còn mở

- Chưa có người thứ ba chạy lại retest (AGENTS §4.7).
- R-002 chưa có test cho trường hợp quota flash sale nhỏ hơn số lượng.
- Tạo đơn đồng thời cho cùng SKU (`POST /api/orders`, Serializable đọc-rồi-ghi) không nằm trong phạm vi; chưa đo tỷ lệ deadlock.
- Sau critique 2 (người dùng chọn "khung trung tính + chú thích"): ảnh seed đặt trong khung trung tính, trang chi tiết ghi "Ảnh tham khảo… có thể mang nhãn của nhà bán khác"; mô tả/danh mục giữ chỗ không hiển thị như thông tin thật; bộ lọc mobile thu gọn sau "Bộ lọc (n)", sắp xếp áp dụng ngay, lưới 2 cột ≤480px (SP đầu tiên trên /products @390 từ ~1230px lên 560px); copy hủy/trả hàng nói về tiền, dải "Tiếp theo" ở trang kết quả; h1/h2 đúng thang; bỏ disclaimer lặp; favicon và meta description trung thực. Ảnh vẫn còn logo nhà bán khác bên trong (chưa thay ảnh); 
- Critique lần 3 (dual-agent, `.impeccable/critique/2026-11-13T08-22-54Z__frontend-src-app-tsx.md`): 26/40, phát hiện 3 P1 đã sửa ngay: (1) Enter trong ô mã giảm giá gửi form đặt hàng → Enter chỉ áp dụng mã; (2) đăng ký từ tường đăng nhập luôn chuyển tới `/account/orders` → giữ trang hiện tại như đăng nhập; (3) nút "Bộ lọc" hiện trên desktop do `.shop .btn-outline` đè (lỗi do vòng sửa critique 2) → ẩn đúng, chụp 1440px xác nhận thanh lọc một hàng. Theo lựa chọn người dùng "lời khách + dòng phụ thuật ngữ": rail hiển thị nhãn khách ("Đã nhận hàng trả · Đang kiểm tra chất lượng") kèm dòng phụ nghiệp vụ; "Đối soát thanh toán" → "Xác nhận thanh toán". Còn mở từ critique 3 (P2, chưa làm): chip "Ảnh tham khảo" trên card, toast hủy theo trạng thái thanh toán, chi tiết ticket, link hỗ trợ từ C11.
- Mã đơn `ORD-yyyyMMdd-xxxxx` vẫn sinh ngẫu nhiên (có từ trước).

Đề xuất trạng thái: không còn P0/P1 OPEN. Còn chờ một lượt QA độc lập xác nhận retest trước khi chuyển DONE.
