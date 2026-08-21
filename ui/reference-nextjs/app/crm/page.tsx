import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, isLeader } from "@/lib/crm/session";
import { crmConfigured, getCrmData, Deal } from "@/lib/crm/api";

export const dynamic = "force-dynamic";

function severity(d: Deal): number {
  if (d.ketQua) return 5;
  if (d.mucNhac.includes("🔴")) return 0;
  if (d.mucNhac.includes("🟠")) return 1;
  if (d.health.includes("🔴")) return 1;
  if (d.mucNhac.includes("🟡") || d.health.includes("🟡")) return 2;
  return 3;
}

export default async function CrmHome() {
  const user = await currentUser();
  if (!user) redirect("/crm/login");

  if (!crmConfigured()) {
    return (
      <div className="rounded-2xl border border-black/8 bg-white p-8 text-center">
        <h1 className="text-xl font-bold text-strong">⚙️ Hệ thống chưa kết nối Google Sheets</h1>
        <p className="mt-2 text-sm">Quản trị viên cần cấu hình cầu nối dữ liệu (CRM_API_URL).</p>
      </div>
    );
  }

  const { deals, reports } = await getCrmData();
  const lead = isLeader(user);
  const seeAll = user.role === "Admin" || user.region === "Toàn Quốc";
  const myDeals = deals.filter((d) =>
    lead ? (seeAll ? true : d.khuVuc === user.region) : d.sales === user.name
  );
  const open = myDeals.filter((d) => !d.ketQua);
  const canNhac = open.filter((d) => d.mucNhac !== "");
  const thieuBC = open.filter((d) => d.daNopBC === "THIẾU");
  const skipCho = myDeals.filter((d) => d.skip === "Có" && d.duyetSkip === "Chờ duyệt");
  const bcCho = reports.filter(
    (r) => r.trangThai === "Đã nộp" && (seeAll || !lead ? true : r.khuVuc === user.region)
  );

  const sorted = [...myDeals].sort((a, b) => severity(a) - severity(b));

  const chip = (label: string, n: number, tone: string) => (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-2xl font-extrabold">{n}</p>
      <p className="mt-0.5 text-xs font-semibold">{label}</p>
    </div>
  );

  return (
    <div>
      <h1 className="text-xl font-extrabold text-strong">
        {lead ? `Bảng điều khiển Leader ${seeAll ? "(toàn quốc)" : `— ${user.region}`}` : `Chào ${user.name.split(" ").pop()}!`}
      </h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {chip("Deal đang mở", open.length, "border-black/8 bg-white text-strong")}
        {chip("Cần cập nhật (bị nhắc)", canNhac.length, canNhac.length ? "border-orange-200 bg-orange-50 text-orange-700" : "border-black/8 bg-white text-strong")}
        {chip("Thiếu báo cáo", thieuBC.length, thieuBC.length ? "border-red-200 bg-red-50 text-brand" : "border-black/8 bg-white text-strong")}
        {lead
          ? chip("Chờ duyệt (BC + Skip)", bcCho.length + skipCho.length, bcCho.length + skipCho.length ? "border-blue-200 bg-blue-50 text-blue-700" : "border-black/8 bg-white text-strong")
          : chip("Skip Demo chờ duyệt", skipCho.length, skipCho.length ? "border-blue-200 bg-blue-50 text-blue-700" : "border-black/8 bg-white text-strong")}
      </div>

      {lead && (skipCho.length > 0 || bcCho.length > 0) && (
        <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="font-bold text-blue-800">🔔 Chờ Leader xử lý</h2>
          <ul className="mt-2 space-y-1 text-sm text-blue-900">
            {skipCho.map((d) => (
              <li key={d.ma}>
                <Link href={`/crm/deal/${d.ma}`} className="underline">
                  Skip Demo: {d.ma} — {d.khach} ({d.sales})
                </Link>
              </li>
            ))}
            {bcCho.map((r) => (
              <li key={`${r.row}`}>
                <Link href={`/crm/deal/${r.maDeal}`} className="underline">
                  Duyệt {r.loai}: {r.maDeal} — {r.khach} ({r.sales})
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-bold text-strong">{lead ? "Tất cả deal" : "Deal của tôi"} ({myDeals.length})</h2>
        <Link href="/crm/new" className="text-sm font-bold text-brand hover:underline">+ Thêm deal</Link>
      </div>

      <div className="mt-3 space-y-3">
        {sorted.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/15 bg-white p-6 text-center text-sm text-mute">
            Chưa có deal nào. Bấm &ldquo;+ Thêm deal&rdquo; để bắt đầu.
          </p>
        )}
        {sorted.map((d) => (
          <Link
            key={d.ma}
            href={`/crm/deal/${d.ma}`}
            className="block rounded-2xl border border-black/8 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-bold text-strong">
                  {d.khach} {d.ketQua && <span className={d.ketQua === "Win" ? "text-green-600" : "text-mute"}>· {d.ketQua}</span>}
                </p>
                <p className="mt-0.5 text-xs text-mute">
                  {d.ma} · {d.stage} ({d.soNgayStage} ngày){lead ? ` · ${d.sales}` : ""} · HĐ gần nhất: {d.hoatDong || "—"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs">
                <p>{d.health}</p>
                {d.mucNhac && <p className="mt-1 font-semibold">{d.mucNhac}</p>}
                {d.daNopBC === "THIẾU" && (
                  <p className="mt-1 font-bold text-brand">THIẾU {d.bcBatBuoc}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export const maxDuration = 30;
