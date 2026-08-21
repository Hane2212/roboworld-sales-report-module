# 10 TEST CASE NGHIỆM THU

Tự động: `npm test` (22 test trong `core/__tests__/module.test.ts` — cột "Test tự động").
Thủ công: sau khi tích hợp vào CRM, chạy lại trên giao diện thật theo cột "Cách kiểm tra trên CRM".

| # | Kịch bản | Kết quả mong đợi | Test tự động | Cách kiểm tra trên CRM |
|---|---|---|---|---|
| 1 | Sales chuyển Khảo sát → Demo | Thành công (không cần báo cáo) | ✅ TEST 1 | Mở deal ở Khảo sát → chuyển Demo → stage đổi, lịch sử có dòng mới |
| 2 | Sales chuyển Khảo sát → Đàm phán (chưa xin Skip) | **Bị chặn**, thông báo hướng dẫn xin Skip Demo | ✅ TEST 2 | Chuyển thẳng Đàm phán → thấy lỗi "Không được bỏ qua Demo…" |
| 3 | Sales chọn Skip Demo | Phải chọn lý do; "Lý do khác" bắt buộc giải trình; trạng thái Chờ duyệt | ✅ TEST 3 | Bấm Xin bỏ qua Demo không chọn lý do → lỗi; chọn xong → "Chờ duyệt" |
| 4 | Report chưa được Leader duyệt, `requireLeaderApproval = true` | Không cho chuyển Đàm phán | ✅ TEST 4 | Đã nộp BC Skip Demo, Leader chưa duyệt → chuyển vẫn bị chặn |
| 5 | Leader duyệt Skip + có BC Skip Demo | Cho phép chuyển Đàm phán, lịch sử ghi "Skip Demo (Leader đã duyệt)" | ✅ TEST 5 | Leader bấm Duyệt → sales chuyển Đàm phán thành công |
| 6 | Deal không hoạt động quá ngưỡng (3, 5 ngày) | Mức nhắc 1 rồi 2; health chuyển 🟡 | ✅ TEST 6 | Đổi ngưỡng trong Cài đặt thành 0/1/2 ngày để test nhanh |
| 7 | Sales tiếp tục không xử lý (7 ngày) | Escalation Leader 🔴, tin nhắn nhắc đúng mẫu | ✅ TEST 7 | Cron chạy → Leader nhận thông báo, Dashboard hiện deal 🔴 |
| 8 | Leader từ chối báo cáo | Bắt buộc lý do; sales thấy "Từ chối" + lý do; báo cáo bị từ chối không tính là đã nộp | ✅ TEST 8 | Từ chối không ghi lý do → lỗi; ghi lý do → sales nhận thông báo |
| 9 | Dashboard compliance | Required / Uploaded / % đúng; sales không có BC bắt buộc → "—" | ✅ TEST 9 | Tạo 2 deal Demo (1 có BC, 1 thiếu) → sales đó hiển thị 1/2 — 50% |
| 10 | Nộp lại báo cáo nhiều lần | v1, v2, v3 — không mất bản cũ; bản Đã duyệt không xóa được | ✅ TEST 10 | Nộp BC Demo 3 lần → danh sách có 3 dòng v1–v3 |

## Test bổ sung (đã có trong bộ tự động)
- Không nhảy cóc Liên hệ mới → Demo · Lùi stage được phép · Luật mới: Demo → Đàm phán cần BC Demo
- Leader từ chối Skip → phải qua Demo · Sales thường / Leader khác khu vực không duyệt được Skip
- Tắt `requireLeaderApprovalForSkip` → tự duyệt · Cập nhật hoạt động reset nhắc · Deal Win/Fail không nhắc
- Ngưỡng cấu hình được · Không tự duyệt báo cáo của mình (Admin thì được) · Ma trận tháng · Attention items
- Sales không sửa deal người khác · Leader khu vực khác không sửa · mọi hành động có audit
