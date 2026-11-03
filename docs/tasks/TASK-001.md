---
id: TASK-001
title: Tạo cấu trúc repository ban đầu
status: DONE
owner: CO
reviewers: [DX]
review_mode: sequential-self-review
scope_paths: [frontend, backend, tests, docs, scripts, README.md]
depends_on: []
business_rules: []
source_refs: [README.md, AGENTS.md]
assumptions: [Các thư mục trống được giữ bằng .gitkeep; chưa bootstrap ứng dụng]
---

## Mục tiêu và phạm vi

Tạo cấu trúc mục tiêu theo README để chuẩn bị M0 và bootstrap. Không triển khai ứng dụng, schema, nghiệp vụ hoặc cấu hình runtime.

## Tiêu chí chấp nhận

- Given repository ban đầu, When tạo cấu trúc, Then các thư mục mục tiêu có thể được theo dõi bằng Git.
- Given tài liệu khởi đầu, When đọc trạng thái, Then thấy rõ ứng dụng và nguồn KTHT chưa có.
- Given cấu trúc mới, When kiểm tra, Then các file người dùng hiện có được giữ lại.

## Hợp đồng và rủi ro

Không thay đổi API hoặc schema. Các project và lệnh trong README vẫn là mục tiêu, chưa chạy được; nguồn nghiệp vụ cần được cung cấp trước khi xác nhận thiết kế.

## Bàn giao và kiểm tra

Tạo thư mục theo README, các file `.gitkeep`, tài liệu khởi đầu và hồ sơ task/review; cập nhật trạng thái README. Kiểm tra danh sách file và `git diff --check`; không chạy test ứng dụng vì chưa có ứng dụng.
