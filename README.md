# KTHT E-commerce — Demo hệ thống quản lý hoạt động đa kênh

## 1. Mục tiêu và trạng thái

Dự án môn Kiến trúc hệ thống UEH: hiện thực hóa quy trình E-commerce bằng website có Front-end, Back-end và SQL Server cục bộ. Mục tiêu là chứng minh luồng nghiệp vụ, tính nhất quán dữ liệu và sự phối hợp giữa bán hàng, kho, giao vận, CSKH.

**Trạng thái ban đầu:** bộ tài liệu khởi tạo, chưa có mã nguồn ứng dụng. Các thư mục, endpoint, script và lệnh bên dưới là quy ước triển khai; chỉ chạy sau khi Codex đã tạo thành phần tương ứng. Không xem danh sách chức năng là bằng chứng chức năng đã hoàn thành.

Tài liệu KTHT/ERD/BPMN đầy đủ chưa được đính kèm vào repository tại thời điểm soạn. Nhóm đặt bản đã chốt vào `docs/source/`; mọi khác biệt với đề xuất này phải được ghi nhận trước khi sửa thiết kế. Không suy đoán rằng tên bảng dự kiến đã trùng ERD cuối cùng.

## 2. Công nghệ và kiến trúc mục tiêu

| Thành phần | Lựa chọn |
| --- | --- |
| Front-end | React + TypeScript + Vite + Bootstrap |
| Back-end | ASP.NET Core Web API, C#; modular monolith |
| Dữ liệu | SQL Server Express/Developer cục bộ; Entity Framework Core |
| Công cụ | VS Code + Codex, SSMS, Git, OpenAPI |
| Kiểm thử | xUnit cho BE; Vitest/Testing Library cho FE; Playwright cho luồng E2E |

Pin phiên bản SDK và dependency phù hợp môi trường bằng `global.json`, lockfile và tool manifest trong bước bootstrap. Không nâng cấp tùy ý giữa các task.

Luồng: trình duyệt → HTTP API → dịch vụ nghiệp vụ → SQL Server. FE không kết nối DB trực tiếp. Một BE chia module; chưa cần microservices, message broker hoặc AI agents trong MVP. Các vai trò Codex trong AGENTS.md là đội phát triển, khác với AI agents chạy trong sản phẩm.

- Website khách hàng: xem sản phẩm, đặt hàng, theo dõi đơn, gửi hỗ trợ.
- Back-office: sản phẩm, đơn hàng, kho, kênh bán, giao vận, hậu mãi, báo cáo.
- Adapter mô phỏng: sàn, thanh toán, giao vận; gắn nhãn mô phỏng rõ ràng.
- DB chỉ cho BE và công cụ quản trị được phép truy cập; không công khai cổng SQL để chạy demo.

## 3. Phạm vi theo mốc

| Mốc | Nội dung | Tiêu chí nghiệm thu |
| --- | --- | --- |
| M0 | Đọc nguồn, chốt use case, ERD, phân quyền, trạng thái, API | Có giả định, quyết định và tiêu chí kiểm thử truy vết được |
| M1 | Bootstrap FE/BE/DB, đăng nhập, migration, seed | Chạy cục bộ, FE đọc dữ liệu thật qua API, quyền được kiểm tra tại BE |
| M2 | Sản phẩm/SKU, giỏ hàng, đơn, giữ hàng | Đặt đơn và giữ hàng nguyên tử; không bán vượt tồn khi đồng thời |
| M3 | Xác nhận, xuất kho, giao hàng mô phỏng, hủy | Luồng hoàn tất/hủy có lịch sử; không xuất hay hoàn tồn trùng |
| M4 | Hạn mức kênh, nhận đơn sàn, retry và đối soát | Không tạo đơn trùng; đơn trễ không làm tăng cam kết tồn |
| M5 | CSKH, đổi trả, bảo hành | Phê duyệt và kiểm tra hàng trước nhập lại; giới hạn số lượng/tiền |
| M6 | Dashboard, E2E, đóng gói | Cài mới được, demo lặp lại được, báo cáo khớp dữ liệu nguồn |

Ưu tiên hoàn tất M1–M3 trước khi mở rộng. Thanh toán/giao vận thật, AI agents, nhiều doanh nghiệp, tối ưu phân bổ kho và triển khai public là phạm vi sau MVP.

## 4. Vai trò người dùng

| Vai trò ứng dụng | Quyền chính |
| --- | --- |
| Customer | Xem/sửa dữ liệu được phép của bản thân, đặt và theo dõi đơn của mình |
| Sales | Tiếp nhận và xử lý đơn theo trạng thái cho phép |
| Warehouse | Nhập, giữ/soạn/xuất hàng theo nghiệp vụ và kiểm hàng trả |
| CustomerService | Xử lý ticket, tiếp nhận hậu mãi |
| Manager | Báo cáo, phê duyệt ngoại lệ theo ma trận quyền |
| Admin | Tài khoản, vai trò và cấu hình |

Phải có ma trận quyền ở cấp hành động và đối tượng. Ẩn nút trên FE không thay thế kiểm tra quyền ở BE.

## 5. Quy tắc nghiệp vụ cốt lõi

Các quy tắc dưới đây là baseline thiết kế cần đối chiếu nguồn KTHT.

- Mọi tồn kho được định danh theo SKU và kho; không dùng tổng tồn sản phẩm thay cho biến thể.
- Đặt hàng phải kiểm tra giá, trạng thái SKU, số lượng và khả dụng ở BE; không tin tổng tiền FE gửi.
- Tạo đơn và giữ hàng cùng transaction; lỗi một dòng làm rollback toàn bộ đơn trong MVP.
- Giữ hàng không giảm tồn vật lý. Xuất hàng giảm tồn vật lý và tất toán giữ hàng đúng một lần. Hủy trước xuất giải phóng giữ hàng; hủy sau xuất phải qua quy trình giao thất bại/hoàn hàng.
- Tồn không bán được và tồn an toàn không được đưa vào lượng có thể cam kết.
- Phân bổ cho kênh khác giữ hàng theo đơn; hạn mức sàn vẫn được bảo vệ khi đơn chưa về.
- Nhận đơn sàn chuyển cam kết từ hạn mức sang reservation, không cộng hai lần. Đơn vượt hạn mức vào ngoại lệ, không âm tồn hoặc tự tăng hạn mức.
- Trước khi đẩy số lượng tuyệt đối/tăng hạn mức phải đối soát các đơn và sự kiện liên quan. Chưa xác định được trạng thái mới nhất thì không tăng.
- Chuyển hạn mức phải xác nhận giảm ở kênh cũ trước khi tăng kênh mới; timeout giữ phần đang chuyển ở trạng thái được bảo vệ.
- Order, Payment, Shipment và Return có vòng đời riêng; sự kiện giao hàng không tự chứng minh đã thu tiền.
- Không nhập lại tồn bán được chỉ vì khách tạo yêu cầu trả hàng; phải nhận và kiểm tra hàng.
- Mọi nghiệp vụ có thể nhận lại phải có idempotency key/unique constraint và cơ chế xử lý đồng thời.
- Tiền dùng decimal tại BE/DB; thời gian lưu UTC, hiển thị múi giờ Việt Nam; mọi chuyển trạng thái có người thực hiện, thời gian và lý do khi cần.

## 6. Cấu trúc repository mục tiêu

| Đường dẫn | Nội dung |
| --- | --- |
| `README.md`, `AGENTS.md` | Hướng dẫn dự án và quy tắc làm việc của Codex |
| `frontend/` | React, các feature, API client, component dùng chung |
| `backend/Ktht.sln` | Solution BE |
| `backend/src/Ktht.Api/` | HTTP endpoints, auth, composition root |
| `backend/src/Ktht.Application/` | Use case, DTO, orchestration |
| `backend/src/Ktht.Domain/` | Entity, state machine, quy tắc nghiệp vụ |
| `backend/src/Ktht.Infrastructure/` | EF Core, migration, adapter, outbox/inbox nếu cần |
| `backend/tests/` | Unit test và integration test |
| `tests/e2e/` | Các hành trình người dùng xuyên FE–BE–DB |
| `docs/source/` | Báo cáo, ERD, BPMN do nhóm cung cấp |
| `docs/architecture/`, `docs/adr/` | Thiết kế và quyết định kiến trúc |
| `docs/business-rules.md` | Quy tắc BR-xxx, nguồn và trạng thái xác nhận |
| `docs/api/`, `docs/data/` | API contract, từ điển dữ liệu và schema |
| `docs/tasks/`, `docs/reviews/` | Task, bàn giao, finding và bằng chứng xác minh |
| `docs/traceability.md` | Quy trình → màn hình → API → bảng → test |
| `docs/demo.md` | Tài khoản mẫu, kịch bản và kết quả mong đợi |
| `scripts/` | Setup/check/seed; reset chỉ chạy khi người dùng yêu cầu |

## 7. Khởi tạo bằng Codex trong VS Code

1. Tạo thư mục repository, đặt README.md và AGENTS.md ở thư mục gốc, mở cả thư mục bằng VS Code.
2. Đưa tài liệu KTHT đã chốt vào `docs/source/` nếu có.
3. Yêu cầu Codex đọc hai file và thực hiện M0; nếu thiếu nguồn, ghi giả định tạm và chỉ tiếp tục phần không bị ảnh hưởng.
4. Sau M0, giao M1 rồi từng vertical slice; mỗi task có người thực hiện và vai trò rà soát.
5. Duy trì task/review trong repo để tiếp tục được giữa các phiên làm việc.

Prompt khởi động gợi ý:

> Đọc README.md, AGENTS.md và docs/source nếu tồn tại. Đóng vai Coordinator, kiểm kê repository, tạo backlog M0–M6 với dependency, owner và reviewer. Thực hiện M0 rồi bootstrap M1 trong phạm vi các giả định đã rõ. Không xây toàn bộ hệ thống trong một lượt. Nếu hỗ trợ sub-agent, phân công các phần độc lập và kiểm tra chéo; nếu không, làm tuần tự theo vai trò và ghi rõ đây là self-review. Báo cáo file thay đổi, lệnh đã chạy, kết quả và blocker.

## 8. Chạy cục bộ sau khi bootstrap

Cần có Node.js, .NET SDK đúng phiên bản đã pin, SQL Server đang chạy, SSMS tùy chọn và Git. Bootstrap phải tạo các project/script dưới đây trước khi hướng dẫn chạy; sửa README nếu tên thực tế khác.

Cấu hình dự kiến:

- FE: `http://localhost:5173`; BE: `http://localhost:5080` cho demo local.
- FE `.env.local`: `VITE_API_BASE_URL=http://localhost:5080/api` (không chứa bí mật).
- BE: `ConnectionStrings__DefaultConnection` qua biến môi trường hoặc .NET user-secrets.
- Ví dụ cấu hình dev: `Server=localhost\SQLEXPRESS;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True`.
- Đổi instance theo máy; không xem chuỗi trên là thông tin kết nối đã xác minh. TrustServerCertificate chỉ là lựa chọn dev cục bộ.
- CORS chỉ cho origin FE đã cấu hình; cơ chế cookie/token và chống CSRF được chốt trong ADR xác thực.

Lệnh PowerShell dự kiến từ root, sau khi M1 hoàn tất:

```powershell
dotnet restore backend/Ktht.sln
dotnet tool restore
dotnet ef database update --project backend/src/Ktht.Infrastructure --startup-project backend/src/Ktht.Api
dotnet run --project backend/src/Ktht.Api --urls http://localhost:5080
```

Terminal khác:

```powershell
cd frontend
npm ci
npm run dev -- --host localhost --port 5173
```

Nếu PowerShell chặn npm.ps1, có thể dùng `npm.cmd` tương ứng. Không thay chính sách máy chỉ để chạy npm. Lệnh seed và tài khoản demo phải được người triển khai bổ sung sau khi seed tồn tại; chỉ dùng dữ liệu giả, không commit mật khẩu thật. Seed chạy lại không nhân đôi dữ liệu. Không tự reset database đang có dữ liệu.

## 9. Kiểm thử và Definition of Done

Sau khi bootstrap tạo đủ script:

```powershell
dotnet build backend/Ktht.sln
dotnet test backend/Ktht.sln
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test -- --run
npm --prefix frontend run build
```

Codex phải tạo và ghi lệnh E2E thực tế vào đây khi triển khai bộ E2E. Test transaction/concurrency phải chạy với SQL Server test riêng; EF InMemory không chứng minh được hành vi khóa/ràng buộc SQL Server. Không chạy test phá dữ liệu trên DB demo.

Một chức năng chỉ Done khi: FE dùng API thật; quyền và logic nằm ở BE; dữ liệu/rollback đúng; test tiêu chí chấp nhận đạt; review không còn lỗi nghiêm trọng; tài liệu và truy vết cập nhật. Nếu chưa chạy được do môi trường, ghi BLOCKED/NOT RUN, không báo pass.

Demo tối thiểu: đặt đơn hợp lệ; hai đơn tranh lượng hàng cuối; hủy trước xuất; webhook trùng; đơn sàn trễ; mất kết nối khi chuyển hạn mức; nhận và kiểm tra hàng trả; truy cập đơn người khác bị từ chối.

## 10. Cách làm việc và giới hạn

AGENTS.md quy định vai trò, bàn giao, rà soát và điều kiện đóng task. File này không tự tạo các tiến trình agent; khả năng chạy song song phụ thuộc môi trường Codex. Không cần cài hệ thống multi-agent bên trong website để sử dụng cách làm việc này.
