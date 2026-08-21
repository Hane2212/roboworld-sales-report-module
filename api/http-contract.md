# Hợp đồng HTTP API — Module Báo cáo Sales

Mọi endpoint nằm dưới tiền tố do CRM chọn, ví dụ `/crm/api/sales-report`.
**Xác thực:** dùng phiên đăng nhập sẵn có của CRM. CRM tạo `User { id, name, region, role }` rồi gọi `handle()`.
**Lỗi:** `{ ok:false, error:"<tiếng Việt, hiển thị thẳng>", code:"<MÃ>" }` với HTTP 403/404/422/500.

| Method & path | Ai gọi | Body | Trả về |
|---|---|---|---|
| `GET /deals` | Sales / Leader | — | `Deal[]` kèm `status` (health, mức nhắc, báo cáo thiếu) — Sales chỉ thấy deal của mình, Leader thấy theo khu vực |
| `POST /deals` | Sales / Leader | `{ customerName, region?, stage?, salesId?, salesName?, nextFollowUpAt?, note? }` | `Deal` (201) — mã tự sinh `MB-001`… |
| `GET /deals/:id` | người phụ trách / Leader | — | `{ deal, status, reports[], history[] }` |
| `POST /deals/:id/activity` | Sales | `{ note?, nextFollowUpAt? }` | ghi nhận hoạt động hôm nay |
| `POST /deals/:id/stage` | Sales | `{ stage, reason? }` | **chạy toàn bộ luật pipeline** — lỗi 422 kèm message nếu vi phạm |
| `POST /deals/:id/skip-demo` | Sales | `{ reason, explanation? }` | tạo yêu cầu Skip Demo (trạng thái Chờ duyệt) |
| `POST /deals/:id/skip-demo/decision` | Leader | `{ approve: true/false, note? }` | duyệt / từ chối |
| `POST /deals/:id/close` | Sales | `{ outcome: "Win"/"Fail", reason? }` | đóng deal |
| `POST /deals/:id/reports` | Sales | `{ type, fileUrl, note? }` | `Report` (201) — tự tăng version |
| `POST /reports/:id/review` | Leader | `{ status: "Đã duyệt"/"Từ chối", note }` | từ chối bắt buộc `note` |
| `GET /dashboard` | mọi người | `?year=` | Sales: số liệu của mình · Leader: + `attention[]`, `bySales[]`, `byRegion[]`, `monthly{}` |
| `GET /reminders` | cron / Leader | — | `{ bySales{}, escalations[] }` để gửi nhắc (Zalo/email/push) |

## Mã lỗi nghiệp vụ (code)
`STAGE_SKIP` nhảy cóc · `REPORT_MISSING` thiếu BC Demo · `SKIP_NOT_REQUESTED` · `SKIP_NOT_APPROVED` · `SKIP_REPORT_MISSING` · `SKIP_REASON_INVALID` · `SKIP_EXPLANATION_REQUIRED` · `REJECT_REASON_REQUIRED` · `SELF_REVIEW` · `NOT_LEADER` · `FORBIDDEN` · `NOT_FOUND` · `DEAL_CLOSED` · `BAD_URL`

## Ví dụ gắn vào Hono (Cloudflare Workers)
```ts
import { createHandlers } from "./sales-report-module/api/handlers.ts";
const { handle } = createHandlers(new D1Repository(env.DB));
app.post("/crm/api/sales-report/deals/:id/stage", async (c) => {
  const user = await currentUser(c);                    // login sẵn có của CRM
  const r = await handle(user, "POST /deals/:id/stage", { id: c.req.param("id") }, await c.req.json());
  return c.json(r.body, r.status);
});
```
