# ADR-003: Phạm vi kiến trúc demo local

Trạng thái: Accepted, TASK-004.

## Bối cảnh

Tài liệu KTHT mô tả kiến trúc đích có OMS/WMS/TMS/CRM, Redis, MongoDB, Elasticsearch, CDC và lakehouse. Repository có mục tiêu demo cục bộ React, ASP.NET Core modular monolith và SQL Server; AGENTS không cho tự mở rộng sang microservices, AI agents sản phẩm hoặc dịch vụ trả phí.

## Quyết định

Demo dùng một React frontend, một ASP.NET Core modular monolith và một SQL Server. API, Application, Domain và Infrastructure là module trong cùng solution. SQL Server là nguồn dữ liệu vận hành duy nhất; audit, inbox/outbox, lịch sử đồng bộ, ticket metadata và dữ liệu dashboard cần cho demo được lưu quan hệ trong cùng database.

Adapter thanh toán, vận chuyển và kênh bán là mô phỏng chỉ bật ở dev/demo, gọi qua interface và có inbox/outbox bền vững trên SQL Server. Báo cáo demo dùng query/view hoặc bảng tổng hợp SQL định kỳ. Cache trong bộ nhớ chỉ phục vụ hiệu năng, không là nguồn đúng đắn cho tồn, quota hoặc tiền.

Không triển khai Redis, MongoDB, Elasticsearch, Kafka, CDC, lakehouse, cổng thanh toán thật, hãng vận chuyển thật, chatbot/AI, public hosting hoặc kết nối đối tác trong demo. Các thành phần này vẫn là kiến trúc đích được ghi nhận trong nguồn KTHT.

## Hệ quả

Mô phỏng phải tái hiện lỗi trùng, timeout, event trễ/sai thứ tự và lỗi giữa commit–gửi mà không cần dịch vụ ngoài. Khi cần triển khai thật, tạo ADR thay thế mô tả migration dữ liệu, tính bền vững, quan sát và bảo mật.
