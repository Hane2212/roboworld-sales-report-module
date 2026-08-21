/**
 * "Ổ cắm" dữ liệu. CRM Roboworld chỉ cần viết 1 class implement interface này
 * (đọc/ghi vào database của mình) là toàn bộ luật + thống kê + API chạy được.
 * Xem adapters/memory (bản mẫu đầy đủ, dùng cho test) và adapters/sql (mẫu SQL).
 */
import type { Deal, Report, Settings, StageHistory, User } from "./types.ts";

export interface Repository {
  getSettings(): Promise<Settings>;
  listUsers(): Promise<User[]>;

  listDeals(): Promise<Deal[]>;
  getDeal(id: string): Promise<Deal | null>;
  createDeal(deal: Deal): Promise<void>;
  updateDeal(id: string, patch: Partial<Deal>): Promise<void>;

  listReports(dealId?: string): Promise<Report[]>;
  addReport(report: Omit<Report, "id">): Promise<Report>;
  updateReport(id: string, patch: Partial<Report>): Promise<void>;

  addStageHistory(entry: StageHistory): Promise<void>;
  listStageHistory(dealId?: string): Promise<StageHistory[]>;

  /** Audit log: ai làm gì, khi nào, trên deal nào. */
  audit(entry: { at: string; by: string; action: string; dealId?: string; detail?: string }): Promise<void>;
}
