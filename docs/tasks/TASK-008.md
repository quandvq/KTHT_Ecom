---
id: TASK-008
title: Catalog C01–C03 và hai layout
status: DONE
owner: CO+FE+BE+DB
reviewers: [QA, DR]
review_mode: sequential-self-review
scope_paths: [frontend, backend, tests/e2e, docs, README.md, AGENTS.md]
depends_on: [TASK-006, TASK-007]
business_rules: [BR-CAT-001]
source_refs: [docs/ui/sitemap.md, docs/architecture/inventory-model.md, docs/adr/ADR-003-local-demo-scope.md]
assumptions: [Nguồn KTHT chưa có trong docs/source; active SKU chỉ là đang niêm yết không chứng minh tồn bán được]
---

## Phạm vi và phân công

CO sở hữu contract, tài liệu và tích hợp. FE hoàn thiện CustomerLayout, AdminLayout shell, 3 trang C01-C03 và các component dùng chung. BE hoàn thiện API đọc danh mục, danh sách và chi tiết kèm validation. QA kiểm tra E2E API và visual browser bằng Chrome headless. Reviewer tự rà soát theo AGENTS.md (sequential-self-review).

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

## Bàn giao và kết quả xác minh

- Đã sửa `backend/src/Ktht.Api/Program.cs`: bắt `BadHttpRequestException` trả 400 ProblemDetails thay vì 500.
- Đã sửa `frontend/src/App.tsx`: cập nhật `filterKey` chống mất state select khi tải danh mục bất đồng bộ.
- Đã sửa `tests/e2e/browser-cdp.mjs`: bọc `Boolean(...)` trong `until` tránh lỗi tuần tự hóa DOM node trong CDP.
- `dotnet run --project backend/tests/Ktht.Catalog.Checks`: 16/16 checks PASS.
- `npm.cmd run test -- --run`: 11/11 tests PASS.
- `npm.cmd run typecheck`: PASS; `npm.cmd run lint`: PASS; `npm.cmd run build`: PASS.
- Seed demo idempotency: chạy lại `--seed-demo` giữ nguyên 18 sản phẩm, 4 danh mục, 48 biến thể trên SQL Server `KTHT_Ecom_Dev`.
- E2E API live: `node tests/e2e/catalog-api.mjs http://127.0.0.1:5080`: 61 requests PASS.
- E2E Visual Headless Chrome: `node tests/e2e/catalog-browser.mjs http://127.0.0.1:5173 9222`: 14 checks PASS, xuất 6 ảnh chụp màn hình vào `tests/e2e/artifacts/`.
- Review report chi tiết tại `docs/reviews/TASK-008.md`. C01, C02, C03 chuyển sang trạng thái `VERIFIED` trong `docs/ui/page-inventory.md`.
