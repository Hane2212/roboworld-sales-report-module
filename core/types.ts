/**
 * Kiểu dữ liệu cốt lõi của Module Quản lý Báo cáo Sales.
 * Độc lập hoàn toàn với database / framework — CRM chỉ cần map dữ liệu của mình sang các kiểu này.
 * Mọi ngày tháng dùng chuỗi ISO "YYYY-MM-DD".
 */

export const STAGES = [
  "Liên hệ mới",
  "Cơ hội",
  "Khảo sát",
  "Demo",
  "Đàm phán",
  "Đồng ý mua",
  "Win / Fail",
] as const;
export type Stage = (typeof STAGES)[number];

export const REPORT_TYPES = [
  "BC Khảo sát",
  "BC Demo",
  "BC Skip Demo",
  "BC Đàm phán",
  "BC Follow-up",
  "Khác",
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportStatus = "Nháp" | "Đã nộp" | "Đã duyệt" | "Từ chối";
export type SkipApproval = "Chờ duyệt" | "Đã duyệt" | "Từ chối";
export type Outcome = "Win" | "Fail";
export type Role = "Sales" | "Leader" | "Admin";

export interface User {
  id: string;
  name: string;
  region: string; // "Miền Bắc" | "Miền Trung" | "Miền Nam" | "Toàn Quốc" | ...
  role: Role;
}

export interface Deal {
  id: string; // mã deal hiển thị, vd "MB-001" — hoặc id của CRM
  customerName: string;
  region: string;
  salesId: string;
  salesName: string;
  stage: Stage;
  stageEnteredAt: string;
  lastActivityAt: string;
  nextFollowUpAt: string | null;
  skipDemoRequested: boolean;
  skipDemoReason: string | null;
  skipDemoApproval: SkipApproval | null;
  outcome: Outcome | null;
  note: string;
  createdAt: string;
}

export interface Report {
  id: string;
  dealId: string;
  salesId: string;
  salesName: string;
  type: ReportType;
  stage: Stage;
  fileUrl: string;
  version: number;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewNote: string;
  submittedAt: string;
}

export interface StageHistory {
  id?: string;
  dealId: string;
  salesName: string;
  fromStage: Stage | "—";
  toStage: string;
  reason: string;
  changedAt: string;
  changedBy: string;
}

export interface Settings {
  /** Ngưỡng ngày không hoạt động: [nhắc lần 1, nhắc lần 2, báo Leader] */
  remindDays: [number, number, number];
  /** Deal ở một stage quá số ngày này → cảnh báo stage quá hạn */
  stageOverdueDays: number;
  /** Stage nào bắt buộc loại báo cáo nào khi RỜI stage đó. null = không cần. */
  requiredReports: Partial<Record<Stage, ReportType | null>>;
  /** Skip Demo có cần Leader duyệt không (mặc định: có) */
  requireLeaderApprovalForSkip: boolean;
  skipReasons: string[];
  regions: string[];
}

/** Cấu hình mặc định — LUẬT ĐÃ CHỐT: chỉ mốc Demo → Đàm phán bắt buộc báo cáo. */
export const DEFAULT_SETTINGS: Settings = {
  remindDays: [3, 5, 7],
  stageOverdueDays: 14,
  requiredReports: {
    "Liên hệ mới": null,
    "Cơ hội": null,
    "Khảo sát": null,
    Demo: "BC Demo",
    "Đàm phán": null,
    "Đồng ý mua": null,
    "Win / Fail": null,
  },
  requireLeaderApprovalForSkip: true,
  skipReasons: [
    "Khách đã có trải nghiệm robot",
    "Khách đã demo ở địa điểm khác",
    "Khách không cần demo",
    "Khách yêu cầu báo giá trực tiếp",
    "Khách đã hiểu rõ sản phẩm",
    "Lý do khác",
  ],
  regions: ["Miền Bắc", "Miền Trung", "Miền Nam", "Toàn Quốc"],
};

/** Lỗi nghiệp vụ — message bằng tiếng Việt, hiển thị thẳng cho người dùng được. */
export class BusinessError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(message: string, code: string, httpStatus: number = 422) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
