import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser, isLeader } from "@/lib/crm/session";
import { crmConfigured, getCrmData } from "@/lib/crm/api";
import DealActions from "@/components/crm/DealActions";

export const dynamic = "force-dynamic";

export default async function DealPage({
  params,
}: {
  params: Promise<{ ma: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/crm/login");
  if (!crmConfigured()) redirect("/crm");

  const { ma } = await params;
  const maDeal = decodeURIComponent(ma);
  const { deals, reports, settings } = await getCrmData();
  const deal = deals.find((d) => d.ma === maDeal);
  if (!deal) notFound();

  const dealReports = reports.filter((r) => r.maDeal === deal.ma);
  const lead = isLeader(user);
  const canLead = user.role === "Admin" || (lead && (deal.khuVuc === user.region || user.region === "Toàn Quốc"));

  return (
    <div>
      <Link href="/crm" className="text-sm text-mute hover:text-brand">← Bảng điều khiển</Link>
      <div className="mt-3 rounded-2xl border border-black/8 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-strong">{deal.khach}</h1>
            <p className="mt-1 text-sm text-mute">
              {deal.ma} · {deal.khuVuc} · Sales: {deal.sales} · Tạo: {deal.ngayTao}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="text-lg">{deal.health}</p>
            {deal.mucNhac && <p className="font-semibold">{deal.mucNhac}</p>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-mute">Stage</p><p className="font-bold text-strong">{deal.stage}</p></div>
          <div><p className="text-xs text-mute">Ở stage</p><p className="font-bold text-strong">{deal.soNgayStage || "—"} ngày</p></div>
          <div><p className="text-xs text-mute">HĐ gần nhất</p><p className="font-bold text-strong">{deal.hoatDong || "—"}</p></div>
          <div>
            <p className="text-xs text-mute">Báo cáo bắt buộc</p>
            <p className={`font-bold ${deal.daNopBC === "THIẾU" ? "text-brand" : "text-strong"}`}>
              {deal.bcBatBuoc === "Không" ? "Không cần" : `${deal.bcBatBuoc} — ${deal.daNopBC}`}
            </p>
          </div>
        </div>
        {deal.skip === "Có" && (
          <p className="mt-3 rounded-xl bg-paper-soft px-4 py-2 text-sm">
            <b>Skip Demo:</b> {deal.lyDoSkip || "—"} · Trạng thái:{" "}
            <b className={deal.duyetSkip === "Đã duyệt" ? "text-green-600" : deal.duyetSkip === "Từ chối" ? "text-brand" : "text-orange-600"}>
              {deal.duyetSkip || "Chờ duyệt"}
            </b>
          </p>
        )}
        {deal.ghiChu && <p className="mt-3 text-sm text-mute">📝 {deal.ghiChu}</p>}
      </div>

      <DealActions
        deal={deal}
        reports={dealReports}
        settings={settings}
        canLead={canLead}
        userName={user.name}
        isAdmin={user.role === "Admin"}
      />
    </div>
  );
}

export const maxDuration = 30;
