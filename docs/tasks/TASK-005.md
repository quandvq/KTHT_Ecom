---
id: TASK-005
title: Landing page giới thiệu Công ty A
status: DONE
owner: FE
reviewers: [QA]
review_mode: sequential-self-review
scope_paths: [frontend/src/App.tsx, frontend/src/App.test.tsx, frontend/src/styles/storefront-theme.css]
depends_on: [TASK-002]
business_rules: []
source_refs: [user-request]
assumptions: ["Công ty A là tên và nội dung minh họa; email và số liệu không phải dữ liệu vận hành."]
---

## Mục tiêu

Tạo trang About us responsive bằng React/CSS, gồm điều hướng nội trang, giới thiệu, giá trị cốt lõi, số liệu minh họa và liên hệ.

## Tiêu chí chấp nhận

- Given mở trang, When nội dung render, Then có nhận diện Công ty A, tiêu đề About us và các section giới thiệu/giá trị/liên hệ.
- Given người dùng chọn điều hướng, When chọn link, Then link trỏ đúng section nội trang.
- Given màn hình hẹp, When hiển thị, Then bố cục chuyển một cột mà không cần phụ thuộc mới.

## Bàn giao

Không gọi API hoặc dùng dữ liệu vận hành. Đã tự rà soát JSX, landmark truy cập được và link nội trang. Đã cài Node.js LTS, chạy `npm install`, `npm run typecheck`, `npm run test -- --run` (2/2 đạt) và `npm run build` (đạt). Vite đang phục vụ trang tại `http://127.0.0.1:5173`.
