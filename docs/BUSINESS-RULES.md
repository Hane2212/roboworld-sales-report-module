# LUẬT NGHIỆP VỤ — bản dành cho người không kỹ thuật

Đây là "hiến pháp" của module. Code trong `core/` thực thi đúng từng dòng dưới đây và có test tự động bảo vệ.
Chủ sở hữu luật: **Chu Huy Hoàng** (Roboworld). Cập nhật: 21/08/2026.

## 1. Pipeline (7 giai đoạn, không đổi tên)
```
Liên hệ mới → Cơ hội → Khảo sát → Demo → Đàm phán → Đồng ý mua → Win / Fail
```
- Chỉ được đi **từng bước** về phía trước. Nhảy cóc 2 bước trở lên → hệ thống chặn.
- Lùi lại giai đoạn trước: được phép (để sửa nhầm), có ghi lịch sử.
- Mỗi lần chuyển giai đoạn đều lưu: deal, sales, từ đâu → đến đâu, ngày, lý do, ai thực hiện.

## 2. Báo cáo bắt buộc — CHỈ MỘT MỐC
> **Từ Demo sang Đàm phán bắt buộc phải có "BC Demo".** Các bước khác KHÔNG yêu cầu upload báo cáo.

- Báo cáo bị Leader **Từ chối** không được tính là đã nộp → vẫn bị chặn cho tới khi nộp lại.
- Sales vẫn có thể nộp các loại báo cáo khác (Khảo sát, Đàm phán, Follow-up, Khác) khi muốn — không bắt buộc, không tính vào compliance.
- Admin có thể đổi luật này trong Cài đặt (`requiredReports`) mà không cần sửa code.

## 3. Bỏ qua Demo (Skip Demo) — 3 điều kiện
Sales muốn đi thẳng **Khảo sát → Đàm phán** phải:
1. Bấm "Xin bỏ qua Demo" và chọn **1 trong 6 lý do**: Khách đã có trải nghiệm robot · Khách đã demo ở địa điểm khác · Khách không cần demo · Khách yêu cầu báo giá trực tiếp · Khách đã hiểu rõ sản phẩm · Lý do khác (**bắt buộc** ghi giải trình).
2. Nộp **"BC Skip Demo"** (báo cáo giải trình).
3. **Leader khu vực duyệt.** Chờ duyệt → chưa được chuyển. Từ chối → deal phải đi qua Demo như bình thường.

Khi cả 3 xong → chuyển sang Đàm phán, lịch sử ghi "Skip Demo (Leader đã duyệt)".

## 4. Nhắc nhở khi deal bị bỏ quên — 3 cấp (chỉnh được, mặc định 3 / 5 / 7 ngày)
Tính theo số ngày kể từ **hoạt động gần nhất** (sales bấm "vừa làm việc với khách", nộp báo cáo, chuyển stage đều reset):
| Ngày không hoạt động | Mức | Hành động |
|---|---|---|
| ≥ 3 | 🟡 Nhắc Sales | thông báo cho sales |
| ≥ 5 | 🟠 Nhắc lần 2 | thông báo lại |
| ≥ 7 | 🔴 Báo Leader | escalation cho Leader khu vực |
- Deal đã **Win/Fail** không bao giờ bị nhắc.
- Không nhắc chỉ vì "chưa upload báo cáo" ở giai đoạn không bắt buộc.

## 5. Deal Health (sức khỏe deal)
- 🔴 **Rủi ro**: không hoạt động ≥ 7 ngày, HOẶC (thiếu báo cáo bắt buộc VÀ không hoạt động ≥ 5 ngày), HOẶC ở một giai đoạn quá 14 ngày.
- 🟡 **Chú ý**: không hoạt động ≥ 3 ngày, HOẶC đang thiếu báo cáo bắt buộc.
- 🟢 **Ổn**: còn lại.

## 6. Báo cáo: duyệt, từ chối, phiên bản, xóa
- Trạng thái: Nháp → **Đã nộp** → Đã duyệt / Từ chối.
- Chỉ **Leader phụ trách khu vực** (hoặc Admin) được duyệt. **Không ai tự duyệt báo cáo của mình** (trừ Admin).
- **Từ chối bắt buộc ghi lý do** — sales nhận thông báo "Report bị từ chối. Vui lòng cập nhật lại."
- Nộp lại = **tạo phiên bản mới (v1, v2, v3…)**, không ghi đè; Leader xem được toàn bộ lịch sử.
- Báo cáo **Đã duyệt không xóa được** — sales chỉ gửi yêu cầu xóa, Leader/Admin xử lý.

## 7. Report Compliance (kỷ luật báo cáo) — phải có ngữ cảnh
```
Compliance = Báo cáo bắt buộc đã nộp / Tổng báo cáo bắt buộc × 100
```
- Chỉ đếm báo cáo **bắt buộc** (mặc định: BC Demo của các deal đã/đang ở Demo).
- Luôn hiển thị dạng **"23/25 — 92%"**, không bao giờ hiển thị số trần "50 báo cáo".
- Sales không có deal nào cần báo cáo → hiển thị "—" (không kết luận), không phải 0%.

## 8. Phân quyền
| | Sales | Leader | Admin |
|---|---|---|---|
| Xem / sửa deal của mình | ✓ | ✓ | ✓ |
| Xem / sửa deal khu vực mình | — | ✓ | ✓ (tất cả) |
| Duyệt báo cáo, Skip Demo | — | ✓ (khu vực mình) | ✓ |
| Duyệt báo cáo của chính mình | — | ✗ | ✓ |
| Xem compliance, audit log | của mình | khu vực | tất cả |
| Sửa cài đặt (ngưỡng, luật) | — | — | ✓ |
Leader có khu vực **"Toàn Quốc"** được coi như Admin về phạm vi xem.

## 9. Audit log
Mọi hành động quan trọng đều ghi **ai · làm gì · khi nào · deal nào**: tạo deal, cập nhật hoạt động, chuyển stage, nộp/duyệt/từ chối báo cáo, xin/duyệt Skip Demo, Win/Fail, yêu cầu xóa.

## 10. Nguyên tắc thiết kế
Simple → Clear → Reliable → Easy to use → Expandable. Không popup thừa, không bắt nhập trùng, không AI ở giai đoạn này.
Mục tiêu cuối: **Sales không bỏ quên khách — Leader nhìn thấy vấn đề trước khi mất deal.**
