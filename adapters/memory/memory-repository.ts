/**
 * Repository chạy trong bộ nhớ — dùng cho test và để tham khảo cách implement.
 * CRM thật thay bằng adapter đọc/ghi database của mình (xem adapters/sql).
 */
import type { Repository } from "../../core/repository.ts";
import { DEFAULT_SETTINGS } from "../../core/types.ts";
import type { Deal, Report, Settings, StageHistory, User } from "../../core/types.ts";

export class MemoryRepository implements Repository {
  deals: Deal[] = [];
  reports: Report[] = [];
  history: StageHistory[] = [];
  audits: Array<{ at: string; by: string; action: string; dealId?: string; detail?: string }> = [];
  users: User[] = [];
  settings: Settings = structuredClone(DEFAULT_SETTINGS);
  private seq = 1;

  async getSettings() { return this.settings; }
  async listUsers() { return this.users; }
  async listDeals() { return this.deals.map((d) => ({ ...d })); }
  async getDeal(id: string) { const d = this.deals.find((x) => x.id === id); return d ? { ...d } : null; }
  async createDeal(deal: Deal) { this.deals.push({ ...deal }); }
  async updateDeal(id: string, patch: Partial<Deal>) {
    const d = this.deals.find((x) => x.id === id);
    if (d) Object.assign(d, patch);
  }
  async listReports(dealId?: string) {
    return this.reports.filter((r) => !dealId || r.dealId === dealId).map((r) => ({ ...r }));
  }
  async addReport(report: Omit<Report, "id">) {
    const r: Report = { ...report, id: `R${this.seq++}` };
    this.reports.push(r);
    return { ...r };
  }
  async updateReport(id: string, patch: Partial<Report>) {
    const r = this.reports.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  }
  async addStageHistory(entry: StageHistory) { this.history.push({ ...entry, id: `H${this.seq++}` }); }
  async listStageHistory(dealId?: string) { return this.history.filter((h) => !dealId || h.dealId === dealId); }
  async audit(entry: { at: string; by: string; action: string; dealId?: string; detail?: string }) { this.audits.push(entry); }
}
