# Danh muc 40 man hinh chuc nang

Trang thai tai thoi diem kiem ke: `PLANNED` 39, `IN_PROGRESS` 1 (C02 partial M1), `IMPLEMENTED` 0, `VERIFIED` 0. API thuc duy nhat la `GET /api/products`; no khong du de nghiem thu C01/C02 vi frontend hien chua co router. Landing â€œAbout usâ€ hien tai la cong viec UI ngoai sitemap, khong dap ung C01 va khong duoc tinh la mot trong 40 man hinh.

Quy uoc: API va bang ghi `PLANNED` la contract muc tieu, khong phai implementation. Tat ca trang co LoadingState, EmptyState, ErrorState; trang co du lieu bao ve them ForbiddenState; form them FormField va validation. CustomerLayout/AdminLayout va component dung chung la dependency M1.

| ID | Route | Muc tieu / role | Component chinh | API / du lieu / BR | Hanh dong theo trang thai | Status | Owner / reviewer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | `/` | Trang chu; khach vang lai/Customer | CustomerLayout, search, category/product cards | `GET /products`, category; BR-CAT-001 | Chi dieu huong/tim kiem; khong dat hang truc tiep | PLANNED | FE+BE / QA |
| C02 | `/products` | Tim, loc, sap xep san pham; khach vang lai/Customer | FilterBar, DataGrid, Pagination | `GET /api/products` hien co cho doc/pagination; query search/filter/sort PLANNED; Products; BR-CAT-001 | Doc/pagination da co; loc query va mo C03 chua trien khai | IN_PROGRESS (partial M1) | FE+BE / QA |
| C03 | `/products/:slug` | Xem SKU va them gio; khach vang lai/Customer | gallery, SKU selector, FormField | `GET /products/:slug`, SKU; BR-CAT-001 | Chon SKU/so luong, them gio; khong hien P/Q/B/R/A/U | PLANNED | FE+BE / QA+SEC |
| C04 | `/cart` | Quan ly gio; Customer | line editor, ConfirmDialog | cart; BR-ORD-001 | Sua/xoa dong, sang C05; khong reservation | PLANNED | FE+BE / QA |
| C05 | `/checkout` | Tao don; Customer | address selector, payment/shipping form | orders, addresses, idempotency; BR-ORD-001/INV-001/002/IDEM-001 | Xac nhan mot lan; BE tinh lai gia/tong va giu hang atomically | PLANNED | FE+BE+DB / DR+QA+SEC |
| C06 | `/checkout/result/:orderId` | Ket qua tao don; Customer-owner | StatusBadge, next-step panel | `GET /orders/:id`; Order/Payment; BR-PAY-001/AUTH-001 | Xem ma don/trang thai; khong suy dien da thanh toan | PLANNED | FE+BE / QA+SEC |
| C07 | `/login` | Dang nhap dung chung; khach/nhan vien | FormField, ErrorState | auth; BR-AUTH-001 | Dang nhap, redirect theo role | PLANNED | FE+BE / SEC+QA |
| C08 | `/register` | Tao tai khoan khach | FormField, validation | customer registration; BR-AUTH-001 | Dang ky; thong bao ket qua, khong login gia | PLANNED | FE+BE / SEC+QA |
| C09 | `/account` | Ho so va dia chi; Customer-owner | profile form, address Drawer | customers/addresses; BR-AUTH-001 | Sua profile; them/sua dia chi qua drawer | PLANNED | FE+BE / QA+SEC |
| C10 | `/account/orders` | Danh sach don cua toi; Customer-owner | FilterBar, DataTable, Pagination | `GET /me/orders`; Order; BR-AUTH-001 | Loc/tim/mo C11 | PLANNED | FE+BE / QA+SEC |
| C11 | `/account/orders/:id` | Xem don cua toi; Customer-owner | order lines, StatusBadge, Timeline | `GET /me/orders/:id`; Order/Payment/Shipment; BR-AUTH-001/PAY-001/ORD-002 | Huy/tao hau mai neu transition cho phep | PLANNED | FE+BE / DR+QA+SEC |
| C12 | `/account/requests` | Ticket, doi tra, bao hanh; Customer-owner | tabs, DataTable, Drawer | `GET/POST /me/requests`; BR-AUTH-001/RET-001 | Tao yeu cau tu dong/dong hang hop le | PLANNED | FE+BE / DR+QA+SEC |
| C13 | `/account/requests/:id` | Chi tiet yeu cau; Customer-owner | Timeline, conversation | `GET /me/requests/:id`; request entities; BR-AUTH-001/RET-001 | Xem/bo sung theo loai; khong gop dong quy trinh | PLANNED | FE+BE / QA+SEC |
| A01 | `/admin` | Dashboard; Manager/Admin | metric cards, alert list | reports/read models; BR-INV-001/PAY-001 | Mo danh sach can xu ly; chi so co definition/source | PLANNED | FE+BE / BA+QA |
| A02 | `/admin/products` | Quan ly san pham; Sales/Admin | DataTable, FilterBar | admin products; Product/SKU; BR-CAT-001 | Tim/loc/mo A03 | PLANNED | FE+BE / QA+SEC |
| A03 | `/admin/products/:id`, `/admin/products/new` | Tao/sua san pham; Sales/Admin | FormField, image/SKU editor | admin products; Product/SKU; BR-CAT-001/AUD-001 | Luu draft/publish theo quyen | PLANNED | FE+BE / QA+SEC |
| A04 | `/admin/categories` | Quan ly danh muc; Sales/Admin | tree, Drawer | categories; AUD-001 | Them/sua trong drawer theo quyen | PLANNED | FE+BE / QA+SEC |
| A05 | `/admin/orders` | Danh sach don; Sales/Manager | FilterBar, DataTable | orders; BR-AUD-001 | Loc kenh/status/time/assignee, mo A06 | PLANNED | FE+BE / QA |
| A06 | `/admin/orders/:id` | Xu ly don; Sales/Warehouse/Manager | lines, reservation panel, Timeline | order/reservation/shipment; BR-INV-002/003, PAY-001 | Chi action state-machine hop le, khong dropdown tuy y | PLANNED | FE+BE+DB / DR+QA+SEC |
| A07 | `/admin/customers` | Quan ly khach; Sales/Admin | DataTable, Drawer | customers; BR-AUTH-001/AUD-001 | Tim, them/sua neu quyen cho phep | PLANNED | FE+BE / QA+SEC |
| A08 | `/admin/customers/:id` | Chi tiet khach; Sales/Manager | profile, order/request tabs | customers/orders/requests; BR-AUTH-001 | Chi xem tap du lieu duoc cap quyen | PLANNED | FE+BE / QA+SEC |
| A09 | `/admin/inventory` | Ton SKU-lo-kho; Warehouse/Manager | inventory grid, metric help | inventory balances; BR-INV-001/006 | Xem P,Q,B,R,A,U; khong sua truc tiep | PLANNED | FE+BE+DB / DR+QA |
| A10 | `/admin/inventory/documents` | Danh sach chung tu kho; Warehouse | FilterBar, DataTable | inventory documents; BR-AUD-001 | Loc loai/status, mo A11 | PLANNED | FE+BE+DB / QA |
| A11 | `/admin/inventory/documents/:id`, `/admin/inventory/documents/new` | Tao/xac nhan chung tu; Warehouse/Manager | lines form, ConfirmDialog, Timeline | documents/movements; BR-INV-001/003/AUD-001 | Xac nhan theo quyen; xuat gan don khong tru ton lan hai | PLANNED | FE+BE+DB / DR+QA |
| A12 | `/admin/inventory/reservations` | Reservation/lich su ton; Warehouse/Manager | tabs, DataTable, Timeline | reservations/movements; BR-INV-001/002/003 | Chi xem/lien ket don-chung tu; khong sua R truc tiep | PLANNED | FE+BE+DB / DR+QA |
| A13 | `/admin/channels` | Kenh va quota; Manager/Admin | channel table, Drawer | channels/allocations; BR-INV-004/005/006 | Chuyen quota sau xac nhan thu hoi | PLANNED | FE+BE+INT+DB / DR+QA |
| A14 | `/admin/integrations` | Su kien va ngoai le; Manager/Admin | event DataTable, payload Drawer | inbox/outbox/sync log; BR-IDEM-001/EVT-001 | Retry idempotent, payload mask; doi soat | PLANNED | INT+BE / DR+QA+SEC |
| A15 | `/admin/shipments` | Danh sach van don; Sales/Warehouse | FilterBar, DataTable | shipments; BR-PAY-001 | Loc/mo A16 | PLANNED | FE+BE / QA |
| A16 | `/admin/shipments/:id` | Xu ly van don; Sales/Warehouse | shipment detail, Timeline | shipment events; BR-PAY-001/AUD-001 | Xu ly exception; delivered khong tu doi soat tien | PLANNED | FE+BE+INT / DR+QA |
| A17 | `/admin/returns` | Danh sach doi tra; CustomerService/Warehouse | DataTable, FilterBar | returns; BR-RET-001/002 | Loc/mo A18 | PLANNED | FE+BE / QA |
| A18 | `/admin/returns/:id` | Xu ly doi tra; CustomerService/Warehouse/Manager | eligibility, QC, money/item panels | return/RMA/QC/refund; BR-RET-001/002/ORD-002 | Xet duyet, nhan, QC, refund theo transition; khong tang U khi moi yeu cau | PLANNED | FE+BE+DB / DR+QA |
| A19 | `/admin/warranties` | Danh sach bao hanh; CustomerService | DataTable, FilterBar | warranties | Loc/mo A20 | PLANNED | FE+BE / QA |
| A20 | `/admin/warranties/:id` | Xu ly bao hanh; CustomerService/Manager | eligibility, Timeline | warranty/history; BR-AUD-001 | Danh gia/ket luan; khong mac dinh doi hang hay hoan ton | PLANNED | FE+BE / DR+QA |
| A21 | `/admin/support` | Danh sach ticket; CustomerService/Manager | FilterBar, DataTable | tickets | Loc priority/assignee, mo A22 | PLANNED | FE+BE / QA |
| A22 | `/admin/support/:id` | Xu ly ticket; CustomerService | conversation, internal-note, Timeline | tickets/comments; BR-AUD-001 | Phan cong, note noi bo tach customer view | PLANNED | FE+BE / QA+SEC |
| A23 | `/admin/payments` | Thanh toan/hoan tien; Finance/Manager | tabs, DataTable, Drawer | payments/refunds/reconciliation; BR-PAY-001/RET-002 | Retry/hoan theo idempotency va limit; hien simulation | PLANNED | FE+BE+DB / DR+QA+SEC |
| A24 | `/admin/reports` | Bao cao; Manager | tabs, FilterBar, metric definitions | report read models; BR-INV-001/PAY-001 | Chon time/filter, xem source definition | PLANNED | FE+BE / BA+QA |
| A25 | `/admin/users` | Nhan vien/quyen; Admin | DataTable, role matrix, Drawer | users/roles; BR-AUTH-001/AUD-001 | Them/sua theo quyen BE | PLANNED | FE+BE / SEC+QA |
| A26 | `/admin/settings` | Cau hinh demo/audit; Admin | tabs, config form, audit table | settings/audit; BR-AUD-001 | Sua cau hinh allowed; khong hien secret | PLANNED | FE+BE / SEC+QA |
| A27 | `/admin/simulator` | Mo phong dev/demo; Admin/Manager authorized | scenario selector, results, Timeline | simulator/inbox/outbox; BR-IDEM-001/EVT-001 | Phat duplicate/delay/error an toan, link record | PLANNED | INT+FE+BE / DR+QA+SEC |

## Ngoai danh muc 40

`/403` va `*` (404) la man hinh ky thuat dung chung. Khong co route nghiep vu, khong duoc tinh vao tong 40. Chua trien khai vi frontend chua co router.

## Gia dinh va blocker

- `docs/source/` rong nen policy gia, round, fulfillment, payment method, warranty condition va permission matrix chi la muc tieu can xac nhan; moi thay doi y nghia nghiep vu se tao ADR/finding.
- Customer resource ownership va admin action authorization deu phai o BE; route guard FE chi phuc vu UX.
- Landing â€œAbout usâ€ hien co nam ngoai sitemap; C01 can duoc trien khai thanh home ecommerce va tich hop API truoc khi duoc goi IMPLEMENTED.

