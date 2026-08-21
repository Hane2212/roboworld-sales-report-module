// Phiên đăng nhập CRM: cookie ký HMAC — không lưu gì trên server.
import crypto from "crypto";
import { cookies } from "next/headers";

export interface CrmUser {
  name: string;
  region: string;
  role: string;
  exp: number;
}

const COOKIE = "hhr_crm";

function secret(): string {
  return process.env.CRM_SESSION_SECRET || "dev-secret-chua-cau-hinh";
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSession(user: { name: string; region: string; role: string }): string {
  const payload: CrmUser = { ...user, exp: Date.now() + 30 * 24 * 3600 * 1000 };
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${data}.${sign(data)}`;
}

export function verifySession(value: string | undefined): CrmUser | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const data = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  try {
    const expected = sign(data);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const user = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as CrmUser;
    if (user.exp < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<CrmUser | null> {
  const store = await cookies();
  return verifySession(store.get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;

export function isLeader(user: CrmUser): boolean {
  return user.role === "Leader" || user.role === "Admin";
}
