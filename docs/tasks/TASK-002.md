---
id: TASK-002
title: M0 tạm thời và bootstrap M1 đọc sản phẩm
status: IN_PROGRESS
owner: CO
reviewers: [BA, SA, DB, FE, BE, QA, SEC, DX]
review_mode: independent-agent
scope_paths: [frontend, backend, docs, global.json, .gitignore, README.md]
depends_on: [TASK-001]
business_rules: []
source_refs: [README.md, AGENTS.md]
assumptions: [Nguồn KTHT chưa có; dữ liệu demo là giả; danh mục sản phẩm công khai]
---

## Mục tiêu và ngoài phạm vi

Kiểm kê và lập backlog M0–M6, ghi hợp đồng M0 tạm thời và bootstrap slice đọc sản phẩm FE–API–SQL Server. Không triển khai M2–M6 hoặc tuyên bố quy tắc khớp KTHT khi chưa có nguồn.

## Tiêu chí chấp nhận

- Given chưa có nguồn KTHT, When lập M0, Then giả định và quyết định chưa xác nhận được nêu rõ.
- Given SQL Server và môi trường chạy được, When mở danh mục, Then FE đọc sản phẩm từ API và SQL Server; rỗng và lỗi được hiển thị rõ.
- Given một request phân trang không hợp lệ, When gọi API, Then trả lỗi validation rõ ràng.
- Given yêu cầu M1 đầy đủ, When xác thực hoặc môi trường chưa sẵn sàng, Then phần đó được ghi NOT RUN/BLOCKED thay vì Done.

## Hợp đồng, rủi ro và bàn giao

API đọc sản phẩm `GET /api/products` có phân trang; schema được quyết định theo slice tạm thời và phải đối chiếu ERD. Rủi ro chính: thiếu nguồn, thiếu runtime hoặc không có database test riêng. Bàn giao backlog, M0, mã bootstrap, lệnh và kết quả kiểm tra thực tế, finding và blocker.

## Kết quả bàn giao

- CO lập backlog, ADR stack/auth tạm thời, kế hoạch test, task và review; BA lập M0; FE và BE dựng slice và review chéo. M0 chỉ là dự thảo vì thiếu nguồn KTHT/ERD/BPMN.
- `dotnet restore backend/Ktht.sln` và `dotnet build backend/Ktht.sln --no-restore` thành công; build 0 warning/0 error. Đã tạo migration và seed bằng EF; chưa áp dụng hoặc kiểm chứng trên database.
- `sqlcmd -S localhost -E -Q "SELECT @@SERVERNAME AS ServerName" -l 5 -C` thành công ngoài sandbox; cùng lệnh trong sandbox gặp lỗi TLS. Không tạo, xóa hoặc reset database.
- Node/npm không có trong PATH; chưa cài FE, tạo lockfile, chạy lint/typecheck/test/build, API với SQL Server hay E2E. Auth/phân quyền chưa triển khai; M1 chưa hoàn tất. F-001 còn chờ chạy test, xem `docs/reviews/TASK-002.md`.
- Bước tiếp: bổ sung nguồn KTHT, cài Node/npm, xác định DB test/dev riêng và connection string, chạy migration và kiểm thử thực tế; chốt ADR auth và triển khai xác thực/phân quyền.
