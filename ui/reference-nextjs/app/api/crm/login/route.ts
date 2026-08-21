import { NextResponse } from "next/server";
import { sheetApi, crmConfigured } from "@/lib/crm/api";
import { createSession, SESSION_COOKIE } from "@/lib/crm/session";

export async function POST(req: Request) {
  try {
    if (!crmConfigured())
      return NextResponse.json({ ok: false, error: "Hệ thống chưa được kết nối Google Sheets" }, { status: 503 });
    const { name, pin } = await req.json();
    if (!name || !pin) return NextResponse.json({ ok: false, error: "Thiếu tên hoặc mã PIN" }, { status: 400 });
    const data = await sheetApi<{ user: { name: string; region: string; role: string } }>("login", { name, pin });
    const res = NextResponse.json({ ok: true, user: data.user });
    res.cookies.set(SESSION_COOKIE, createSession(data.user), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    return res;
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Lỗi đăng nhập" }, { status: 401 });
  }
}

export const maxDuration = 30;
