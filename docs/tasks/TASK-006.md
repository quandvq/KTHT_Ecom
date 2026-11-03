---
id: TASK-006
title: Sitemap va ke hoach 40 man hinh chuc nang
status: DONE
owner: CO
reviewers: [BA, SA, DR, QA, FE, BE]
review_mode: independent-agent
scope_paths: [docs/ui, docs/tasks/TASK-006.md, docs/reviews/TASK-006.md]
depends_on: [TASK-004, TASK-005]
business_rules: [BR-CAT-001, BR-INV-001, BR-INV-002, BR-INV-003, BR-INV-006, BR-ORD-001, BR-ORD-002, BR-AUTH-001, BR-PAY-001, BR-RET-001, BR-RET-002]
source_refs: [README.md, AGENTS.md, docs/source/.gitkeep, docs/business-rules.md, docs/architecture/inventory-model.md, docs/architecture/decision-register-task-004.md]
assumptions:
  - docs/source chua co tai lieu nghiep vu de doi chieu trong repository; cac contract chua co la PLANNED.
  - GET /api/products la API duy nhat da ton tai; khong mot man hinh nghiep vu nao duoc VERIFIED chi dua tren mock.
  - C01 hien chi la shell gioi thieu trong App.tsx, chua dap ung du lieu danh muc/san pham cua trang chu ecommerce.
---

## Muc tieu

Kiem ke va chot danh muc dung 40 man hinh nghiep vu, sitemap, luong nguoi dung, phan cong owner/reviewer va thu tu trien khai theo M1-M6. Khong trien khai dong loat giao dien hoac API ngoai vertical slice hien tai.

## Ngoai pham vi

Khong tao trang thu 41, khong them mock de bao da hoan thanh, khong doi schema/API hay ghi de frontend hien co trong task nay.

## Tieu chi chap nhan

- Co dung 13 man hinh customer va 27 man hinh admin; 403/404 tach rieng ngoai tong 40.
- Moi man hinh co role, component, API/module, data/rule, action state, handling loading/empty/error/forbidden/validation, owner va reviewer.
- Sitemap va user flows phan biet ro dependency M1-M6 va khong cho phep hanh dong vi pham ton kho/tien/quyen.
- BA, SA va DR phan bien doc lap; finding duoc luu va giai quyet truoc khi task DONE.

## Ban giao

`docs/ui/page-inventory.md`, `docs/ui/sitemap.md`, `docs/ui/user-flows.md`, cap nhat backlog theo moc va review record.

## Ket qua

- Hoan thanh B1-B2: inventory 40, sitemap, user flows va backlog dependency.
- BA va SA lap tai lieu doc lap; DR/QA phan bien F-006-01 den F-006-04.
- Cac finding la blocker code duoc DEFERRED vao backlog M1-A, M1-C, M2-A, M4-A, M5-A va M6-A; khong co man hinh nao tuyen bo VERIFIED.

