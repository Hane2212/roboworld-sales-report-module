/**
 * Các thao tác nghiệp vụ — CRM gọi từ API/route handler của mình.
 * Mỗi hàm: kiểm tra quyền → kiểm tra luật → ghi dữ liệu → ghi lịch sử + audit.
 */
import { BusinessError } from "./types.ts";
import type { Deal, Outcome, Report, ReportStatus, ReportType, Stage, User } from "./types.ts";
import type { Repository } from "./repository.ts";
import {
  assertCanReview, assertSkipRequest, assertStageChange,
  canEditDeal, canLeadDeal, canViewDeal, isLeader, nextDealCode,
} from "./rules.ts";

export class SalesReportService {
  private repo: Repository;
  private today: () => string;
  constructor(repo: Repository, today: () => string) {
    this.repo = repo;
    this.today = today;
  }

  // ─── Đọc ───
  async dealsFor(user: User): Promise<Deal[]> {
    const all = await this.repo.listDeals();
    return all.filter((d) => canViewDeal(user, d));
  }

  private async mustGet(user: User, id: string): Promise<Deal> {
    const deal = await this.repo.getDeal(id);
    if (!deal) throw new BusinessError("Không tìm thấy deal", "NOT_FOUND", 404);
    if (!canEditDeal(user, deal)) throw new BusinessError("Bạn không phụ trách deal này", "FORBIDDEN", 403);
    return deal;
  }

  // ─── Tạo deal ───
  async createDeal(
    user: User,
    input: { customerName: string; region?: string; stage?: Stage; salesId?: string; salesName?: string; nextFollowUpAt?: string | null; note?: string }
  ): Promise<Deal> {
    const customerName = input.customerName?.trim();
    if (!customerName) throw new BusinessError("Nhập tên khách hàng", "CUSTOMER_REQUIRED");
    const region = input.region || user.region;
    const assignOther = isLeader(user) && input.salesId;
    const today = this.today();
    const existing = (await this.repo.listDeals()).map((d) => d.id);
    const deal: Deal = {
      id: nextDealCode(region, existing),
      customerName,
      region,
      salesId: assignOther ? input.salesId! : user.id,
      salesName: assignOther ? input.salesName || input.salesId! : user.name,
      stage: input.stage || "Liên hệ mới",
      stageEnteredAt: today,
      lastActivityAt: today,
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      skipDemoRequested: false,
      skipDemoReason: null,
      skipDemoApproval: null,
      outcome: null,
      note: input.note || "",
      createdAt: today,
    };
    await this.repo.createDeal(deal);
    await this.repo.addStageHistory({ dealId: deal.id, salesName: deal.salesName, fromStage: "—", toStage: deal.stage, reason: "Tạo deal mới", changedAt: today, changedBy: user.name });
    await this.repo.audit({ at: today, by: user.name, action: "DEAL_CREATED", dealId: deal.id });
    return deal;
  }

  // ─── Ghi nhận hoạt động (gọi điện, gặp khách...) ───
  async touch(user: User, id: string, opts: { note?: string; nextFollowUpAt?: string | null } = {}): Promise<void> {
    const deal = await this.mustGet(user, id);
    const patch: Partial<Deal> = { lastActivityAt: this.today() };
    if (opts.nextFollowUpAt !== undefined) patch.nextFollowUpAt = opts.nextFollowUpAt;
    if (opts.note !== undefined) patch.note = opts.note;
    await this.repo.updateDeal(deal.id, patch);
    await this.repo.audit({ at: this.today(), by: user.name, action: "ACTIVITY", dealId: deal.id, detail: opts.note });
  }

  // ─── Chuyển stage ───
  async changeStage(user: User, id: string, newStage: Stage, reason = ""): Promise<void> {
    const deal = await this.mustGet(user, id);
    const reports = await this.repo.listReports(deal.id);
    const settings = await this.repo.getSettings();
    assertStageChange(deal, newStage, reports, settings);
    const today = this.today();
    await this.repo.updateDeal(deal.id, { stage: newStage, stageEnteredAt: today, lastActivityAt: today });
    const viaSkip = deal.stage === "Khảo sát" && newStage === "Đàm phán" && deal.skipDemoRequested;
    await this.repo.addStageHistory({
      dealId: deal.id, salesName: deal.salesName, fromStage: deal.stage, toStage: newStage,
      reason: viaSkip ? "Skip Demo (Leader đã duyệt)" : reason, changedAt: today, changedBy: user.name,
    });
    await this.repo.audit({ at: today, by: user.name, action: "STAGE_CHANGED", dealId: deal.id, detail: `${deal.stage} → ${newStage}` });
  }

  // ─── Skip Demo ───
  async requestSkipDemo(user: User, id: string, reason: string, explanation = ""): Promise<void> {
    const deal = await this.mustGet(user, id);
    const settings = await this.repo.getSettings();
    assertSkipRequest(deal, reason, explanation, settings);
    const approval = settings.requireLeaderApprovalForSkip ? "Chờ duyệt" : "Đã duyệt";
    const patch: Partial<Deal> = { skipDemoRequested: true, skipDemoReason: reason, skipDemoApproval: approval, lastActivityAt: this.today() };
    if (explanation.trim()) patch.note = `[Skip Demo] ${explanation.trim()}${deal.note ? ` | ${deal.note}` : ""}`;
    await this.repo.updateDeal(deal.id, patch);
    await this.repo.audit({ at: this.today(), by: user.name, action: "SKIP_REQUESTED", dealId: deal.id, detail: reason });
  }

  async decideSkipDemo(leader: User, id: string, approve: boolean, note = ""): Promise<void> {
    const deal = await this.repo.getDeal(id);
    if (!deal) throw new BusinessError("Không tìm thấy deal", "NOT_FOUND", 404);
    if (!canLeadDeal(leader, deal)) throw new BusinessError("Chỉ Leader phụ trách khu vực mới được duyệt Skip Demo", "NOT_LEADER", 403);
    if (!deal.skipDemoRequested) throw new BusinessError("Deal chưa xin Skip Demo", "NO_SKIP_REQUEST");
    await this.repo.updateDeal(deal.id, { skipDemoApproval: approve ? "Đã duyệt" : "Từ chối" });
    await this.repo.audit({ at: this.today(), by: leader.name, action: approve ? "SKIP_APPROVED" : "SKIP_REJECTED", dealId: deal.id, detail: note });
  }

  // ─── Chốt deal ───
  async closeDeal(user: User, id: string, outcome: Outcome, reason = ""): Promise<void> {
    const deal = await this.mustGet(user, id);
    if (deal.outcome) throw new BusinessError("Deal đã đóng rồi", "DEAL_CLOSED");
    const today = this.today();
    await this.repo.updateDeal(deal.id, { stage: "Win / Fail", stageEnteredAt: today, lastActivityAt: today, outcome });
    await this.repo.addStageHistory({ dealId: deal.id, salesName: deal.salesName, fromStage: deal.stage, toStage: `Win / Fail (${outcome})`, reason, changedAt: today, changedBy: user.name });
    await this.repo.audit({ at: today, by: user.name, action: `DEAL_${outcome.toUpperCase()}`, dealId: deal.id });
  }

  // ─── Báo cáo ───
  async submitReport(user: User, dealId: string, type: ReportType, fileUrl: string, note = ""): Promise<Report> {
    const deal = await this.mustGet(user, dealId);
    if (!/^https?:\/\//.test(fileUrl)) throw new BusinessError("Link file không hợp lệ (phải bắt đầu bằng https://)", "BAD_URL");
    const existing = await this.repo.listReports(deal.id);
    const version = existing.filter((r) => r.type === type).length + 1; // versioning: không đè bản cũ
    const report = await this.repo.addReport({
      dealId: deal.id, salesId: user.id, salesName: user.name, type, stage: deal.stage,
      fileUrl, version, status: "Đã nộp", reviewedBy: null, reviewNote: note, submittedAt: this.today(),
    });
    await this.repo.updateDeal(deal.id, { lastActivityAt: this.today() });
    await this.repo.audit({ at: this.today(), by: user.name, action: "REPORT_SUBMITTED", dealId: deal.id, detail: `${type} v${version}` });
    return report;
  }

  async reviewReport(leader: User, reportId: string, status: Extract<ReportStatus, "Đã duyệt" | "Từ chối">, note = ""): Promise<void> {
    const all = await this.repo.listReports();
    const report = all.find((r) => r.id === reportId);
    if (!report) throw new BusinessError("Không tìm thấy báo cáo", "NOT_FOUND", 404);
    const deal = await this.repo.getDeal(report.dealId);
    if (!deal) throw new BusinessError("Không tìm thấy deal", "NOT_FOUND", 404);
    assertCanReview(leader, report, deal);
    if (status === "Từ chối" && !note.trim()) throw new BusinessError("Từ chối phải ghi lý do để Sales sửa lại", "REJECT_REASON_REQUIRED");
    await this.repo.updateReport(report.id, { status, reviewedBy: leader.name, reviewNote: note || report.reviewNote });
    await this.repo.audit({ at: this.today(), by: leader.name, action: status === "Đã duyệt" ? "REPORT_APPROVED" : "REPORT_REJECTED", dealId: deal.id, detail: `${report.type} v${report.version}` });
  }

  /** Báo cáo Đã duyệt không được xóa — chỉ tạo yêu cầu xóa để Leader/Admin xử lý. */
  async requestDeleteReport(user: User, reportId: string, reason: string): Promise<void> {
    const report = (await this.repo.listReports()).find((r) => r.id === reportId);
    if (!report) throw new BusinessError("Không tìm thấy báo cáo", "NOT_FOUND", 404);
    if (report.status === "Đã duyệt" && user.role !== "Admin")
      throw new BusinessError("Báo cáo đã duyệt — đã gửi yêu cầu xóa tới Leader/Admin", "DELETE_REQUESTED", 202);
    await this.repo.audit({ at: this.today(), by: user.name, action: "REPORT_DELETE_REQUESTED", dealId: report.dealId, detail: reason });
  }
}
