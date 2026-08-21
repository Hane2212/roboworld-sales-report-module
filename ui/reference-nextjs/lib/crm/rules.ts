// Luật nghiệp vụ pipeline — chạy phía server, không tin dữ liệu từ trình duyệt.
import type { Deal, Report, CrmData } from "./api";

export const STAGE_ORDER = [
  "Liên hệ mới",
  "Cơ hội",
  "Khảo sát",
  "Demo",
  "Đàm phán",
  "Đồng ý mua",
  "Win / Fail",
];

export function requiredReportFor(stage: string, settings: CrmData["settings"]): string | null {
  const found = settings.stages.find((s) => s[0] === stage);
  if (!found || !found[1] || found[1] === "Không") return null;
  return found[1];
}

function hasReport(deal: Deal, reports: Report[], loai: string): boolean {
  return reports.some(
    (r) => r.maDeal === deal.ma && r.loai === loai && r.trangThai !== "Từ chối"
  );
}

/** Trả về thông báo lỗi (tiếng Việt) nếu KHÔNG được phép chuyển, null nếu hợp lệ. */
export function validateStageChange(
  deal: Deal,
  newStage: string,
  reports: Report[],
  settings: CrmData["settings"]
): string | null {
  const from = STAGE_ORDER.indexOf(deal.stage);
  const to = STAGE_ORDER.indexOf(newStage);
  if (to < 0) return "Stage không hợp lệ";
  if (newStage === deal.stage) return "Deal đang ở stage này rồi";
  if (to < from) return null; // lùi stage: cho phép (sửa nhầm lẫn)

  // Nhảy cóc Khảo sát → Đàm phán: chỉ qua luồng Skip Demo đã được duyệt
  if (deal.stage === "Khảo sát" && newStage === "Đàm phán") {
    if (deal.skip !== "Có")
      return "Không được bỏ qua Demo. Hãy bấm 'Xin bỏ qua Demo' (chọn lý do + nộp BC Skip Demo) hoặc chuyển sang Demo.";
    if (deal.duyetSkip !== "Đã duyệt")
      return deal.duyetSkip === "Từ chối"
        ? "Leader đã TỪ CHỐI Skip Demo — deal phải đi qua bước Demo."
        : "Skip Demo đang chờ Leader duyệt — chưa thể chuyển sang Đàm phán.";
    if (!hasReport(deal, reports, "BC Skip Demo"))
      return "Thiếu báo cáo giải trình Skip Demo — hãy nộp 'BC Skip Demo' trước.";
  } else if (to > from + 1) {
    return `Không được nhảy cóc từ "${deal.stage}" sang "${newStage}" — chuyển từng bước theo pipeline.`;
  }

  // Rời một stage có báo cáo bắt buộc → báo cáo đó phải đã nộp
  const need = requiredReportFor(deal.stage, settings);
  if (need && !hasReport(deal, reports, need)) {
    return `Chưa nộp "${need}" cho deal này — nộp báo cáo trước khi chuyển stage.`;
  }
  return null;
}

/** Sinh mã deal tự động theo khu vực: MB-001, MT-002, MN-010, TQ-001... */
export function nextDealCode(khuVuc: string, deals: Deal[]): string {
  const prefixMap: Record<string, string> = {
    "Miền Bắc": "MB",
    "Miền Trung": "MT",
    "Miền Nam": "MN",
    "Toàn Quốc": "TQ",
  };
  const prefix = prefixMap[khuVuc] || "DL";
  let max = 0;
  for (const d of deals) {
    const m = d.ma.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
