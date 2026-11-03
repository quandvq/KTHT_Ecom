---
id: TASK-004
title: Chuẩn hóa quy trình, tồn kho và phạm vi demo theo nguồn KTHT
status: DONE
owner: CO
reviewers: [BA, SA, DB, DR, QA]
review_mode: independent-agent
scope_paths: [docs]
depends_on: [TASK-002]
business_rules: [BR-INV-001, BR-INV-006, TASK-004-partial-policy]
source_refs: [C:/Users/My PC/Downloads/KTHT FINAL (3).md]
assumptions: [Các BPMN nhúng trong Markdown là cùng phiên bản với link Drive]
---

## Mục tiêu

Chuẩn hóa mã 10 quy trình, mô hình tồn kho SKU–lô–kho, giữ tồn khi chờ review, xử lý một phần và phạm vi kiến trúc demo local.

## Tiêu chí chấp nhận

- Given một BPMN hoặc use case nguồn, When truy vết, Then có đúng một mã quy trình chuẩn.
- Given đơn, quota, hủy hoặc xuất, When cập nhật tồn, Then thay đổi P/Q/B/R/A/U được xác định và không đếm hai lần.
- Given đơn chờ risk review/dược sĩ, When hết hạn hoặc bị từ chối, Then reservation được giải phóng theo nguồn quota; duyệt sau hết hạn phải giữ lại từ đầu.
- Given hủy/đổi trả một phần, When xử lý, Then giới hạn ở dòng hàng và không vượt lượng đã mua.
- Given demo local, When tích hợp ngoài, Then dùng adapter mô phỏng bền vững trong modular monolith.

## Ngoài phạm vi và bàn giao

Không sửa code, schema, BPMN gốc hay file nguồn bên ngoài repository. Bàn giao là process register, inventory model, quyết định nghiệp vụ và ADR-003; review độc lập ghi finding hoặc chấp nhận cụ thể.
