# Lộ trình cải tiến giao diện V-Pharma

Lập ngày 2026-11-18. Căn cứ:

- 3 lần critique storefront trong `.impeccable/critique/`, điểm lần lượt 19 → 26 → 26 trên 40;
- PRODUCT.md và DESIGN.md (North Star "Quầy thuốc ngăn nắp");
- `docs/reviews/TASK-010.md`;
- `docs/REMAINING_ISSUES.md`.

Đây là kế hoạch đề xuất. Mỗi giai đoạn khi bắt đầu cần mở task card riêng trong `docs/tasks/` theo AGENTS §5.

## Hiện trạng

- **Đã làm tốt:**
  - Lớp minh bạch nghiệp vụ: giá do BE xác nhận, ba rail Đơn / Thanh toán / Đổi trả, `status.ts` một nguồn.
  - `Dialog` chuẩn a11y.
  - Mobile catalog đã gọn: sản phẩm đầu tiên ở 560px thay vì khoảng 1230px.
  - Không còn claim bịa.
- **Điểm nghẽn:**
  1. Bản sắc chỉ lộ ra sau khi đăng nhập. Trang chủ và trang danh mục, hai màn người chấm thấy đầu tiên, vẫn là khuôn shop chung.
  2. Hành trình sau mua còn ngõ cụt: ticket, hỗ trợ theo đơn, thông báo hủy.
  3. Console admin chưa từng được critique: còn inline style và lỗi `any` (F-008).
- **Snapshot critique mới nhất** vẫn ghi 3 P1. Cả 3 đã được sửa sau khi chấm nhưng chưa chấm lại.

## Giai đoạn 0 — Chốt TASK-010 (ưu tiên ngay)

| Việc | Lệnh / người làm | Xong khi |
| --- | --- | --- |
| Critique lần 4 để xác nhận 3 P1 đã sửa và lấy điểm mới | `/impeccable critique` | Snapshot mới không còn P0/P1 |
| QA độc lập chạy lại retest (`task010-api`, `full-flow`, FE) trên `KTHT_Ecom_Test` | QA (agent khác tác giả) | Ghi bằng chứng vào `docs/reviews/TASK-010.md` |
| Test R-002: quota flash sale nhỏ hơn số lượng mua | BE/QA | Finding R-002 → VERIFIED |
| Chuyển TASK-010 sang DONE | CO | Checklist AGENTS §10 đạt |

## Giai đoạn 1 — Khép hành trình sau mua (storefront, Operate)

Mục tiêu: không còn ngõ cụt ở các khoảnh khắc tiền và hậu mãi. Lệnh: `harden`, `clarify`.

1. Thông báo sau khi hủy viết theo `paymentStatus`. Hiện nó luôn nói "không bị tính phí".
2. Thêm link "Gửi hỗ trợ cho đơn này" từ C11, mở `/account/requests?order=ORD-…` với mã đơn, phân loại và tiêu đề điền sẵn.
3. Cho mở chi tiết ticket để xem phản hồi và lịch sử trạng thái. **Cần xác minh/bổ sung API** trước khi làm FE.
4. Trang kết quả đặt hàng:
   - liệt kê sản phẩm và số lượng đã giữ;
   - không hiện "Đặt hàng thành công" khi mở lại một đơn đã hủy.
5. Giỏ hàng:
   - bấm "−" ở số lượng 1 phải xác nhận hoặc cho hoàn tác;
   - nút −/+ tối thiểu 44px;
   - báo "Tối đa N" khi chạm giới hạn tồn.
6. Checkout: phản hồi `/auth/me` về muộn không được ghi đè địa chỉ khách đã gõ.
7. Kết quả rỗng có nút "Xóa bộ lọc".
8. Chatbot:
   - mở thì chuyển focus vào ô nhập, đóng thì trả focus về nút;
   - tin nhắn bot dùng `aria-live`.

**Xong khi:** mỗi mục có test FE. Critique không còn finding P2 thuộc nhóm "sau mua".

## Giai đoạn 2 — Bản sắc "Quầy thuốc ngăn nắp" ở hai màn đầu (storefront)

Mục tiêu: người chấm nhận ra sản phẩm ngay từ trang chủ và trang danh mục. Lệnh: `shape` (trang chủ), `layout`, `typeset`, `clarify`.

1. **Trang chủ:**
   - thay hero khẩu hiệu bằng lối vào có việc để làm: tìm kiếm, flash sale, "Hỏi dược sĩ", tra cứu đơn;
   - bỏ phần lặp giữa thanh danh mục và ô danh mục.
2. **Trang chi tiết:**
   - khung "Thông tin thuốc" gồm thành phần, công dụng, cách dùng, lưu ý; mục nào thiếu dữ liệu thì ghi rõ "chưa có dữ liệu demo";
   - H1 nhỏ lại để giá và nút mua dẫn dắt;
   - mobile có thanh mua dính đáy.
3. **Lưới sản phẩm:**
   - chip "Ảnh tham khảo" trên card;
   - chỉ ghi "Từ" khi có nhiều phiên bản;
   - `text-wrap: balance` cho tiêu đề card.
4. **Điều hướng:** đánh dấu đúng danh mục đang xem. Hiện "Tất cả sản phẩm" luôn được tô như đang chọn.
5. **Từ ngữ:** tiếp tục quy tắc "lời khách, thuật ngữ ở dòng phụ" cho "Mã SKU", nút "Xác nhận Đặt hàng →" và "Săn deal ngay".
6. **Chữ:** cân nhắc tự host một webfont hỗ trợ tiếng Việt thay font hệ thống. **Cần người dùng chốt**, vì DESIGN.md hiện ghi font hệ thống.

**Xong khi:** critique storefront ≥ 32/40 và heuristic 2 (Khớp thế giới thật) ≥ 3.

## Giai đoạn 3 — Console vận hành `/admin` (Operate)

Mục tiêu: console làm lộ trạng thái nghiệp vụ để kiểm chứng (PRODUCT.md). Lệnh: `critique` (admin), `extract`, `polish`.

1. Critique lần đầu cho console để lấy baseline.
2. Gom inline style vào token và component theo DESIGN.md (`extract`).
3. Sửa 5 lỗi `no-explicit-any` (F-008) để lint sạch.
4. Tách các tab thành route đúng sitemap (A01–A27), hoặc ghi rõ màn nào chưa làm. A13, A14, A27 đã bị loại khỏi phạm vi.
5. Nhãn trạng thái RMA ở admin lấy từ `status.ts` thay vì in mã gốc, nhưng vẫn giữ mã nghiệp vụ.

**Xong khi:** lint sạch, critique admin ≥ 28/40, `docs/ui/page-inventory.md` phản ánh đúng trạng thái thật.

## Giai đoạn 4 — Chất lượng kỹ thuật và bằng chứng

Lệnh: `audit`, `optimize`.

1. `audit` a11y và responsive cho cả storefront và admin: contrast, focus, cấu trúc tiêu đề.
2. Bộ ảnh chụp E2E cho các luồng đã đăng nhập (C05, C06, C10, C11, dialog hủy và trả hàng), dùng làm mốc so sánh trực quan.
3. Đồng bộ `docs/ui/page-inventory.md`: hiện nó ghi VERIFIED toàn bộ, chưa khớp với các finding còn mở.

## Ngoài lộ trình

- Cổng thanh toán và vận chuyển thật.
- Đa kênh sàn TMĐT.
- Tạo đơn đồng thời cho cùng SKU: vẫn chưa đo, cần một task BE/DB riêng.
