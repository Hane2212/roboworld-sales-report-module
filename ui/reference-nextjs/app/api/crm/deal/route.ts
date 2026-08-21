import { NextResponse } from "next/server";
import { sheetApi, getCrmData, todayVN } from "@/lib/crm/api";
import { currentUser, isLeader } from "@/lib/crm/session";
import { nextDealCode, STAGE_ORDER } from "@/lib/crm/rules";

// Tạo deal mới
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const body = await req.json();
    const khach = String(body.khach || "").trim();
    const khuVuc = String(body.khuVuc || user.region).trim();
    const stage = STAGE_ORDER.includes(body.stage) ? body.stage : "Liên hệ mới";
    const sales = isLeader(user) && body.sales ? String(body.sales) : user.name;
    if (!khach) return NextResponse.json({ ok: false, error: "Nhập tên khách hàng" }, { status: 400 });

    const { deals } = await getCrmData();
    const ma = nextDealCode(khuVuc, deals);
    const today = todayVN();
    await sheetApi("addDeal", {
      maDeal: ma, ngayTao: today, khach, khuVuc, sales,
      stage, ngayVaoStage: today, hoatDong: today,
      followUp: body.followUp || "", ghiChu: body.ghiChu || "",
    });
    await sheetApi("addHistory", {
      ngay: today, maDeal: ma, sales, tuStage: "—", sangStage: stage, lyDo: "Tạo deal mới",
    });
    return NextResponse.json({ ok: true, ma });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lỗi tạo deal" }, { status: 500 });
  }
}

export const maxDuration = 30;
