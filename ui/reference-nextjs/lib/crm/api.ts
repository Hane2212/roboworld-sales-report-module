// Gọi sang "cầu nối" Apps Script trên Google Sheets. Chỉ chạy phía server.

export interface SheetUser {
  name: string;
  region: string;
  role: "Sales" | "Leader" | "Admin" | string;
}

export interface RawRow {
  row: number;
  v: string[];
}

export interface CrmData {
  deals: RawRow[];
  reports: RawRow[];
  settings: {
    nguong: number[]; // [nhắc1, nhắc2, báo leader, stage quá hạn]
    stages: string[][]; // [stage, báo cáo bắt buộc]
    loaiBC: string[];
    khuVuc: string[];
    lyDoSkip: string[];
  };
  roster: SheetUser[];
}

export function crmConfigured(): boolean {
  return Boolean(process.env.CRM_API_URL && process.env.CRM_API_TOKEN);
}

export async function sheetApi<T = Record<string, unknown>>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const url = process.env.CRM_API_URL;
  const token = process.env.CRM_API_TOKEN;
  if (!url || !token) throw new Error("CRM chưa được cấu hình (thiếu CRM_API_URL)");
  const body = JSON.stringify({ token, action, payload });

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // Apps Script trả 302 sang script.googleusercontent.com — tự xử lý để tránh lỗi ngẫu nhiên
      let res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body,
        cache: "no-store",
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new Error("Cầu nối chuyển hướng không có địa chỉ");
        res = await fetch(loc, { method: "GET", cache: "no-store", redirect: "follow" });
      }
      if (!res.ok) throw new Error(`Cầu nối trả về HTTP ${res.status}`);
      const text = await res.text();
      let data: { ok: boolean; error?: string } & T;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Cầu nối trả về dữ liệu không phải JSON");
      }
      if (!data.ok) throw new Error(data.error || "Lỗi không xác định từ Google Sheets");
      // Phòng trường hợp redirect rơi vào doGet (thiếu dữ liệu) → coi là lỗi để thử lại
      if (action === "getData" && !Array.isArray((data as unknown as { deals?: unknown }).deals)) {
        throw new Error("Cầu nối trả về thiếu dữ liệu");
      }
      if (action === "names" && !Array.isArray((data as unknown as { names?: unknown }).names)) {
        throw new Error("Cầu nối trả về thiếu danh sách");
      }
      return data;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      // Lỗi nghiệp vụ (sai PIN, không tìm thấy deal...) thì không thử lại
      const msg = lastErr.message;
      const transient = /HTTP|JSON|thiếu dữ liệu|thiếu danh sách|chuyển hướng|fetch failed|ECONN|timeout/i.test(msg);
      if (!transient || attempt === 3) throw lastErr;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  throw lastErr || new Error("Không gọi được cầu nối");
}

// ─── Chuyển dòng DEALS thành object dễ dùng ───
export interface Deal {
  row: number;
  ma: string;
  ngayTao: string;
  khach: string;
  khuVuc: string;
  sales: string;
  stage: string;
  ngayVaoStage: string;
  soNgayStage: string;
  hoatDong: string;
  ngayKhongHD: string;
  followUp: string;
  skip: string;
  lyDoSkip: string;
  duyetSkip: string;
  bcBatBuoc: string;
  daNopBC: string;
  mucNhac: string;
  health: string;
  ketQua: string;
  ghiChu: string;
}

export function parseDeal(r: RawRow): Deal {
  const v = r.v;
  return {
    row: r.row,
    ma: v[0], ngayTao: v[1], khach: v[2], khuVuc: v[3], sales: v[4],
    stage: v[5], ngayVaoStage: v[6], soNgayStage: v[7], hoatDong: v[8],
    ngayKhongHD: v[9], followUp: v[10], skip: v[11], lyDoSkip: v[12],
    duyetSkip: v[13], bcBatBuoc: v[14], daNopBC: v[15], mucNhac: v[16],
    health: v[17], ketQua: v[18], ghiChu: v[19],
  };
}

export interface Report {
  row: number;
  ngayNop: string;
  maDeal: string;
  khach: string;
  sales: string;
  khuVuc: string;
  loai: string;
  stage: string;
  link: string;
  phienBan: string;
  trangThai: string;
  nguoiDuyet: string;
  ghiChu: string;
}

export function parseReport(r: RawRow): Report {
  const v = r.v;
  return {
    row: r.row,
    ngayNop: v[0], maDeal: v[1], khach: v[2], sales: v[3], khuVuc: v[4],
    loai: v[5], stage: v[6], link: v[7], phienBan: v[8], trangThai: v[9],
    nguoiDuyet: v[10], ghiChu: v[11],
  };
}

export async function getCrmData(): Promise<{
  deals: Deal[];
  reports: Report[];
  settings: CrmData["settings"];
  roster: SheetUser[];
}> {
  const data = await sheetApi<CrmData>("getData");
  return {
    deals: data.deals.map(parseDeal),
    reports: data.reports.map(parseReport),
    settings: data.settings,
    roster: data.roster,
  };
}

export function todayVN(): string {
  const now = new Date();
  const vn = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const dd = String(vn.getDate()).padStart(2, "0");
  const mm = String(vn.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${vn.getFullYear()}`;
}
