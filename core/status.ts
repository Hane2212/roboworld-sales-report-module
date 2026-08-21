/**
 * Tính trạng thái "sức khỏe" của deal: số ngày ở stage, số ngày không hoạt động,
 * mức nhắc (1/2/3), Deal Health (xanh/vàng/đỏ), báo cáo bắt buộc đã nộp chưa.
 * Thuần hàm — không gọi database. CRM gọi hàm này khi render danh sách / dashboard / cron nhắc.
 */
import { daysBetween } from "./dates.ts";
import { hasReport, requiredReportFor } from "./rules.ts";
import type { Deal, Report, ReportType, Settings } from "./types.ts";

export type Health = "green" | "yellow" | "red" | null;
export type ReminderLevel = 0 | 1 | 2 | 3;

export interface DealStatus {
  daysInStage: number;
  daysInactive: number;
  stageOverdue: boolean;
  requiredReport: ReportType | null;
  /** true = đã nộp, false = THIẾU, null = stage này không cần báo cáo */
  requiredReportSubmitted: boolean | null;
  reminderLevel: ReminderLevel;
  reminderLabel: string; // "" | "🟡 Nhắc Sales" | "🟠 Nhắc lần 2" | "🔴 Báo Leader"
  health: Health;
  healthLabel: string; // "🟢 Ổn" | "🟡 Chú ý" | "🔴 Rủi ro" | ""
  closed: boolean;
}

export function computeDealStatus(deal: Deal, reports: Report[], settings: Settings, today: string): DealStatus {
  const [l1, l2, l3] = settings.remindDays;
  const daysInStage = daysBetween(deal.stageEnteredAt, today);
  const daysInactive = daysBetween(deal.lastActivityAt, today);
  const requiredReport = requiredReportFor(deal.stage, settings);
  const requiredReportSubmitted = requiredReport ? hasReport(deal, reports, requiredReport) : null;
  const missing = requiredReportSubmitted === false;
  const closed = deal.outcome !== null;

  if (closed) {
    return {
      daysInStage, daysInactive, stageOverdue: false, requiredReport, requiredReportSubmitted,
      reminderLevel: 0, reminderLabel: "", health: null, healthLabel: "", closed: true,
    };
  }

  let reminderLevel: ReminderLevel = 0;
  if (daysInactive >= l3) reminderLevel = 3;
  else if (daysInactive >= l2) reminderLevel = 2;
  else if (daysInactive >= l1) reminderLevel = 1;
  const reminderLabel = ["", "🟡 Nhắc Sales", "🟠 Nhắc lần 2", "🔴 Báo Leader"][reminderLevel];

  const stageOverdue = daysInStage >= settings.stageOverdueDays;

  let health: Health = "green";
  if (daysInactive >= l3 || (missing && daysInactive >= l2) || stageOverdue) health = "red";
  else if (daysInactive >= l1 || missing) health = "yellow";
  const healthLabel = { green: "🟢 Ổn", yellow: "🟡 Chú ý", red: "🔴 Rủi ro" }[health];

  return {
    daysInStage, daysInactive, stageOverdue, requiredReport, requiredReportSubmitted,
    reminderLevel, reminderLabel, health, healthLabel, closed: false,
  };
}

/** Nội dung nhắc nhở gửi cho Sales (Zalo/email/notification) — theo mẫu đã chốt. */
export function buildReminderMessage(
  salesName: string,
  items: Array<{ deal: Deal; status: DealStatus; lastReportAt?: string | null }>,
  today: string
): string {
  const lines = [`⚠️ ${salesName} ơi, bạn có ${items.length} deal chưa được cập nhật.`, ""];
  for (const { deal, status, lastReportAt } of items) {
    lines.push(`Deal ${deal.customerName} (${deal.id}):`);
    lines.push(`  • Stage: ${deal.stage}`);
    lines.push(`  • Hoạt động gần nhất: ${status.daysInactive} ngày trước`);
    if (lastReportAt !== undefined)
      lines.push(`  • Báo cáo gần nhất: ${lastReportAt ? `${daysBetween(lastReportAt, today)} ngày trước` : "chưa có"}`);
    if (status.requiredReportSubmitted === false) lines.push(`  • ⛔ THIẾU ${status.requiredReport}`);
    lines.push("");
  }
  lines.push("Vui lòng cập nhật để đảm bảo deal không bị bỏ quên. 👉 Cập nhật Deal");
  return lines.join("\n");
}
