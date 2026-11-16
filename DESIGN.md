---
name: V-Pharma
description: Nhà thuốc trực tuyến demo — storefront thân thiện và console vận hành minh bạch trên một hệ màu xanh dược.
colors:
  primary: "#1b51a3"
  primary-deep: "#153f80"
  focus-amber: "#f2a900"
  page-bg: "#ebebeb"
  surface: "#ffffff"
  surface-tint: "#f8fafc"
  admin-canvas: "#f5f7fb"
  nav-active: "#edf4ff"
  hero-wash: "#e6f0ff"
  ink: "#2b2b2b"
  ink-strong: "#1e293b"
  ink-muted: "#5c5c5c"
  slate-muted: "#64748b"
  hairline: "#e2e8f0"
  input-stroke: "#aab7c8"
  flash-red: "#dc2626"
  danger-deep: "#b91c1c"
  success: "#16a34a"
  status-pending-bg: "#fef3c7"
  status-pending-ink: "#b45309"
  status-confirmed-bg: "#e0f2fe"
  status-confirmed-ink: "#0369a1"
  status-shipped-bg: "#f3e8ff"
  status-shipped-ink: "#7e22ce"
  status-delivered-bg: "#dcfce7"
  status-delivered-ink: "#15803d"
  status-cancelled-bg: "#fee2e2"
  status-cancelled-ink: "#b91c1c"
  status-qc-bg: "#ccfbf1"
  status-qc-ink: "#0f766e"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(34px, 4.2vw, 56px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(26px, 3vw, 36px)"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  input: "6px"
  button: "8px"
  tile: "10px"
  card: "12px"
  header: "14px"
  modal: "16px"
  hero: "18px"
  pill: "20px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "48px"
  container: "1232px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.slate-muted}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 18px"
  button-danger:
    backgroundColor: "{colors.flash-red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "10px 18px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    padding: "8px 14px"
    height: "40px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "10px"
  input-modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "0 14px"
    height: "44px"
  product-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.card}"
    padding: "16px"
  status-badge:
    backgroundColor: "{colors.status-pending-bg}"
    textColor: "{colors.status-pending-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  admin-nav-item-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    padding: "10px 14px"
  flashsale-badge:
    backgroundColor: "{colors.flash-red}"
    textColor: "{colors.surface}"
    rounded: "6px"
    padding: "4px 8px"
---

# Design System: V-Pharma

## Overview

**Creative North Star: "The Orderly Dispensary" (Quầy thuốc ngăn nắp)**

V-Pharma trông như một quầy thuốc đạt chuẩn: sáng, sạch, mọi thứ nằm đúng kệ. Người xem tin vì thấy trật tự, không phải vì trang trí. Nền trang là một lớp xám trung tính (page-bg). Trên đó, nội dung được xếp trong các khối trắng như ngăn kệ: header, thẻ sản phẩm, bảng, modal. Màu xanh dược (primary) đánh dấu những gì bấm được và những gì cần nhìn: giá, link, mục đang chọn. Vàng hổ phách (focus-amber) chỉ xuất hiện khi focus bằng bàn phím.

Hình khối thân thiện và mềm. Góc bo rõ (8–18px, tăng dần theo kích thước khối). Shadow rất nhạt khi đứng yên và chỉ nổi lên khi tương tác (thẻ sản phẩm nâng 3px khi hover). Mật độ thay đổi theo bề mặt: storefront thoáng (khoảng cách section 48px, hero rộng), console `/admin` dày đặc hơn (sidebar 248px, bảng hàng 14px, nền admin-canvas). Cả hai dùng chung một bộ token.

Flash sale là ngoại lệ có chủ đích duy nhất về cường độ: đỏ (flash-red), dải gradient cam–đỏ và chữ in hoa. Nó chỉ dành cho chiến dịch có thời hạn, không lan sang chỗ khác.

**Key Characteristics:**
- Một màu chủ xanh dược trên nền xám trung tính và các khối trắng.
- Góc bo mềm, tăng dần theo kích thước khối (input 6 → hero 18px).
- Phẳng khi đứng yên; độ sâu chỉ xuất hiện khi tương tác hoặc ở lớp phủ.
- Màu trạng thái nằm trong một bảng ánh xạ tập trung (badge dạng viên thuốc).
- Toàn bộ giao diện tiếng Việt, chữ sans gọn, nhãn nhỏ in đậm và giãn chữ.

## Colors

Một màu xanh dược tin cậy làm trục, trên nền xám trung tính. Màu tín hiệu chỉ dùng cho trạng thái và khuyến mãi.

### Primary
- **Xanh Dược (Pharmacy Blue)** (primary): màu của hành động và điểm nhấn: nút chính, link, giá sản phẩm, mục nav đang chọn, chữ thương hiệu. Là biến được tham chiếu nhiều nhất trong CSS.
- **Xanh Dược Sẫm (Deep Pharmacy Blue)** (primary-deep): hover của nút chính, thanh thông báo trên cùng, footer trang giới thiệu.

### Secondary
- **Vàng Hổ Phách (Dispensary Amber)** (focus-amber): vòng focus-visible 3px trên mọi link, nút và ô nhập. Trên nền xanh đậm (khối liên hệ) được dùng làm chữ nhấn. Không dùng làm nền nút.

### Tertiary
- **Đỏ Giờ Vàng (Flash Red)** (flash-red): tiêu đề, badge giảm giá và thanh tiến độ của flash sale, kèm nút nguy hiểm (`btn-danger`). Bản sẫm hơn (danger-deep) dùng cho hover và chữ lỗi.

### Neutral
- **Xám Kệ (Shelf Grey)** (page-bg): nền trang storefront, tạo nền để các khối trắng nổi lên.
- **Trắng Ngăn Kệ (Shelf White)** (surface): mọi thẻ, header, bảng, modal.
- **Trắng Ngà Lạnh (Cool Tint)** (surface-tint) và **Nền Console (Console Canvas)** (admin-canvas): nền phụ cho tiêu đề bảng, khối giá trị và vùng làm việc `/admin`.
- **Xanh Sương (Mist Blue)** (nav-active, hero-wash): nền mục nav đang chọn và gradient hero.
- **Mực (Ink)** (ink, ink-strong): chữ chính; ink-strong dùng cho tiêu đề thẻ sản phẩm.
- **Mực Nhạt (Muted Ink)** (ink-muted, slate-muted): mô tả, meta, nhãn phụ và nút secondary.
- **Đường Kẻ (Hairline)** (hairline): viền thẻ và đường chia bảng; input-stroke là viền ô nhập.

### Status
Bảng trạng thái đơn và RMA tập trung theo cặp nền/chữ: pending (hổ phách), confirmed (xanh nhạt), shipped (tím), delivered (xanh lá), cancelled (đỏ), qc (xanh ngọc). Mỗi trạng thái chỉ có một cặp màu.

### Named Rules
**The One Blue Rule.** Chỉ có một màu xanh hành động: primary. Xanh trời `#0284c7`/`#0369a1` từng xuất hiện ở chatbot, footer và vòng focus; TASK-010 đã gộp về primary và token `--shop-focus-halo` (`rgb(27 81 163 / 15%)`). Màn hình mới không được dùng lại. (Riêng badge "confirmed" giữ cặp màu xanh nhạt/xanh đậm của bảng trạng thái.)

**The Amber Is For Focus Rule.** Vàng hổ phách báo hiệu vị trí bàn phím. Không dùng làm màu trang trí hay màu nút.

**The Red Is Seasonal Rule.** Đỏ và gradient cam–đỏ chỉ dành cho flash sale và hành động phá hủy. Không dùng để "làm nổi" nội dung thường.

## Typography

**Display Font:** Font hệ thống (system-ui, -apple-system, Segoe UI, Roboto…); trên Windows hiển thị Segoe UI
**Body Font:** Cùng stack hệ thống
**Numerals:** `font-variant-numeric: tabular-nums` cho giá, mã đơn, đồng hồ đếm ngược.

**Character:** Một họ sans trung tính, gọn, đọc tốt tiếng Việt có dấu. Phân cấp dựa vào độ đậm và cỡ chữ, không dựa vào việc đổi font. Chưa tự host webfont (TASK-010 chọn font hệ thống để không phụ thuộc mạng/CDN); nếu đổi sang webfont phải tự host kèm subset tiếng Việt.

### Hierarchy
- **Display** (700, clamp(34px, 4.2vw, 56px), 1.12, −0.035em): H1 của hero storefront và trang giới thiệu.
- **Headline** (700, clamp(26px, 3vw, 36px), 1.2): tiêu đề trang console và trang danh sách.
- **Title** (650, 15–17px, 1.4): tên sản phẩm (kẹp 2 dòng), tiêu đề thẻ và modal (20px).
- **Body** (400, 16px, 1.6): nội dung chính; đoạn dẫn tối đa khoảng 470–590px.
- **Body small** (400, 13–14px): bảng, nav, meta. Đây là cỡ chữ phổ biến nhất trong console.
- **Label** (600–700, 12–13px): nhãn trường, meta, badge. Cỡ chữ tối thiểu trên storefront là 12px.

### Named Rules
**The Weight Not Font Rule.** Phân cấp bằng độ đậm (400 / 600 / 650 / 700 / 800) và cỡ chữ. Không thêm họ font thứ hai cho tiêu đề.

**The Price Is Bold Blue Rule.** Giá luôn đậm (750) và màu primary, 17px trên thẻ sản phẩm.

## Layout

Container cố định 1232px, cách mép 24px mỗi bên trên storefront (16px ở trang giới thiệu). Trang chủ được dựng từ các khối: header nổi dạng thẻ (grid ba cột logo / ô tìm kiếm / tài khoản), dải nav, hero hai cột (1.3fr / 1fr), lưới danh mục `auto-fit minmax(170px, 1fr)`, lưới sản phẩm `auto-fit minmax(220px, 1fr)` gap 16px, và section flash sale. Checkout chia hai cột trên desktop (form bên trái, tóm tắt bên phải) và gộp thành một cột trên mobile.

Console dùng grid `248px | 1fr`: sidebar trắng, header 68px, vùng main có padding 32px trên nền admin-canvas.

Nhịp khoảng cách theo bậc 6 / 10 / 16 / 24 / 32 / 48px. Breakpoint: 1000px, 760px (trang giới thiệu), 680px, 480px. Ở mức hẹp nhất các lưới gộp thành một cột, nav phụ bị ẩn, còn hành động liên hệ/tài khoản vẫn hiện.

## Elevation & Depth

Hệ lai, nghiêng về phẳng. Khi đứng yên, các khối gần như phẳng: viền hairline cộng shadow rất nhạt (`0 1px 2px rgb(0 0 0 / 10%)` hoặc `0 6px 22px rgb(15 23 42 / 5%)`). Độ sâu xuất hiện khi tương tác (thẻ sản phẩm hover nâng 3px, shadow 8%) và ở lớp phủ (modal shadow 25%, backdrop đen 50%). Màu của shadow nhiễm sắc slate/xanh chứ không phải đen thuần.

### Shadow Vocabulary
- **Kệ (shelf-rest)** (`box-shadow: 0 1px 2px rgb(0 0 0 / 10%)`): thẻ sản phẩm và thẻ danh mục khi đứng yên.
- **Header nổi (float-soft)** (`box-shadow: 0 6px 22px rgb(15 23 42 / 5%)`): header storefront, thẻ truy cập admin.
- **Nâng (lift-hover)** (`box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08)`): hover thẻ sản phẩm, đi cùng `translateY(-3px)`.
- **Quầng hero (hero-glow)** (`box-shadow: 0 12px 36px rgb(27 81 163 / 8%)`): chỉ dùng cho hero.
- **Lớp phủ (overlay)** (`box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25)`): modal đăng nhập, hủy đơn, RMA.

### Named Rules
**The Flat Until Touched Rule.** Khối ở trạng thái nghỉ không bao giờ đổ bóng quá 5–10% opacity. Shadow lớn chỉ dành cho hover và lớp phủ.

## Shapes

Ngôn ngữ hình khối mềm, góc bo tăng dần theo kích thước khối: ô nhập 6px → nút 8px → ô danh mục 10px → thẻ 12px → header 14px → modal 16px → hero và section flash sale 18px. Badge trạng thái là viên thuốc (20px), avatar và chấm trạng thái là hình tròn. Viền 1px hairline là cách phân tách chính; viền 1.5px chỉ dùng cho ô nhập trong modal và khung flash sale. Ảnh sản phẩm được cắt trong thẻ (`overflow: hidden`) và theo góc của thẻ.

### Named Rules
**The Bigger Box, Softer Corner Rule.** Khối càng lớn thì bo càng lớn. Không dùng một bán kính chung cho mọi thứ.

## Components

### Buttons
Thân thiện, chắc tay, không viền.
- **Shape:** bo mềm (8px).
- **Primary:** nền primary, chữ trắng 600, padding 10px 18px; hover chuyển sang primary-deep trong 150ms.
- **Secondary / Danger / Success:** nền slate-muted / flash-red / success, cùng hình dạng; hover lấy bản sẫm hơn của màu đó.
- **Outline:** nền trắng, viền và chữ primary, cao 40px; dùng cho phân trang và liên hệ. Hover đảo thành nền primary chữ trắng.
- **Small:** padding 6px 12px, cỡ 13px, dùng trong bảng console.
- **Focus / Disabled:** vòng focus-amber 3px, offset 3px. Disabled giảm opacity xuống 50% và dùng cursor `not-allowed`.

### Chips
- **Style:** chip gợi ý trong chatbot và tab của trang tài khoản/console; nền trắng hoặc mist, chữ primary.
- **State:** tab đang chọn dùng nền nav-active và chữ primary 700.

### Cards / Containers
- **Corner Style:** 12px (thẻ), 10px (ô danh mục/trạng thái), 14–18px (header, hero, section).
- **Background:** surface trên page-bg hoặc admin-canvas.
- **Shadow Strategy:** shelf-rest khi đứng yên, lift-hover khi tương tác (xem Elevation).
- **Border:** 1px hairline.
- **Internal Padding:** 16px (thẻ sản phẩm), 20–24px (thẻ thông tin), 32px (modal, ô trạng thái).

### Inputs / Fields
- **Style:** nền trắng, viền 1px input-stroke, bo 6px, padding 10px. Trong modal: cao 44px, viền 1.5px slate nhạt, bo 8px.
- **Focus:** viền chuyển sang primary kèm quầng nhạt 3px (`--shop-focus-halo`). Ngoài modal và checkout dùng vòng focus-amber.
- **Error / Disabled:** chữ và viền lỗi dùng đỏ `#a42626`/danger-deep, nền lỗi đỏ rất nhạt.

### Navigation
- **Storefront:** header dạng thẻ nổi; dải nav trắng có viền trên và dưới; link không gạch chân, gạch chân khi hover. Thanh thông báo primary-deep chữ trắng 12px nằm phía trên.
- **Console:** sidebar trắng 248px; mục nav 14px/500, padding 10px 14px, bo 8px. Hover có nền slate rất nhạt và chữ primary; mục active có nền nav-active, chữ primary 700.
- **Mobile:** lưới gộp một cột, nav phụ ẩn, vẫn có skip-link cho bàn phím.

### Status Badge (signature)
Viên thuốc bo 20px, padding 4px 10px, chữ 12px/600. Màu lấy từ bảng ánh xạ trạng thái tập trung (pending, confirmed, shipped, delivered, cancelled, qc). Đây là cách duy nhất để thể hiện trạng thái Order/Return trên mọi màn hình.

### Flash Sale Block (signature)
Khung bo 18px, gradient từ đỏ rất nhạt sang trắng, viền 1.5px đỏ nhạt. Tiêu đề 22px/800 in hoa màu flash-red, kèm đồng hồ đếm ngược. Badge giảm giá đỏ góc phải (bo 6px). Thanh tiến độ cao 14px, gradient cam → đỏ, chữ số lượng đã bán nằm giữa thanh.

### Chatbot Panel
Nút nổi dạng viên thuốc màu primary ở góc dưới phải (thu thành nút tròn chỉ có icon ở ≤680px). Cửa sổ chat có header primary, phụ đề "Trả lời tự động từ dữ liệu demo" (không tuyên bố "trực tuyến 24/7"), dải disclaimer y khoa 13px cố định, bong bóng tin nhắn, chip gợi ý và thẻ sản phẩm thu nhỏ. Esc đóng cửa sổ.

### Availability Indicator (signature)
Chấm tròn 8px + nhãn 13px/600: "Còn hàng" (xanh lá), "Sắp hết hàng" (hổ phách), "Hết hàng" (đỏ sẫm). Mức lấy từ API (`availability`, suy ra từ U = P − Q − B − R − A); storefront không hiển thị số U. Đặt dưới tên sản phẩm trên thẻ và cạnh giá ở trang chi tiết; hết hàng thì khóa nút mua.

### Dialog
Một component dùng chung (`Dialog`): `role=dialog`, `aria-modal`, tiêu đề liên kết qua `aria-labelledby`, Esc để đóng, giữ focus bên trong, focus ô nhập đầu tiên. Bấm ra nền **không** đóng (tránh mất nội dung). Lỗi hiển thị bên trong dialog với `role=alert`, không dùng `alert()`. Nút gửi chuyển sang trạng thái "Đang…" và khóa khi đang xử lý.

### Order Status Rails (signature)
Ở chi tiết đơn (C11), ba ô ngang hàng: Đơn hàng / Thanh toán / Đổi trả, mỗi ô một Status Badge từ `src/status.ts`. Xếp thành một cột trên mobile. Cho thấy các vòng đời Order, Payment, Return tách biệt.

## Do's and Don'ts

### Do:
- **Do** dùng primary cho mọi hành động chính, link và giá. Hover luôn là primary-deep.
- **Do** đặt nội dung trong khối trắng (surface) có viền hairline trên nền page-bg hoặc admin-canvas.
- **Do** bo góc theo kích thước khối: input 6px, nút 8px, thẻ 12px, modal 16px, hero 18px.
- **Do** hiển thị trạng thái đơn và RMA bằng Status Badge lấy từ bảng ánh xạ tập trung.
- **Do** giữ vòng focus-amber 3px, offset 3px trên mọi phần tử tương tác.
- **Do** kẹp tên sản phẩm 2 dòng và giữ chiều cao thẻ đồng đều trong lưới.

### Don't:
- **Don't** dùng xanh trời `#0284c7`/`#0369a1` hay bất kỳ màu xanh hành động thứ hai nào.
- **Don't** dùng đỏ hoặc gradient cam–đỏ ngoài flash sale và hành động phá hủy.
- **Don't** thêm shadow đậm cho khối đứng yên. Shadow lớn chỉ dành cho hover và modal.
- **Don't** thêm inline style mới. Storefront chỉ còn một inline style hợp lệ (độ rộng thanh tiến độ flash sale tính từ dữ liệu); 39 inline style còn lại thuộc console admin, là drift cần dọn ở task sau.
- **Don't** dùng emoji hay ký tự Unicode làm icon. Dùng component `Icon` (SVG nét 1.75px) trong App.tsx.
- **Don't** đặt eyebrow/kicker chữ in hoa phía trên tiêu đề trang.
- **Don't** hiển thị giá hoặc tổng tiền từ giỏ hàng lưu trên trình duyệt như số cuối cùng. Giỏ hàng và checkout hiển thị giá do `POST /api/cart/validate` trả về.
- **Don't** thêm huy hiệu chứng nhận, giấy phép hay con dấu tin cậy làm trang trí. Thương hiệu V-Pharma là hư cấu (xem PRODUCT.md).
