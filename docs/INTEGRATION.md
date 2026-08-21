# HƯỚNG DẪN TÍCH HỢP — dành cho người phát triển CRM Roboworld One (hoặc Claude Code)

> **Nếu bạn là Claude Code:** đọc file này + `BUSINESS-RULES.md` + `DATA-MODEL.md` rồi thực hiện theo thứ tự 6 bước bên dưới.
> KHÔNG viết lại luật nghiệp vụ — luật đã nằm trong `core/` và có 22 test bảo vệ. Việc của bạn là **nối dây**:
> database của CRM ↔ `Repository`, login của CRM ↔ `User`, màn hình của CRM ↔ `api/handlers.ts`.

## Module này là gì

Module **Quản lý Báo cáo & Kiểm soát Pipeline Sales**: chặn chuyển stage sai luật, bắt buộc báo cáo ở mốc Demo → Đàm phán,
luồng Skip Demo có Leader duyệt, nhắc nhở 3 cấp khi deal bị bỏ quên, Deal Health, Report Compliance theo sales/khu vực/tháng,
audit log. Viết bằng TypeScript thuần, **không phụ thuộc framework, database hay thư viện nào** (0 dependency).

```
core/          ← luật + tính toán + service. KHÔNG SỬA (trừ khi đổi luật → sửa DEFAULT_SETTINGS hoặc settings trong DB)
api/           ← handlers độc lập framework + hợp đồng HTTP
adapters/      ← memory (test), sql (mẫu D1/Postgres), google-sheets (bản đang chạy tạm trên huyhoangrobot.com)
ui/            ← tham chiếu giao diện (Next.js/React) + mô tả màn hình để dựng lại bằng HTML của CRM
docs/          ← tài liệu này, luật, data model, test case
```

## Những gì đã biết về CRM Roboworld One (quan sát từ bên ngoài — cần xác nhận)

- Ứng dụng web server-render (không phải Next.js), PWA cài lên điện thoại, chạy sau Cloudflare, font Inter + Bricolage Grotesque, màu chủ đạo `#DD1E25` / `#C13F28`.
- Đã có: Pipeline bán hàng 7 stage đúng tên, Sổ khách hàng, phân vùng Miền Bắc/Trung/Nam, đăng nhập người dùng, Book Demo, Báo giá, Hợp đồng.
- **File báo cáo:** giữ cách hiện tại — sales upload lên Google Drive, dán link. Module chỉ lưu `file_url`.

## 6 BƯỚC TÍCH HỢP

### Bước 1 — Copy module vào CRM
```
cp -R roboworld-sales-report-module/core  <crm>/src/sales-report/core
cp -R roboworld-sales-report-module/api   <crm>/src/sales-report/api
```
Nếu CRM không dùng TypeScript: chạy `npx tsc` với `outDir` để lấy bản `.js` (ESM), hoặc dùng esbuild/bundler sẵn có. Import trong core dùng đuôi `.ts` — cấu hình `allowImportingTsExtensions` hoặc để bundler xử lý.

### Bước 2 — Database: thêm cột + 4 bảng mới
Chạy `adapters/sql/schema.sqlite.sql` (D1/SQLite) hoặc `schema.postgres.sql`.
- **Không tạo bảng deal/khách hàng mới** — chỉ `ALTER TABLE` thêm 7 cột vào bảng deal hiện có (khối comment đầu file).
- 4 bảng mới có tiền tố `sr_` để không đụng bảng nào của CRM: `sr_stage_history`, `sr_reports`, `sr_audit_log`, `sr_settings`.
- Backfill 1 lần: `UPDATE deals SET stage_entered_at = COALESCE(stage_entered_at, updated_at), last_activity_at = COALESCE(last_activity_at, updated_at)`.

### Bước 3 — Viết adapter `Repository` (file quan trọng nhất, ~150 dòng)
Copy `adapters/sql/sql-repository.example.ts`, sửa tên bảng/cột cho khớp CRM. Interface cần implement ở `core/repository.ts` (10 hàm).
Map vai trò: người có quyền quản lý khu vực → `role: "Leader"`, quản trị toàn hệ thống → `"Admin"`, còn lại `"Sales"`.
Leader có `region: "Toàn Quốc"` hoặc role Admin thấy mọi deal; Leader khu vực chỉ thấy deal trong khu vực mình.

Kiểm tra adapter bằng cách chạy lại test với adapter của bạn thay `MemoryRepository` (copy `core/__tests__/module.test.ts`, đổi `new MemoryRepository()` → adapter nối DB test).

### Bước 4 — Gắn API
```ts
import { createHandlers } from "./sales-report/api/handlers.ts";
const { handle } = createHandlers(new CrmRepository(db));
// mỗi route: user = từ session login của CRM; xem api/http-contract.md
```
12 endpoint — tất cả nhận `User` đã xác thực, **không có login riêng** (bản PIN trong `ui/reference-nextjs` chỉ là tạm thời cho huyhoangrobot.com, bỏ qua).

### Bước 5 — Giao diện (theo phong cách CRM sẵn có)
Dựng 4 màn hình bằng HTML/CSS của CRM, mô tả chi tiết ở `ui/screens.md`:
1. **Trang deal** — thêm khối: Cập nhật hoạt động · Nộp báo cáo · Chuyển stage (hiển thị lỗi 422 từ API nguyên văn) · Xin Skip Demo · Chốt Win/Fail · Danh sách báo cáo (Leader có nút Duyệt/Từ chối).
2. **Pipeline Kanban** — thêm lên card: `status.healthLabel`, `status.reminderLabel`, "THIẾU BC Demo" đỏ, số ngày ở stage.
3. **Dashboard Leader** — `GET /dashboard`: chip cảnh báo, mục "Chờ Leader xử lý", bảng compliance theo sales (luôn hiển thị `submitted/required` kèm %), theo khu vực, ma trận 12 tháng, danh sách Attention.
4. **Thư viện báo cáo** `/crm/reports` — bảng từ `sr_reports` join deal: lọc theo sales/loại/stage/trạng thái/tháng/năm, mở file, mở deal.

### Bước 6 — Cron nhắc nhở + Notification
Job chạy mỗi sáng (Cloudflare Cron Trigger / scheduler của CRM): gọi `handle(systemUser, "GET /reminders")`
→ với mỗi sales trong `bySales`: gửi `buildReminderMessage()` qua kênh CRM đang có (Web Push đã có sẵn trong `sw.js`, hoặc Zalo/email).
→ `escalations` (mức 3) gửi thêm cho Leader khu vực. Ghi notification vào Notification Center của CRM với các loại: Follow-up Due, Deal Overdue, Missing Report, Report Rejected/Approved, Skip Demo Approved/Rejected, Leader Escalation.

## Cấu hình (không hard-code)
Bảng `sr_settings` (hoặc `DEFAULT_SETTINGS` trong `core/types.ts`):
| key | mặc định | ý nghĩa |
|---|---|---|
| `remindDays` | `[3,5,7]` | ngày không hoạt động → nhắc 1 / nhắc 2 / báo Leader |
| `stageOverdueDays` | `14` | ở 1 stage quá N ngày → cảnh báo |
| `requiredReports` | `{"Demo":"BC Demo"}` | stage nào cần báo cáo gì khi rời stage |
| `requireLeaderApprovalForSkip` | `true` | Skip Demo cần Leader duyệt |

## Nghiệm thu
Chạy `npm test` trong module (22 test) → tích hợp xong chạy lại 10 kịch bản thủ công trong `docs/TEST-CASES.md` trên CRM thật.

## Lộ trình MVP (đã có sẵn trong core — CRM bật dần theo màn hình)
- **MVP 1:** Pipeline control · Stage history · Report upload · Report Library · Skip Demo → Bước 1–5
- **MVP 2:** Reminder 3 cấp · Overdue · Notification → Bước 6
- **MVP 3:** Compliance theo sales/tháng/năm · Leader Dashboard → `GET /dashboard` (đã có)
- **MVP 4:** Deal Health nâng cao · Automation Trigger→Condition→Action · Report Quality (cột `quality_*` đã chừa sẵn)
