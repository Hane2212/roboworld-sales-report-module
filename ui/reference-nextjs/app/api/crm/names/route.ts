import { NextResponse } from "next/server";
import { sheetApi, crmConfigured } from "@/lib/crm/api";

export async function GET() {
  try {
    if (!crmConfigured()) return NextResponse.json({ ok: false, names: [] });
    const data = await sheetApi<{ names: string[] }>("names");
    return NextResponse.json({ ok: true, names: data.names });
  } catch {
    return NextResponse.json({ ok: false, names: [] });
  }
}

export const maxDuration = 30;
