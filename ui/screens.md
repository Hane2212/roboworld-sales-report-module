# MÔ TẢ MÀN HÌNH — dựng lại bằng HTML/CSS của CRM Roboworld One

Thư mục `reference-nextjs/` là bản chạy thật trên huyhoangrobot.com (React/Tailwind) — dùng để **tham khảo hành vi**, không cần copy nguyên. CRM dùng style sẵn có (Inter, đỏ #DD1E25, nền #f6f3f4, card trắng bo góc).

## A. Trang deal (bổ sung vào trang khách hàng/deal hiện có)
Header deal: tên khách · mã · khu vực · sales · `healthLabel` + `reminderLabel` to, góc phải.
Hàng thông tin 4 ô: Stage · Ở stage N ngày · HĐ gần nhất · Báo cáo bắt buộc (🔴 "BC Demo — THIẾU" nếu thiếu).
Nếu `skipDemoRequested`: dải thông tin "Skip Demo: <lý do> · <trạng thái>" (xanh/cam/đỏ).

Các khối thao tác (ẩn khi deal đã Win/Fail):
1. **📞 Cập nhật hoạt động** — ô ghi chú + ngày follow-up + nút "Tôi vừa làm việc với khách hôm nay" → `POST /deals/:id/activity`.
2. **📄 Nộp báo cáo** — chọn loại (mặc định = loại bắt buộc của stage) + dán link Drive + ghi chú → `POST /deals/:id/reports`.
3. **➡️ Chuyển giai đoạn** — select stage + nút Chuyển → `POST /deals/:id/stage`; hiển thị `error` nguyên văn khi 422.
   Bên trong, nếu stage = Khảo sát và chưa xin skip: khối "Muốn bỏ qua Demo?" — select lý do (+ ô giải trình khi 'Lý do khác') → `POST /deals/:id/skip-demo`.
4. **🏁 Chốt deal** — nút Win (xanh) / Fail (xám), confirm → `POST /deals/:id/close`.
5. **📚 Báo cáo của deal** — danh sách: loại · vN · trạng thái màu · ngày · người nộp · người duyệt · "Mở file". Leader (không phải người nộp): nút Duyệt / Từ chối (từ chối mở ô lý do bắt buộc) → `POST /reports/:id/review`.

Leader + `skipDemoApproval = Chờ duyệt`: hộp xanh nổi bật trên cùng "🔔 Yêu cầu Skip Demo đang chờ bạn duyệt" với 2 nút → `POST /deals/:id/skip-demo/decision`.

## B. Pipeline Kanban (đã có — thêm lên card)
`healthLabel` · `reminderLabel` · "THIẾU BC Demo" (đỏ đậm) · "N ngày" ở stage (đỏ nếu `stageOverdue`) · HĐ gần nhất · follow-up.
Sắp xếp trong cột: 🔴 trước, rồi 🟠/🟡, rồi 🟢.

## C. Dashboard Leader (`GET /dashboard`)
- Hàng chip: Deal đang mở · Cần cập nhật (cam) · Thiếu báo cáo (đỏ) · Chờ duyệt BC + Skip (xanh).
- Hộp "🔔 Chờ Leader xử lý": link từng yêu cầu Skip Demo + từng báo cáo Đã nộp.
- "Attention Required": danh sách `attention[]` (🔴/🟡/🟢 từng dòng).
- Bảng theo khu vực: Deal mở · 🔴 · Thiếu BC · Đã nộp · Compliance %.
- Bảng theo sales: Sales · Khu vực · Deal mở · Cần BC · Đã nộp · Thiếu · **Compliance % (hiển thị "23/25 — 92%")** · Deal cần nhắc.
- Ma trận 12 tháng (chọn năm) `monthly{}` — click ô mở thư viện báo cáo lọc theo sales + tháng.
Sales thường chỉ thấy hàng chip + deal của mình.

## D. Thư viện báo cáo `/crm/reports`
Bảng: Báo cáo (loại + vN) · Khách · Deal · Sales · Stage · Ngày nộp · Trạng thái · [Mở file] [Mở deal].
Bộ lọc: Sales · Khách · Loại · Stage · Trạng thái · Tháng · Năm. Ưu tiên Table view cho Leader; search theo tên khách.
Chi tiết báo cáo (drawer/modal): Khách (tên, công ty, SĐT) · Deal (tên, stage) · Sales · Report (loại, stage lúc nộp, ngày, file, ghi chú, lý do từ chối).

## E. Widget "Cần xử lý hôm nay" (trang Tổng quan)
Overdue Deals · Missing Reports · Pending Approval · Follow-up Due (so `next_follow_up_at` ≤ hôm nay) · Skip Demo Pending — số + link.

## F. Notification Center (bổ sung loại)
New Lead · Follow-up Due · Deal Overdue · Missing Report · Report Rejected · Report Approved · Skip Demo Approved · Skip Demo Rejected · Leader Escalation. Nội dung nhắc dùng `buildReminderMessage()`.
