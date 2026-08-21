/**
 * Thống kê cho Leader Dashboard: compliance theo sales / khu vực, ma trận báo cáo theo tháng,
 * danh sách "Attention Required". Thuần hàm.
 *
 * CÔNG THỨC COMPLIANCE (đã chốt): chỉ tính báo cáo BẮT BUỘC.
 *   Compliance = Số báo cáo bắt buộc đã nộp / Tổng số báo cáo bắt buộc × 100
 * "Bắt buộc" = deal đang mở ở stage có yêu cầu báo cáo (mặc định: Demo)
 *   + deal đã đi qua mốc đó (có lịch sử rời stage Demo) → cũng tính là từng bắt buộc.
 * Bản đơn giản ở đây tính trên stage hiện tại + báo cáo đã tồn tại; CRM có lịch sử stage
 * có thể dùng complianceWithHistory() để chính xác hơn.
 */
import { computeDealStatus } from "./status.ts";
import type { Deal, Report, Settings, StageHistory, User } from "./types.ts";

export interface ComplianceRow {
  key: string; // tên sales hoặc khu vực
  region?: string;
  openDeals: number;
  required: number;
  submitted: number;
  missing: number;
  rate: number | null; // 0..1, null nếu required = 0
  needReminder: number; // deal đang ở mức nhắc ≥ 1
  atRisk: number; // deal 🔴
}

function rowsBy(
  keyOf: (d: Deal) => string,
  deals: Deal[],
  reports: Report[],
  settings: Settings,
  today: string,
  keys?: string[]
): ComplianceRow[] {
  const map = new Map<string, ComplianceRow>();
  const ensure = (k: string, region?: string) => {
    if (!map.has(k)) map.set(k, { key: k, region, openDeals: 0, required: 0, submitted: 0, missing: 0, rate: null, needReminder: 0, atRisk: 0 });
    return map.get(k)!;
  };
  for (const k of keys || []) ensure(k);
  for (const d of deals) {
    const row = ensure(keyOf(d), d.region);
    const st = computeDealStatus(d, reports, settings, today);
    if (st.closed) continue;
    row.openDeals++;
    if (st.requiredReportSubmitted !== null) {
      row.required++;
      if (st.requiredReportSubmitted) row.submitted++;
      else row.missing++;
    }
    if (st.reminderLevel > 0) row.needReminder++;
    if (st.health === "red") row.atRisk++;
  }
  for (const r of map.values()) r.rate = r.required ? r.submitted / r.required : null;
  return [...map.values()];
}

export function complianceBySales(deals: Deal[], reports: Report[], settings: Settings, today: string, roster?: User[]): ComplianceRow[] {
  const rows = rowsBy((d) => d.salesName, deals, reports, settings, today, roster?.map((u) => u.name));
  if (roster) for (const r of rows) r.region = roster.find((u) => u.name === r.key)?.region ?? r.region;
  return rows;
}

export function complianceByRegion(deals: Deal[], reports: Report[], settings: Settings, today: string): ComplianceRow[] {
  return rowsBy((d) => d.region, deals, reports, settings, today, settings.regions);
}

/**
 * Compliance chính xác theo lịch sử: mỗi lần một deal RỜI stage bắt buộc (vd Demo) = 1 lần bắt buộc;
 * có báo cáo loại tương ứng nộp trước/đúng ngày rời = đạt. Dùng khi CRM đã có bảng stage_history.
 */
export function complianceWithHistory(
  history: StageHistory[],
  reports: Report[],
  settings: Settings
): Map<string, { required: number; submitted: number }> {
  const out = new Map<string, { required: number; submitted: number }>();
  for (const h of history) {
    const need = settings.requiredReports[h.fromStage as keyof Settings["requiredReports"]];
    if (!need) continue;
    const row = out.get(h.salesName) || { required: 0, submitted: 0 };
    row.required++;
    const ok = reports.some((r) => r.dealId === h.dealId && r.type === need && r.status !== "Từ chối" && r.submittedAt <= h.changedAt);
    if (ok) row.submitted++;
    out.set(h.salesName, row);
  }
  return out;
}

/** Ma trận số báo cáo theo tháng: { [salesName]: number[12] } cho 1 năm. */
export function monthlyReportMatrix(reports: Report[], year: number, names?: string[]): Record<string, number[]> {
  const m: Record<string, number[]> = {};
  for (const n of names || []) m[n] = Array(12).fill(0);
  for (const r of reports) {
    if (+r.submittedAt.slice(0, 4) !== year) continue;
    const month = +r.submittedAt.slice(5, 7) - 1;
    (m[r.salesName] ||= Array(12).fill(0))[month]++;
  }
  return m;
}

/** Dòng "Attention Required" cho Leader — management insight, không chỉ số liệu. */
export function attentionItems(deals: Deal[], reports: Report[], settings: Settings, today: string): string[] {
  const items: string[] = [];
  const open = deals.filter((d) => !d.outcome);
  const statuses = open.map((d) => ({ d, s: computeDealStatus(d, reports, settings, today) }));

  const overdue = statuses.filter((x) => x.s.reminderLevel >= 2).length;
  if (overdue) items.push(`🔴 ${overdue} deal quá hạn cập nhật (≥ ${settings.remindDays[1]} ngày).`);

  const missing = statuses.filter((x) => x.s.requiredReportSubmitted === false).length;
  if (missing) items.push(`🔴 ${missing} deal đang THIẾU báo cáo bắt buộc.`);

  const skipPending = open.filter((d) => d.skipDemoRequested && d.skipDemoApproval === "Chờ duyệt").length;
  if (skipPending) items.push(`🟡 ${skipPending} yêu cầu Skip Demo đang chờ Leader duyệt.`);

  const reportPending = reports.filter((r) => r.status === "Đã nộp").length;
  if (reportPending) items.push(`🟡 ${reportPending} báo cáo đang chờ duyệt.`);

  const stuck = statuses.filter((x) => x.d.stage === "Đàm phán" && x.s.daysInStage > settings.stageOverdueDays).length;
  if (stuck) items.push(`🟡 ${stuck} deal ở Đàm phán > ${settings.stageOverdueDays} ngày.`);

  for (const row of complianceBySales(deals, reports, settings, today)) {
    if (row.rate !== null && row.required >= 3) {
      if (row.rate < 0.7) items.push(`🔴 ${row.key} có Report Compliance ${Math.round(row.rate * 100)}% (${row.submitted}/${row.required}).`);
      else if (row.rate >= 0.95) items.push(`🟢 ${row.key} có Report Compliance ${Math.round(row.rate * 100)}%.`);
    }
  }
  return items;
}
