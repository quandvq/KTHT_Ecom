# Review TASK-004

review_mode: independent-agent
reviewer: DR/QA (agent độc lập)
status: VERIFIED

| ID | Severity | Finding | Retest |
| --- | --- | --- | --- |
| F-004-01 | P1 | Vòng đời hàng trả thiếu chuyển động nhận cách ly và QC, có thể làm sai U. | VERIFIED: nhận trả `P+n,Q+n`; QC đạt `Q−n`; không đạt/tiêu hủy `P−n,Q−n`. |
| F-004-02 | P2 | A quota chưa được khóa tại grain SKU–lô–kho. | VERIFIED: A chỉ hạch toán qua allocation SKU–lô–kho, tạo/đổi allocation nguyên tử và có giới hạn quota tổng. |
| F-004-03 | P2 | Hủy/expire sau khi quota hết hiệu lực thiếu nhánh đối soát. | VERIFIED: `R→A` chờ đối soát; chỉ `A→U` sau xác nhận. |

Reviewer đã kiểm tra lại đăng ký quy trình, chính sách giữ 24 giờ và gia hạn một lần, partial theo dòng hàng và ADR-003. Không còn finding mở.
