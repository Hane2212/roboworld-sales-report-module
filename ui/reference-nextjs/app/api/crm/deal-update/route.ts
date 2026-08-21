import { NextResponse } from "next/server";
import { sheetApi, getCrmData, todayVN } from "@/lib/crm/api";
import { currentUser, isLeader } from "@/lib/crm/session";
import { validateStageChange } from "@/lib/crm/rules";

/**
 * Mọi thao tác trên 1 deal. body: { ma, op, ... }
 * op: "activity" | "stage" | "skip-request" | "skip-decide" | "close"
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const body = await req.json();
    const { deals, reports, settings } = await getCrmData();
    const deal = deals.find((d) => d.ma === body.ma);
    if (!deal) return NextResponse.json({ ok: false, error: "Không tìm thấy deal" }, { status: 404 });

    const owns = deal.sales === user.name;
    const leads = user.role === "Admin" || (user.role === "Leader" && (deal.khuVuc === user.region || user.region === "Toàn Quốc"));
    if (!owns && !leads)
      return NextResponse.json({ ok: false, error: "Bạn không phụ trách deal này" }, { status: 403 });

    const today = todayVN();

    if (body.op === "activity") {
      const fields: Record<string, string> = { hoatDong: today };
      if (body.followUp) fields.followUp = String(body.followUp);
      if (body.ghiChu !== undefined) fields.ghiChu = String(body.ghiChu);
      await sheetApi("updateDeal", { maDeal: deal.ma, fields });
      return NextResponse.json({ ok: true });
    }

    if (body.op === "stage") {
      const err = validateStageChange(deal, body.stage, reports, settings);
      if (err) return NextResponse.json({ ok: false, error: err }, { status: 422 });
      await sheetApi("updateDeal", {
        maDeal: deal.ma,
        fields: { stage: body.stage, ngayVaoStage: today, hoatDong: today },
      });
      await sheetApi("addHistory", {
        ngay: today, maDeal: deal.ma, sales: deal.sales,
        tuStage: deal.stage, sangStage: body.stage,
        lyDo: deal.skip === "Có" && deal.stage === "Khảo sát" && body.stage === "Đàm phán"
          ? "Skip Demo (đã được Leader duyệt)" : (body.lyDo || ""),
      });
      return NextResponse.json({ ok: true });
    }

    if (body.op === "skip-request") {
      if (deal.stage !== "Khảo sát")
        return NextResponse.json({ ok: false, error: "Chỉ xin Skip Demo khi deal đang ở Khảo sát" }, { status: 422 });
      const lyDo = String(body.lyDo || "");
      if (!settings.lyDoSkip.includes(lyDo))
        return NextResponse.json({ ok: false, error: "Chọn lý do Skip Demo" }, { status: 422 });
      if (lyDo.startsWith("Lý do khác") && !String(body.giaiTrinh || "").trim())
        return NextResponse.json({ ok: false, error: "Chọn 'Lý do khác' thì phải ghi rõ giải trình" }, { status: 422 });
      const fields: Record<string, string> = { skip: "Có", lyDoSkip: lyDo, duyetSkip: "Chờ duyệt", hoatDong: today };
      if (body.giaiTrinh) fields.ghiChu = `[Skip Demo] ${body.giaiTrinh}`;
      await sheetApi("updateDeal", { maDeal: deal.ma, fields });
      return NextResponse.json({ ok: true });
    }

    if (body.op === "skip-decide") {
      if (!leads) return NextResponse.json({ ok: false, error: "Chỉ Leader được duyệt Skip Demo" }, { status: 403 });
      const quyetDinh = body.quyetDinh === "Đã duyệt" ? "Đã duyệt" : "Từ chối";
      await sheetApi("updateDeal", { maDeal: deal.ma, fields: { duyetSkip: quyetDinh } });
      return NextResponse.json({ ok: true });
    }

    if (body.op === "close") {
      const ketQua = body.ketQua === "Win" ? "Win" : "Fail";
      await sheetApi("updateDeal", {
        maDeal: deal.ma,
        fields: { stage: "Win / Fail", ngayVaoStage: today, hoatDong: today, ketQua },
      });
      await sheetApi("addHistory", {
        ngay: today, maDeal: deal.ma, sales: deal.sales,
        tuStage: deal.stage, sangStage: `Win / Fail (${ketQua})`, lyDo: body.lyDo || "",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Thao tác không hợp lệ" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lỗi cập nhật" }, { status: 500 });
  }
}

export const maxDuration = 30;
