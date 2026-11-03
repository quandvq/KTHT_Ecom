# Review TASK-008: Catalog C01–C03 và hai layout

review_mode: sequential-self-review
reviewer: QA/DR/SEC (self-review role)
status: VERIFIED_FOR_TASK_SCOPE

| ID | Severity | State | Finding | Evidence retest |
| --- | --- | --- | --- | --- |
| F-008-01 | P2 | VERIFIED | Minimal API trả 500 thay vì 400 khi query param sai định dạng (`page=abc`, `featured=bad`) do `app.UseExceptionHandler()` mặc định bắt mọi exception thành 500. | Cấu hình `UseExceptionHandler` để bắt `BadHttpRequestException` và trả đúng `badHttp.StatusCode` (400) kèm ProblemDetails. `catalog-api.mjs` gọi 64 validation queries đều trả đúng 400. |
| F-008-02 | P2 | VERIFIED | `FilterBar` category select bị reset về rỗng khi `categories` tải bất đồng bộ xong do `FilterBar key` chỉ bám theo `params.toString()` mà không theo dõi categories. | Cập nhật `filterKey` chứa danh sách categories đã tải (`${params.toString()}-${categories.map(c => c.id).join('-')}`). `catalog-browser.mjs` kiểm tra URL query category restore thành công. |
| F-008-03 | P3 | VERIFIED | CDP `until` trong `browser-cdp.mjs` gọi `Runtime.evaluate` với `returnByValue: true` trên biểu thức trả về DOM node gây lỗi `-32000 Object reference chain is too long`. | Bọc biểu thức trong `Boolean(...)` tại hàm `until`. E2E headless Chrome chạy 14/14 checks và xuất đủ 6 ảnh chụp màn hình. |

## Bằng chứng kiểm tra thực tế

1. **Backend Unit & Logic**: `dotnet run --project backend/tests/Ktht.Catalog.Checks`: 16/16 checks PASS.
2. **Frontend Unit & Component**: `npm.cmd run test -- --run`: 11/11 tests PASS.
3. **Frontend Build & Types**: `npm.cmd run typecheck` và `npm.cmd run build`: 0 error; `npm.cmd run lint`: 0 error.
4. **Backend Build**: `dotnet build backend/Ktht.sln`: 0 Warning, 0 Error.
5. **Idempotency Seed DB**: Chạy lại `--seed-demo` trên SQL Server `KTHT_Ecom_Dev` không nhân đôi dữ liệu (giữ nguyên 18 sản phẩm, 4 danh mục, 48 biến thể).
6. **E2E Catalog API (SQL Server thật)**: `node tests/e2e/catalog-api.mjs http://127.0.0.1:5080`: 61 requests PASS.
7. **E2E Visual Headless Chrome**: `node tests/e2e/catalog-browser.mjs http://127.0.0.1:5173 9222`: 14 checks PASS, 0 horizontal overflow desktop/mobile, tạo đủ 6 ảnh chụp màn hình trong `tests/e2e/artifacts/`.

