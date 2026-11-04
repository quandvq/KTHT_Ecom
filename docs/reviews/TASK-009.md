# Review TASK-009 — bỏ đa kênh, đồng bộ UI và mã khuyến mãi

review_mode: independent-agent
reviewer: QA/DR
status: VERIFIED

## Phạm vi kiểm tra độc lập

- API/UI không còn chức năng kênh bán, quota sàn hoặc endpoint nhận đơn ngoài; database không còn đơn `EXT-*`, channel allocation và quota A do sàn.
- Đăng nhập cập nhật header/tài khoản trong cùng phiên render, không cần reload.
- Thêm/xóa giỏ cập nhật header ngay; sort/category vẫn giữ đúng sau Apply, dữ liệu danh mục tải trễ và browser back.
- Promotion được tính lại từ SKU/giá DB; request client không quyết định subtotal/discount/total.
- Chỉ một promotion trên một đơn; lưu snapshot code, subtotal, discount, total và tổng sau giảm không âm.
- Mã fixed/percent tuân thủ minimum, maximum discount, thời gian, active và usage limit; 50 mã demo có code unique.
- Retry cùng idempotency key không tăng usage hoặc reservation lần hai; cùng key khác payload phải bị từ chối.

## Kết quả kiểm chứng (Test Results)

1. **Unit & Domain Checks (Ktht.Catalog.Checks):** 23/23 PASS (Invariant $U = P - Q - B - R - A \ge 0$, Reservation, QC flow, Security hashing/JWT).
2. **Component & Flow Tests (Vitest frontend):** 14/14 PASS (Đăng nhập cập nhật ngay không reload, sort giữ nguyên theo URL, giỏ hàng, validation, promotion checkout).
3. **Frontend Production Build:** PASS (0 lỗi TypeScript / bundling).
4. **Promotion Integration Test (promotion-api.mjs):** 10/10 PASS (Endpoint channel cũ 404, validate 50 mã demo, trần giảm giá, đơn hàng áp đúng 1 mã, idempotency key).
5. **Catalog & Full Flow E2E (catalog-api.mjs & full-flow-test.mjs):**
   - `catalog-api.mjs`: 235 requests PASS.
   - `full-flow-test.mjs`: 34/34 checks PASS 100% xuyên suốt 10 modules.
