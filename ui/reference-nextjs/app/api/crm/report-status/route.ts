import { NextResponse } from "next/server";
import { sheetApi, getCrmData } from "@/lib/crm/api";
import { currentUser, isLeader } from "@/lib/crm/session";

// Leader duyệt / từ chối báo cáo
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  if (!isLeader(user))
    return NextResponse.json({ ok: false, error: "Chỉ Leader được duyệt báo cáo" }, { status: 403 });
  try {
    const body = await req.json();
    const { reports } = await getCrmData();
    const rp = reports.find((r) => r.row === Number(body.row) && r.maDeal === body.ma);
    if (!rp) return NextResponse.json({ ok: false, error: "Không tìm thấy báo cáo — tải lại trang" }, { status: 404 });
    if (rp.sales === user.name && user.role !== "Admin")
      return NextResponse.json({ ok: false, error: "Không được tự duyệt báo cáo của chính mình" }, { status: 403 });
    const trangThai = body.trangThai === "Đã duyệt" ? "Đã duyệt" : "Từ chối";
    if (trangThai === "Từ chối" && !String(body.lyDo || "").trim())
      return NextResponse.json({ ok: false, error: "Từ chối phải ghi lý do để Sales sửa lại" }, { status: 422 });
    await sheetApi("updateReport", {
      row: rp.row, maDeal: rp.maDeal, trangThai,
      nguoiDuyet: user.name, lyDo: body.lyDo || rp.ghiChu,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lỗi duyệt báo cáo" }, { status: 500 });
  }
}

export const maxDuration = 30;
