/**
 * MẪU adapter SQL — minh họa cách map bảng của CRM sang interface Repository.
 * Đây là bản SƯỜN (có TODO), người tích hợp thay `db.query` bằng driver thật
 * (D1: env.DB.prepare(...).bind(...).all(); pg: pool.query(...); Prisma: prisma.$queryRaw...).
 */
import type { Repository } from "../../core/repository.ts";
import { DEFAULT_SETTINGS } from "../../core/types.ts";
import type { Deal, Report, Settings, StageHistory, User } from "../../core/types.ts";

interface Db {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ lastId?: number | string }>;
}

// TODO: đổi tên bảng/cột cho khớp CRM Roboworld (vd bảng khách hàng = `customers`, cột sales = `owner_id`)
const T = { deals: "deals", users: "users" };

export class SqlRepository implements Repository {
  private db: Db;
  constructor(db: Db) { this.db = db; }

  async getSettings(): Promise<Settings> {
    const rows = await this.db.all<{ key: string; value: string }>(`SELECT key, value FROM sr_settings`);
    const s: Settings = structuredClone(DEFAULT_SETTINGS);
    for (const r of rows) {
      const v = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
      if (r.key === "remindDays") s.remindDays = v;
      if (r.key === "stageOverdueDays") s.stageOverdueDays = v;
      if (r.key === "requiredReports") s.requiredReports = { ...DEFAULT_SETTINGS.requiredReports, ...v };
      if (r.key === "requireLeaderApprovalForSkip") s.requireLeaderApprovalForSkip = v;
    }
    return s;
  }

  async listUsers(): Promise<User[]> {
    // TODO: map cột vai trò của CRM → 'Sales' | 'Leader' | 'Admin'
    return this.db.all<User>(`SELECT id, name, region, role FROM ${T.users} WHERE active = 1`);
  }

  async listDeals(): Promise<Deal[]> {
    return (await this.db.all(`SELECT * FROM ${T.deals}`)).map(rowToDeal);
  }
  async getDeal(id: string) {
    const r = await this.db.all(`SELECT * FROM ${T.deals} WHERE id = ?`, [id]);
    return r[0] ? rowToDeal(r[0]) : null;
  }
  async createDeal(d: Deal) {
    await this.db.run(
      `INSERT INTO ${T.deals} (id, customer_name, region, sales_id, sales_name, stage, stage_entered_at, last_activity_at,
         next_follow_up_at, skip_demo_requested, skip_demo_reason, skip_demo_approval, outcome, note, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.id, d.customerName, d.region, d.salesId, d.salesName, d.stage, d.stageEnteredAt, d.lastActivityAt,
       d.nextFollowUpAt, d.skipDemoRequested ? 1 : 0, d.skipDemoReason, d.skipDemoApproval, d.outcome, d.note, d.createdAt]
    );
  }
  async updateDeal(id: string, patch: Partial<Deal>) {
    const map: Record<string, string> = {
      stage: "stage", stageEnteredAt: "stage_entered_at", lastActivityAt: "last_activity_at",
      nextFollowUpAt: "next_follow_up_at", skipDemoRequested: "skip_demo_requested", skipDemoReason: "skip_demo_reason",
      skipDemoApproval: "skip_demo_approval", outcome: "outcome", note: "note",
    };
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (!map[k]) continue;
      sets.push(`${map[k]} = ?`);
      vals.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
    }
    if (!sets.length) return;
    await this.db.run(`UPDATE ${T.deals} SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
  }

  async listReports(dealId?: string): Promise<Report[]> {
    const rows = dealId
      ? await this.db.all(`SELECT * FROM sr_reports WHERE deal_id = ? ORDER BY id`, [dealId])
      : await this.db.all(`SELECT * FROM sr_reports ORDER BY id`);
    return rows.map(rowToReport);
  }
  async addReport(r: Omit<Report, "id">): Promise<Report> {
    const res = await this.db.run(
      `INSERT INTO sr_reports (deal_id, sales_id, sales_name, type, stage, file_url, version, status, reviewed_by, review_note, submitted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [r.dealId, r.salesId, r.salesName, r.type, r.stage, r.fileUrl, r.version, r.status, r.reviewedBy, r.reviewNote, r.submittedAt]
    );
    return { ...r, id: String(res.lastId) };
  }
  async updateReport(id: string, patch: Partial<Report>) {
    const map: Record<string, string> = { status: "status", reviewedBy: "reviewed_by", reviewNote: "review_note" };
    const sets: string[] = []; const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) if (map[k]) { sets.push(`${map[k]} = ?`); vals.push(v); }
    if (!sets.length) return;
    await this.db.run(`UPDATE sr_reports SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...vals, id]);
  }

  async addStageHistory(h: StageHistory) {
    await this.db.run(
      `INSERT INTO sr_stage_history (deal_id, sales_name, from_stage, to_stage, reason, changed_at, changed_by) VALUES (?,?,?,?,?,?,?)`,
      [h.dealId, h.salesName, h.fromStage, h.toStage, h.reason, h.changedAt, h.changedBy]
    );
  }
  async listStageHistory(dealId?: string): Promise<StageHistory[]> {
    const rows = dealId
      ? await this.db.all(`SELECT * FROM sr_stage_history WHERE deal_id = ? ORDER BY id`, [dealId])
      : await this.db.all(`SELECT * FROM sr_stage_history ORDER BY id`);
    return rows.map((r) => ({
      id: String(r.id), dealId: String(r.deal_id), salesName: String(r.sales_name),
      fromStage: r.from_stage as StageHistory["fromStage"], toStage: String(r.to_stage),
      reason: String(r.reason ?? ""), changedAt: String(r.changed_at), changedBy: String(r.changed_by),
    }));
  }
  async audit(e: { at: string; by: string; action: string; dealId?: string; detail?: string }) {
    await this.db.run(`INSERT INTO sr_audit_log (at, by_user, action, deal_id, detail) VALUES (?,?,?,?,?)`,
      [e.at, e.by, e.action, e.dealId ?? null, e.detail ?? null]);
  }
}

function rowToDeal(r: Record<string, unknown>): Deal {
  return {
    id: String(r.id), customerName: String(r.customer_name ?? r.name ?? ""), region: String(r.region ?? ""),
    salesId: String(r.sales_id ?? ""), salesName: String(r.sales_name ?? ""),
    stage: r.stage as Deal["stage"], stageEnteredAt: String(r.stage_entered_at ?? r.created_at ?? ""),
    lastActivityAt: String(r.last_activity_at ?? r.created_at ?? ""),
    nextFollowUpAt: (r.next_follow_up_at as string) ?? null,
    skipDemoRequested: Boolean(r.skip_demo_requested), skipDemoReason: (r.skip_demo_reason as string) ?? null,
    skipDemoApproval: (r.skip_demo_approval as Deal["skipDemoApproval"]) ?? null,
    outcome: (r.outcome as Deal["outcome"]) ?? null, note: String(r.note ?? ""), createdAt: String(r.created_at ?? ""),
  };
}
function rowToReport(r: Record<string, unknown>): Report {
  return {
    id: String(r.id), dealId: String(r.deal_id), salesId: String(r.sales_id), salesName: String(r.sales_name),
    type: r.type as Report["type"], stage: r.stage as Report["stage"], fileUrl: String(r.file_url),
    version: Number(r.version), status: r.status as Report["status"], reviewedBy: (r.reviewed_by as string) ?? null,
    reviewNote: String(r.review_note ?? ""), submittedAt: String(r.submitted_at),
  };
}
