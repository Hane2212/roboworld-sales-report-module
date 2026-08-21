/**
 * LUẬT PIPELINE — nguồn sự thật duy nhất. Chạy phía server, không tin dữ liệu từ trình duyệt.
 * Xem docs/BUSINESS-RULES.md để đọc bản tiếng Việt dành cho người không kỹ thuật.
 */
import { STAGES, BusinessError } from "./types.ts";
import type { Deal, Report, ReportType, Settings, Stage, User } from "./types.ts";

export function stageIndex(stage: string): number {
  return STAGES.indexOf(stage as Stage);
}

export function requiredReportFor(stage: Stage, settings: Settings): ReportType | null {
  return settings.requiredReports[stage] ?? null;
}

/** Deal đã có báo cáo loại này chưa (không tính báo cáo bị Từ chối). */
export function hasReport(deal: Deal, reports: Report[], type: ReportType): boolean {
  return reports.some((r) => r.dealId === deal.id && r.type === type && r.status !== "Từ chối");
}

/**
 * Kiểm tra được phép chuyển stage không. Ném BusinessError với thông báo tiếng Việt nếu không.
 *
 * Luật:
 *  1. Không nhảy cóc quá 1 bước về phía trước.
 *  2. Rời một stage có báo cáo bắt buộc (mặc định chỉ Demo → BC Demo) thì báo cáo đó phải đã nộp.
 *  3. Khảo sát → Đàm phán (bỏ qua Demo) CHỈ khi: đã xin Skip Demo + Leader đã duyệt
 *     (nếu bật requireLeaderApprovalForSkip) + đã nộp BC Skip Demo.
 *  4. Lùi stage: cho phép (sửa nhầm), ghi lịch sử.
 */
export function assertStageChange(
  deal: Deal,
  newStage: Stage,
  reports: Report[],
  settings: Settings
): void {
  const from = stageIndex(deal.stage);
  const to = stageIndex(newStage);
  if (to < 0) throw new BusinessError("Stage không hợp lệ", "INVALID_STAGE");
  if (deal.outcome) throw new BusinessError("Deal đã đóng (Win/Fail) — không chuyển stage được", "DEAL_CLOSED");
  if (newStage === deal.stage) throw new BusinessError("Deal đang ở stage này rồi", "SAME_STAGE");
  if (to < from) return; // lùi stage

  if (deal.stage === "Khảo sát" && newStage === "Đàm phán") {
    if (!deal.skipDemoRequested)
      throw new BusinessError(
        "Không được bỏ qua Demo. Hãy gửi yêu cầu 'Bỏ qua Demo' (chọn lý do + nộp BC Skip Demo) hoặc chuyển sang Demo.",
        "SKIP_NOT_REQUESTED"
      );
    if (settings.requireLeaderApprovalForSkip && deal.skipDemoApproval !== "Đã duyệt")
      throw new BusinessError(
        deal.skipDemoApproval === "Từ chối"
          ? "Leader đã TỪ CHỐI Skip Demo — deal phải đi qua bước Demo."
          : "Skip Demo đang chờ Leader duyệt — chưa thể chuyển sang Đàm phán.",
        "SKIP_NOT_APPROVED"
      );
    if (!hasReport(deal, reports, "BC Skip Demo"))
      throw new BusinessError("Thiếu báo cáo giải trình Skip Demo — nộp 'BC Skip Demo' trước.", "SKIP_REPORT_MISSING");
    return; // luồng skip hợp lệ — không xét báo cáo của stage Khảo sát
  }

  if (to > from + 1)
    throw new BusinessError(
      `Không được nhảy cóc từ "${deal.stage}" sang "${newStage}" — chuyển từng bước theo pipeline.`,
      "STAGE_SKIP"
    );

  const need = requiredReportFor(deal.stage, settings);
  if (need && !hasReport(deal, reports, need))
    throw new BusinessError(
      `Chưa nộp "${need}" cho deal này — nộp báo cáo trước khi chuyển stage.`,
      "REPORT_MISSING"
    );
}

export function assertSkipRequest(deal: Deal, reason: string, explanation: string, settings: Settings): void {
  if (deal.stage !== "Khảo sát")
    throw new BusinessError("Chỉ xin Skip Demo khi deal đang ở Khảo sát", "SKIP_WRONG_STAGE");
  if (!settings.skipReasons.includes(reason))
    throw new BusinessError("Chọn lý do Skip Demo trong danh sách", "SKIP_REASON_INVALID");
  if (reason.startsWith("Lý do khác") && !explanation.trim())
    throw new BusinessError("Chọn 'Lý do khác' thì phải ghi rõ giải trình", "SKIP_EXPLANATION_REQUIRED");
}

// ─── Phân quyền ───
export function isLeader(user: User): boolean {
  return user.role === "Leader" || user.role === "Admin";
}

/** Leader chỉ quản deal trong khu vực mình; Admin / Leader "Toàn Quốc" thấy tất cả. */
export function canLeadDeal(user: User, deal: Deal): boolean {
  if (user.role === "Admin") return true;
  if (user.role !== "Leader") return false;
  return user.region === "Toàn Quốc" || deal.region === user.region;
}

export function canEditDeal(user: User, deal: Deal): boolean {
  return deal.salesId === user.id || canLeadDeal(user, deal);
}

export function canViewDeal(user: User, deal: Deal): boolean {
  return canEditDeal(user, deal);
}

export function assertCanReview(user: User, report: Report, deal: Deal): void {
  if (!canLeadDeal(user, deal)) throw new BusinessError("Chỉ Leader phụ trách khu vực mới được duyệt", "NOT_LEADER", 403);
  if (report.salesId === user.id && user.role !== "Admin")
    throw new BusinessError("Không được tự duyệt báo cáo của chính mình", "SELF_REVIEW", 403);
}

/** Sinh mã deal theo khu vực: MB-001, MT-002, MN-010, TQ-001 */
export function nextDealCode(region: string, existingIds: string[]): string {
  const map: Record<string, string> = { "Miền Bắc": "MB", "Miền Trung": "MT", "Miền Nam": "MN", "Toàn Quốc": "TQ" };
  const prefix = map[region] || "DL";
  let max = 0;
  for (const id of existingIds) {
    const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
