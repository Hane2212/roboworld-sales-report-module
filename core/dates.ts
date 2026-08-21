/** Tiện ích ngày tháng — chỉ dùng chuỗi ISO "YYYY-MM-DD", múi giờ Việt Nam. */

export function todayISO(now: Date = new Date()): string {
  const vn = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  return toISO(vn);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Số ngày từ `from` đến `to` (to - from). Thiếu dữ liệu → 0. */
export function daysBetween(from: string | null | undefined, to: string): number {
  if (!from) return 0;
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** "21/08/2026" ↔ "2026-08-21" — tiện khi CRM đang lưu dd/mm/yyyy */
export function fromVN(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
export function toVN(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
