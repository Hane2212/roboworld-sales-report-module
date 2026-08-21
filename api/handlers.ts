/**
 * HTTP handlers ĐỘC LẬP FRAMEWORK.
 * CRM (Cloudflare Workers / Hono / Express / Next.js / ...) chỉ cần:
 *   1. Xác thực người dùng bằng hệ thống login sẵn có → tạo object User
 *   2. Gọi handle(user, route, body) → nhận { status, body } → trả JSON
 * Xem api/http-contract.md cho danh sách endpoint.
 */
import { BusinessError, STAGES } from "../core/types.ts";
import type { Outcome, ReportType, Stage, User } from "../core/types.ts";
import type { Repository } from "../core/repository.ts";
import { SalesReportService } from "../core/services.ts";
import { computeDealStatus } from "../core/status.ts";
import { attentionItems, complianceByRegion, complianceBySales, monthlyReportMatrix } from "../core/analytics.ts";
import { isLeader } from "../core/rules.ts";
import { todayISO } from "../core/dates.ts";

export interface HttpResult {
  status: number;
  body: unknown;
}

export type Route =
  | "GET /deals"
  | "POST /deals"
  | "GET /deals/:id"
  | "POST /deals/:id/activity"
  | "POST /deals/:id/stage"
  | "POST /deals/:id/skip-demo"
  | "POST /deals/:id/skip-demo/decision"
  | "POST /deals/:id/close"
  | "POST /deals/:id/reports"
  | "POST /reports/:id/review"
  | "GET /dashboard"
  | "GET /reminders";

export function createHandlers(repo: Repository, today: () => string = () => todayISO()) {
  const svc = new SalesReportService(repo, today);

  async function handle(user: User, route: Route, params: { id?: string } = {}, body: Record<string, unknown> = {}): Promise<HttpResult> {
    try {
      const settings = await repo.getSettings();
      switch (route) {
        case "GET /deals": {
          const deals = await svc.dealsFor(user);
          const reports = await repo.listReports();
          return ok(deals.map((d) => ({ ...d, status: computeDealStatus(d, reports, settings, today()) })));
        }
        case "POST /deals":
          return ok(await svc.createDeal(user, body as Parameters<typeof svc.createDeal>[1]), 201);
        case "GET /deals/:id": {
          const deals = await svc.dealsFor(user);
          const deal = deals.find((d) => d.id === params.id);
          if (!deal) return err(new BusinessError("Không tìm thấy deal", "NOT_FOUND", 404));
          const reports = await repo.listReports(deal.id);
          return ok({ deal, status: computeDealStatus(deal, reports, settings, today()), reports, history: await repo.listStageHistory(deal.id) });
        }
        case "POST /deals/:id/activity":
          await svc.touch(user, params.id!, { note: str(body.note), nextFollowUpAt: body.nextFollowUpAt as string | null | undefined });
          return ok({ ok: true });
        case "POST /deals/:id/stage": {
          const stage = body.stage as Stage;
          if (!STAGES.includes(stage)) return err(new BusinessError("Stage không hợp lệ", "INVALID_STAGE"));
          await svc.changeStage(user, params.id!, stage, str(body.reason) || "");
          return ok({ ok: true });
        }
        case "POST /deals/:id/skip-demo":
          await svc.requestSkipDemo(user, params.id!, str(body.reason) || "", str(body.explanation) || "");
          return ok({ ok: true });
        case "POST /deals/:id/skip-demo/decision":
          await svc.decideSkipDemo(user, params.id!, body.approve === true, str(body.note) || "");
          return ok({ ok: true });
        case "POST /deals/:id/close":
          await svc.closeDeal(user, params.id!, body.outcome as Outcome, str(body.reason) || "");
          return ok({ ok: true });
        case "POST /deals/:id/reports":
          return ok(await svc.submitReport(user, params.id!, body.type as ReportType, str(body.fileUrl) || "", str(body.note) || ""), 201);
        case "POST /reports/:id/review":
          await svc.reviewReport(user, params.id!, body.status === "Đã duyệt" ? "Đã duyệt" : "Từ chối", str(body.note) || "");
          return ok({ ok: true });
        case "GET /dashboard": {
          const deals = await svc.dealsFor(user);
          const reports = await repo.listReports();
          const t = today();
          const year = Number(body.year) || Number(t.slice(0, 4));
          const users = await repo.listUsers();
          const base = {
            totalOpen: deals.filter((d) => !d.outcome).length,
            byStage: Object.fromEntries(STAGES.map((s) => [s, deals.filter((d) => d.stage === s && !d.outcome).length])),
            needAttention: deals.filter((d) => computeDealStatus(d, reports, settings, t).reminderLevel > 0).length,
            missingReports: deals.filter((d) => computeDealStatus(d, reports, settings, t).requiredReportSubmitted === false).length,
            skipPending: deals.filter((d) => d.skipDemoRequested && d.skipDemoApproval === "Chờ duyệt").length,
            reportsPending: reports.filter((r) => r.status === "Đã nộp" && deals.some((d) => d.id === r.dealId)).length,
          };
          if (!isLeader(user)) return ok(base);
          return ok({
            ...base,
            attention: attentionItems(deals, reports, settings, t),
            bySales: complianceBySales(deals, reports, settings, t, users.filter((u) => u.role === "Sales" || deals.some((d) => d.salesId === u.id))),
            byRegion: complianceByRegion(deals, reports, settings, t),
            monthly: monthlyReportMatrix(reports, year, users.map((u) => u.name)),
          });
        }
        case "GET /reminders": {
          // Dành cho cron/scheduled job: danh sách cần nhắc, nhóm theo sales + escalation cho leader
          if (!isLeader(user)) return err(new BusinessError("Chỉ hệ thống/Leader được gọi", "NOT_LEADER", 403));
          const deals = await repo.listDeals();
          const reports = await repo.listReports();
          const t = today();
          const items = deals
            .map((d) => ({ deal: d, status: computeDealStatus(d, reports, settings, t) }))
            .filter((x) => x.status.reminderLevel > 0);
          const bySales: Record<string, typeof items> = {};
          for (const it of items) (bySales[it.deal.salesName] ||= []).push(it);
          return ok({ bySales, escalations: items.filter((x) => x.status.reminderLevel >= 3) });
        }
        default:
          return err(new BusinessError("Không có route này", "NO_ROUTE", 404));
      }
    } catch (e) {
      return err(e);
    }
  }

  return { handle, service: svc };
}

function ok(body: unknown, status = 200): HttpResult {
  return { status, body };
}
function err(e: unknown): HttpResult {
  if (e instanceof BusinessError) return { status: e.httpStatus, body: { ok: false, error: e.message, code: e.code } };
  return { status: 500, body: { ok: false, error: e instanceof Error ? e.message : "Lỗi hệ thống", code: "INTERNAL" } };
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
