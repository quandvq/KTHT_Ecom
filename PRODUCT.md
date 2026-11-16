# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hai nhóm người dùng có tầm quan trọng ngang nhau:

- **Khách mua hàng (vai trò `Customer`):** người tiêu dùng Việt Nam mua thuốc không kê đơn, vitamin và sản phẩm chăm sóc sức khỏe trên web, cả desktop và mobile. Họ tìm và lọc sản phẩm, chọn phiên bản/SKU, quản lý giỏ hàng, đặt hàng kèm voucher hoặc giá flash sale, theo dõi đơn, hủy đơn, gửi yêu cầu đổi trả (RMA) và ticket hỗ trợ.
- **Nhân viên vận hành (vai trò `Sales`, `Warehouse`, `CustomerSupport`, `Admin`):** dùng console `/admin` để xác nhận, xuất kho và giao đơn; theo dõi tồn kho P/Q/B/R/A/U; tiếp nhận và kiểm định hàng hoàn; trả lời ticket; quản lý sản phẩm, khuyến mãi và flash sale. Mỗi vai trò chỉ thấy và làm những gì backend cấp quyền.
- **Người đánh giá đồ án (giảng viên/hội đồng môn KTHT):** đi qua cả hai hành trình trên để kiểm chứng rằng nghiệp vụ đơn, kho, tiền và hậu mãi nhất quán và truy vết được. Storefront phải thuyết phục như một nhà thuốc thật; console phải làm lộ rõ trạng thái nghiệp vụ để có thể kiểm chứng.

## Product Purpose

V-Pharma là bản demo cục bộ của một nhà thuốc trực tuyến, xây trên React + ASP.NET Core + SQL Server cho môn KTHT. Hệ thống nhận đơn trực tiếp từ website, BE tính lại giá và giữ hàng nguyên tử theo invariant tồn kho `U = P − Q − B − R − A ≥ 0`.

Demo thành công khi người đánh giá có thể đi từ lúc khách đặt hàng, qua xử lý đơn và kho, tới đổi trả và hỗ trợ, và mọi thay đổi về tồn, tiền và trạng thái đều đúng, không trùng lặp, có audit, và quan sát được trên giao diện.

## Positioning

Đây không phải một storefront mẫu. Điểm khác biệt là tính đúng đắn của nghiệp vụ hiển thị được trên giao diện: tồn khả dụng là con số tính từ P/Q/B/R/A chứ không phải một số tự do; đặt hàng idempotent và chịu được tranh chấp đồng thời; hàng hoàn vào cách ly Q trước, chỉ hàng kiểm định đạt mới quay lại tồn bán được; Order, Payment, Shipment và Return là các vòng đời tách riêng. Lý do giao diện tồn tại là để người xem thấy những bảo đảm này đang hoạt động.

## Operating Context

- Chạy cục bộ trên Windows: SQL Server LocalDB, API ở `http://localhost:5080`, Vite ở `http://localhost:5173`. Không có hosting công khai.
- Dữ liệu sản phẩm demo lấy từ `pharmacity_products_2026-11-03.csv` (khoảng 130 dòng, có `source_url`, `price_status` và ghi chú "Chưa đối chiếu đầy đủ thông tin công bố"). Tài khoản, voucher (`SALE10-xx`, `GIAM20K-xx`, `GIAM50K-xx`, `VIP15-xx`) và đơn hàng đều là seed giả lập.
- Nghiệm thu bám theo task card và review trong `docs/tasks/` và `docs/reviews/`, danh mục 40 màn hình trong `docs/ui/page-inventory.md` và sitemap/user flow trong `docs/ui/`.
- Nguồn KTHT chính thức (`docs/source/`) chưa có. Mọi quyết định nghiệp vụ chưa có nguồn đều là giả định của bản demo.

## Capabilities and Constraints

- **Storefront (C01–C13):** trang chủ, danh sách/lọc/sắp xếp, chi tiết và chọn SKU, giỏ hàng, checkout có Idempotency-Key, trang kết quả đơn, đăng nhập/đăng ký (modal và route), tài khoản và sổ địa chỉ, lịch sử và chi tiết đơn có audit trail, hủy đơn và RMA, ticket hỗ trợ. Trạng thái thực tế của từng màn hình xem trong `docs/ui/page-inventory.md` (chỉ C01–C03 là VERIFIED).
- **Console vận hành (`/admin`, A01–A27):** KPI, sản phẩm/danh mục/thương hiệu, đơn hàng, kho P/Q/B/R/A/U và sổ cái, RMA/QC, ticket, khuyến mãi, flash sale. Phân quyền RBAC kiểm tra ở BE.
- **Chatbot nằm trong phạm vi:** "Trợ lý Dược sĩ V-Pharma" cho khách (`POST /chat/customer`) và AI Copilot cho nhân viên. Mỗi màn hình chat phải có disclaimer y khoa ("Không thay thế chẩn đoán y khoa"). *Còn mở:* ADR-003 hiện vẫn loại trừ chatbot/AI, cần một ADR thay thế để ghi nhận quyết định này.
- **Không có đa kênh sàn TMĐT:** đã gỡ khỏi phạm vi (migration `AddPromotionsAndRemoveChannels`). A13, A14, A27 vẫn có trong sitemap nhưng không có chức năng. Không thiết kế UI giả cho quota sàn Shopee/Lazada/TikTok.
- Luôn giữ: giao diện tiếng Việt (`lang="vi"`); identifier tiếng Anh; BE tính toàn bộ tiền bằng decimal; mỗi màn hình quan trọng có đủ trạng thái loading/empty/error/validation/forbidden/đang gửi. Chặn bấm lặp chỉ để hỗ trợ UX, BE vẫn phải idempotent.
- Adapter thanh toán/vận chuyển và mọi công cụ mô phỏng chỉ chạy ở dev/demo và phải ghi rõ là mô phỏng trên màn hình.
- Không hỗ trợ giao, hủy hoặc hoàn một phần. UI phải từ chối rõ ràng, không được ngầm hiểu là xử lý toàn bộ.

## Brand Commitments

- Tên **V-Pharma** và giọng điệu xưng "em" của trợ lý dược sĩ đã có trong code hiện tại.
- **Toàn bộ chi tiết thương hiệu là hư cấu cho demo**, gồm hotline 1800 6828, giao hàng 2h, đổi trả 30 ngày, giấy phép GPP/kinh doanh dược và địa chỉ trụ sở. UI không được khiến người xem tin rằng đây là nhà thuốc thật hoặc có giấy phép thật. Không thêm số giấy phép, chứng nhận, đối tác hay huy hiệu tin cậy mới.

## Evidence on Hand

- Danh mục sản phẩm và ảnh tham chiếu từ dữ liệu Pharmacity trong CSV. Mô tả chưa được đối chiếu đầy đủ và chỉ dùng cho demo.
- Ảnh chụp E2E trong `tests/e2e/artifacts/` (home, products, detail, admin; desktop/mobile).
- Báo cáo kiểm thử `docs/TEST_REPORT.md`. Đây là kết quả của code tại thời điểm chạy, không áp dụng cho code mới.
- **Không có:** khách hàng thật, đánh giá/testimonial, số liệu doanh thu thật, báo chí, chứng nhận. Không được bịa ra những thứ này.

## Product Principles

1. **Đúng nghiệp vụ trước, đẹp sau.** Không có giao diện nào được che hoặc làm tròn trạng thái tồn, tiền hay quyền. Con số trên màn hình phải là con số trong DB.
2. **Làm lộ invariant ra.** Ở console, P/Q/B/R/A/U, chuyển trạng thái và audit phải đọc được ngay, để người đánh giá kiểm chứng mà không cần mở DB.
3. **Thuyết phục nhưng trung thực.** Storefront đạt độ tin cậy của một nhà thuốc thật nhưng luôn rõ là demo: thương hiệu hư cấu, dữ liệu mô phỏng, không có tuyên bố y khoa.
4. **Quyền thuộc về backend.** UI ẩn/hiện theo vai trò chỉ để dễ dùng. Không có hành động nào an toàn chỉ vì nút bị ẩn.
5. **Từ chối rõ ràng thay vì xử lý ngầm.** Thiếu hàng, xung đột đồng thời, thao tác một phần hoặc sai trạng thái đều phải có thông báo cụ thể, không im lặng thất bại.

## Accessibility & Inclusion

Không có chuẩn bắt buộc nào được chốt riêng cho sản phẩm. Giao diện phục vụ người dùng phổ thông tiếng Việt trên cả mobile và desktop. Nội dung về thuốc phải dễ đọc và đi kèm cảnh báo y tế phù hợp.
