import { NextResponse } from "next/server";
import { sheetApi, getCrmData, todayVN } from "@/lib/crm/api";
import { currentUser } from "@/lib/crm/session";

// Nộp báo cáo (link file trên Google Drive)
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const body = await req.json();
    const { deals, reports, settings } = await getCrmData();
    const deal = deals.find((d) => d.ma === body.ma);
    if (!deal) return NextResponse.json({ ok: false, error: "Không tìm thấy deal" }, { status: 404 });
    const loai = String(body.loai || "");
    if (!settings.loaiBC.includes(loai))
      return NextResponse.json({ ok: false, error: "Chọn loại báo cáo" }, { status: 422 });
    const link = String(body.link || "").trim();
    if (!/^https?:\/\//.test(link))
      return NextResponse.json({ ok: false, error: "Dán link file trên Google Drive (bắt đầu bằng https://)" }, { status: 422 });
    const phienBan = reports.filter((r) => r.maDeal === deal.ma && r.loai === loai).length + 1;
    await sheetApi("addReport", {
      ngayNop: todayVN(), maDeal: deal.ma, khach: deal.khach, sales: user.name,
      khuVuc: deal.khuVuc, loai, stage: deal.stage, link,
      phienBan, trangThai: "Đã nộp", nguoiDuyet: "", ghiChu: body.ghiChu || "",
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lỗi nộp báo cáo" }, { status: 500 });
  }
}

export const maxDuration = 30;
