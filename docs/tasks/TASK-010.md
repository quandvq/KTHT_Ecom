---
id: TASK-010
title: Minh bạch nghiệp vụ và hoàn thiện giao diện storefront theo critique
status: IN_REVIEW # đã có review độc lập + retest SQL Server; chờ QA độc lập xác nhận lại retest
owner: FE+BE
reviewers: [DR, SEC, QA]
review_mode: independent-agent
scope_paths: [tests/e2e/task010-api.mjs, backend/src/Ktht.Application/Returns.cs, frontend/src, backend/src/Ktht.Application/Products.cs, backend/src/Ktht.Infrastructure/ProductReader.cs, backend/src/Ktht.Api/Program.cs, backend/tests/Ktht.Catalog.Checks, DESIGN.md, PRODUCT.md, .impeccable]
depends_on: [TASK-009]
business_rules: [BR-INV-001, BR-ORD-001, BR-AUTH-001]
source_refs: [PRODUCT.md, DESIGN.md, .impeccable/critique/2026-11-13T07-02-29Z__frontend-src-app-tsx.md]
assumptions:
  - Storefront chỉ hiển thị mức tồn (Còn hàng / Sắp hết / Hết hàng), không hiển thị số U; ngưỡng "sắp hết" là U <= 5.
  - SKU chưa có bản ghi InventoryBalances trả availability = null (không hiển thị mức) thay vì đoán.
  - Mỗi đơn chỉ có một yêu cầu đổi trả đang hiệu lực (khác Rejected); MVP chỉ hỗ trợ trả toàn bộ đơn.
  - Font hệ thống thay cho Inter (không tự host webfont trong đợt này).
  - (Người dùng chốt 2026-11-13) Xem, hủy và đặt đơn bắt buộc đăng nhập; chỉ chủ đơn hoặc nhân viên xem; hủy bởi chủ đơn hoặc Sales/Admin.
  - (Người dùng chốt 2026-11-13) Giao hàng không tự xác nhận thanh toán; Sales/Admin đối soát riêng.
  - Mỗi đơn chỉ một RMA, kể cả khi QC không đạt (chưa có bước từ chối trong state table).
---

## Mục tiêu và ngoài phạm vi

Xử lý toàn bộ priority issue của critique storefront (19/40): gỡ claim bịa (GPP, ĐKKD, CCHN, "100% chính hãng", "24/7"), hiển thị giá/tồn do BE xác nhận, thống nhất trạng thái tiếng Việt và tách vòng đời Đơn/Thanh toán/Đổi trả, sửa modal/lỗi/mobile, typography, màu ngoài token, icon.

Ngoài phạm vi: console admin (inline style, `any`; chỉ thêm nút "Xác nhận đã thu tiền" và nhãn trạng thái), endpoint báo giá riêng (dùng lại `POST /api/cart/validate`), cổng thanh toán thật, tạo đơn đồng thời cho cùng SKU.

## Tiêu chí Given/When/Then

- Given SKU có U = 0, When khách mở trang chi tiết, Then thấy "Hết hàng" và nút "Mua ngay"/"Thêm vào giỏ hàng" bị khóa. (test FE)
- Given giá trong localStorage khác giá BE, When mở giỏ/checkout, Then dòng và tổng tiền dùng giá từ `/api/cart/validate`, có ghi chú "Giá đã cập nhật theo hệ thống". (test FE)
- Given số lượng vượt tồn khả dụng, When kiểm tra giỏ, Then dòng báo "Chỉ còn N…", nút "+" và nút đặt hàng bị khóa. (test FE)
- Given BE trả 409 khi đặt hàng, When đặt, Then hiện lỗi `role=alert` và giỏ được kiểm tra lại. (code; chưa có test riêng)
- Given đơn đã có RMA, When xem C11, Then không còn nút đổi trả, hiện trạng thái RMA tiếng Việt. (test FE)
- Given hai request RMA cho cùng đơn, When gửi, Then chỉ một được tạo, request còn lại 409. (code: transaction Serializable + kiểm tra trong transaction; **chưa chạy test tranh chấp trên SQL Server**)
- Given khách A gửi RMA cho đơn của khách B, Then 404. (code; chưa có integration test)
- Given trang chủ/footer, Then không còn số giấy phép, GPP, "24/7"; có nhãn "Bản demo môn KTHT". (test FE)

## Contract thay đổi

Thay đổi phá vỡ (có chủ đích, đã được người dùng chốt): `POST /api/orders`, `GET /api/orders/{codeOrId}`, `POST /api/orders/{id}/cancel` yêu cầu token (401); Customer chỉ truy cập đơn của mình (404). `deliver` không còn đặt `PaymentStatus = Paid`.

Bổ sung:

- `POST /api/admin/orders/{id}/confirm-payment` (Sales/Admin): Delivered + Pending → Paid một lần; lặp/đồng thời → 409.
- `POST /api/orders`: SKU chưa có bản ghi tồn → 409 (F-003); Idempotency-Key của người khác → 409.
- `POST /api/me/returns`: chỉ nhận trả toàn bộ đơn (400 nếu trùng/thiếu/sai số lượng), mã `RMA-{OrderCode}`, một RMA mỗi đơn (409).
- RMA admin `approve`/`receive`/`qc`/`refund` và đơn `confirm`/`fulfill`/`cancel`: chỉ chuyển từ đúng trạng thái nguồn, một lần; sai trạng thái/đồng thời → 400/409. `refund` yêu cầu đơn đã `Paid`.


- `GET /api/products`, `GET /api/products/{slug}`: thêm `availability` (`InStock | LowStock | OutOfStock | null`) ở item và từng variant.
- `GET /api/orders/{codeOrId}`: thêm `subtotalAmount`, `discountAmount`, `promotionCode`, `latestReturn { returnCode, status, refundAmount, createdAt } | null`.
- `POST /api/me/returns`: 400 nếu không có dòng/số lượng <= 0; 404 nếu đơn không thuộc người gọi; 409 nếu đơn đã có RMA khác Rejected hoặc xung đột serializable.
- Không đổi schema, không có migration.

## Bàn giao

File chính: `frontend/src/App.tsx`, `frontend/src/status.ts` (mới), `frontend/src/products.ts`, `frontend/src/styles/catalog.css`, `frontend/src/styles/storefront-theme.css`, `frontend/src/App.test.tsx`, `backend/src/Ktht.Application/Products.cs`, `backend/src/Ktht.Infrastructure/ProductReader.cs`, `backend/src/Ktht.Api/Program.cs`, `backend/tests/Ktht.Catalog.Checks/Program.cs`, `DESIGN.md`, `.impeccable/design.json`.

Kiểm tra đã chạy (2026-11-13):

| Lệnh | Kết quả |
| --- | --- |
| `dotnet build backend/Ktht.sln --no-restore` | Thành công, 0 warning |
| `dotnet run --project backend/tests/Ktht.Catalog.Checks` | 24/24 PASS (thêm check mức tồn từ U) |
| `npm.cmd --prefix frontend run typecheck` | Thành công |
| `npm.cmd --prefix frontend run test -- --run` | 20/20 PASS (6 test mới) |
| `npm.cmd --prefix frontend run build` | Thành công |
| `npm.cmd --prefix frontend run lint` | 5 lỗi `no-explicit-any` ở admin, có sẵn từ trước (HEAD có 7; đã sửa 2 lỗi ở storefront) |
| `impeccable detect --json frontend/src` | `[]` |
| Chạy thật API + Vite trên `KTHT_Ecom_Dev` (chỉ GET) và chụp Edge headless 1440/390px: `/`, `/products`, chi tiết, giỏ, checkout, đơn hàng | Không overflow ngang, không lỗi console; API trả `availability` |

Chưa chạy: integration/concurrency test RMA trên SQL Server test riêng; E2E đặt hàng thật (`tests/e2e/*`, cần DB test riêng); C11 với dữ liệu thật đã đăng nhập (chỉ có test FE với mock).

Reviewer cần chú ý: transaction RMA (Serializable, bắt `DbUpdateException` → 409, nhưng deadlock có thể nổ ở bước SELECT và trả 500); `useCartValidation` khóa đặt hàng khi BE không phản hồi; finding F-001…F-004 có từ trước, chưa sửa.

## Vòng 2 (sau review độc lập, 2026-11-13)

Bảng kiểm tra phía trên là của vòng 1. Kết quả vòng 2 xem tại `docs/reviews/TASK-010.md`, mục "Bằng chứng retest":

- Checks 25/25.
- FE test 29/29 (gồm chặn đăng nhập C06/C11, các sửa sau critique 2 và 3 P1 của critique 3).
- `tests/e2e/task010-api.mjs` 47/47, chạy 3 lần trên `KTHT_Ecom_Test`, 0 lỗi 500.
- `tests/e2e/full-flow-test.mjs` 36 PASS, `tests/e2e/promotion-api.mjs` 10 PASS trên `KTHT_Ecom_Test`.
- Critique storefront lần 2: 26/40 (từ 19/40); đã xử lý theo lựa chọn "khung trung tính + chú thích" cùng các P2/P3 (xem docs/reviews/TASK-010.md). Critique lần 3: 26/40; 3 P1 đã sửa, P2 còn mở.

Tạo lại môi trường test:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=(localdb)\mssqllocaldb;Database=KTHT_Ecom_Test;Trusted_Connection=True;TrustServerCertificate=True"
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet ef database update --project backend/src/Ktht.Infrastructure --startup-project backend/src/Ktht.Api
dotnet run --project backend/src/Ktht.Api -- --import-pharmacity
dotnet run --project backend/src/Ktht.Api -- --seed-demo
dotnet run --project backend/src/Ktht.Api --urls http://127.0.0.1:5081
# terminal khác
$env:KTHT_TEST_DB = "KTHT_Ecom_Test"; node tests/e2e/task010-api.mjs http://127.0.0.1:5081
```
