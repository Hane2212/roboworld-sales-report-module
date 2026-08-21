# DATA MODEL

Nguyên tắc: **tái sử dụng** bảng users / customers / deals của CRM. Module chỉ thêm cột vào deal và tạo 4 bảng tiền tố `sr_`.
DDL đầy đủ: `adapters/sql/schema.sqlite.sql` (D1) · `adapters/sql/schema.postgres.sql`.

## Deal (bảng sẵn có của CRM + 7 cột thêm)
| Cột thêm | Kiểu | Ý nghĩa |
|---|---|---|
| `stage_entered_at` | date | ngày vào stage hiện tại → tính "Days in Current Stage" |
| `last_activity_at` | date | hoạt động gần nhất → tính nhắc nhở |
| `next_follow_up_at` | date null | hẹn follow-up |
| `skip_demo_requested` | bool | đã xin Skip Demo |
| `skip_demo_reason` | text | lý do |
| `skip_demo_approval` | text | Chờ duyệt / Đã duyệt / Từ chối |
| `outcome` | text | Win / Fail (deal đóng) |

Các cột CRM đã có mà module dùng: `id`, tên khách, `region`, sales phụ trách (id + tên), `stage`, `created_at`, `note`.

## sr_stage_history
`deal_id, sales_name, from_stage, to_stage, reason, changed_at, changed_by` — mỗi lần chuyển stage 1 dòng. Dùng cho lịch sử deal + compliance chính xác theo lịch sử (`complianceWithHistory`).

## sr_reports (Report Library)
`deal_id, sales_id, sales_name, type, stage, file_url, file_name, file_type, file_size, version, status, reviewed_by, review_note, submitted_at, updated_at` + 4 cột `quality_*` chừa sẵn cho Report Quality (MVP 4).
- `type`: BC Khảo sát · BC Demo · BC Skip Demo · BC Đàm phán · BC Follow-up · Khác — Admin thêm loại mới bằng cách mở rộng `REPORT_TYPES`/settings.
- File **không lưu trong DB** — chỉ `file_url` (Google Drive) + metadata.

## sr_audit_log
`at, by_user, action, deal_id, detail`. Các `action`: DEAL_CREATED · ACTIVITY · STAGE_CHANGED · SKIP_REQUESTED · SKIP_APPROVED · SKIP_REJECTED · REPORT_SUBMITTED · REPORT_APPROVED · REPORT_REJECTED · REPORT_DELETE_REQUESTED · DEAL_WIN · DEAL_FAIL.

## sr_settings (key/value JSON)
`remindDays` · `stageOverdueDays` · `requiredReports` · `requireLeaderApprovalForSkip` — xem INTEGRATION.md.

## Bảng CHƯA tạo (để MVP sau, tránh overengineer)
`sr_notifications` (nếu CRM chưa có Notification Center), `sr_automation_rules` (Trigger → Condition → Action), `sr_follow_ups` (nếu muốn tách khỏi cột `next_follow_up_at`).

## Ánh xạ với đối tượng TypeScript
`core/types.ts`: `Deal`, `Report`, `StageHistory`, `User`, `Settings`. Mọi ngày tháng là chuỗi `YYYY-MM-DD` (tiện ích `core/dates.ts` đổi qua lại dd/mm/yyyy).
