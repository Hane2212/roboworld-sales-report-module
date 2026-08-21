# Roboworld — Module Quản lý Báo cáo & Kiểm soát Pipeline Sales

> Cắm vào CRM Roboworld One để: chặn chuyển stage sai luật · bắt buộc báo cáo ở mốc **Demo → Đàm phán** · Skip Demo có Leader duyệt · nhắc 3 cấp khi deal bị bỏ quên · Deal Health · Report Compliance theo sales/khu vực/tháng · audit log.

**0 dependency.** TypeScript thuần, chạy được trên Cloudflare Workers / Node / Bun / trình duyệt. Luật nghiệp vụ được bảo vệ bởi 22 test.

## Bắt đầu nhanh
```bash
npm test          # 22 test, cần Node ≥ 22.6 — không phải cài gì
```
```ts
import { createHandlers } from "./api/handlers.ts";
const { handle } = createHandlers(myRepository);          // myRepository = adapter nối DB của CRM
const r = await handle(user, "POST /deals/:id/stage", { id }, { stage: "Đàm phán" });
// r.status = 422, r.body.error = 'Chưa nộp "BC Demo" cho deal này — nộp báo cáo trước khi chuyển stage.'
```

## Đọc theo thứ tự
1. [`docs/INTEGRATION.md`](docs/INTEGRATION.md) — 6 bước tích hợp (viết cho dev / Claude Code)
2. [`docs/BUSINESS-RULES.md`](docs/BUSINESS-RULES.md) — luật nghiệp vụ bằng tiếng Việt dễ hiểu
3. [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md) + [`adapters/sql/`](adapters/sql/) — bảng cần thêm (SQLite/D1 & Postgres)
4. [`api/http-contract.md`](api/http-contract.md) — 12 endpoint
5. [`ui/screens.md`](ui/screens.md) — mô tả 6 màn hình; [`ui/reference-nextjs/`](ui/reference-nextjs/) bản chạy thật tham khảo
6. [`docs/TEST-CASES.md`](docs/TEST-CASES.md) — 10 kịch bản nghiệm thu

## Cấu trúc
```
core/        types · dates · rules · status · analytics · services · repository (interface) · __tests__
api/         handlers.ts (độc lập framework) · http-contract.md
adapters/    memory/ (test) · sql/ (DDL + adapter mẫu) · google-sheets/ (cầu nối Apps Script đang dùng tạm)
ui/          screens.md · reference-nextjs/
docs/        INTEGRATION · BUSINESS-RULES · DATA-MODEL · TEST-CASES
```

## Trạng thái
- ✅ MVP 1–3 có sẵn trong `core/` + `api/` (pipeline control, report library, skip demo, reminder engine, compliance, dashboard data)
- 🔜 MVP 4: Automation rules, Report Quality (cột DB đã chừa sẵn)
- Bản tạm đang chạy tại `huyhoangrobot.com/crm` (Google Sheets làm kho) — sẽ ngừng khi CRM tích hợp xong.

Chủ sở hữu: Chu Huy Hoàng · Roboworld · Private — không chia sẻ ra ngoài.
