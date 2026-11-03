---
id: TASK-007
title: C02 doc danh muc san pham bang API that
status: DONE
owner: FE
reviewers: [BE, QA]
review_mode: independent-agent
scope_paths: [frontend/src/App.tsx, frontend/src/App.test.tsx, frontend/src/styles/storefront-theme.css]
depends_on: [TASK-002, TASK-006]
business_rules: [BR-CAT-001]
source_refs: [docs/api/catalog.md, docs/ui/page-inventory.md]
assumptions: [GET /api/products la contract M1 duy nhat co the dung; search/filter/sort/detail chua co va khong hien thi gia lap]
---

## Muc tieu

Dung C02 tai `/products` doc phan trang tu `GET /api/products`, xu ly loading, empty va error. Khong tuyen bo dat C02 vi contract chua co filter/search/sort/slug.

## Tieu chi chap nhan

- Given API tra danh muc, When mo `/products`, Then danh sach SKU, ten, gia va phan trang duoc hien thi.
- Given API loi hoac rong, When render, Then co ErrorState co retry hoac EmptyState.
- Given contract hien tai, Then khong hien nut filter/search/sort khong co API.

## Ket qua

- QA/BE review doc lap da VERIFIED F-007-REVIEW-01.
- npm.cmd run test -- --run: 6/6 dat; npm.cmd run build: dat.
- QA doc lap da goi API live: `GET http://127.0.0.1:5080/api/products` va qua Vite proxy `http://127.0.0.1:5173/api/products` deu tra `200` voi san pham seed. `page=2&pageSize=20` tra danh sach rong dung; `page=0` va `pageSize=101` tra `400` validation.
- Task nay chi dong scope C02 partial M1. Trang C02 van IN_PROGRESS trong page inventory do chua co contract catalog day du va chua co bang chung acceptance FE-BE-SQL tu dong doc lap.
