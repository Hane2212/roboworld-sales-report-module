import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/crm/session";
import LogoutButton from "@/components/crm/LogoutButton";

export const metadata: Metadata = {
  title: "CRM Sales",
  robots: { index: false, follow: false },
};

export default async function CrmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();
  return (
    <div className="min-h-screen bg-paper-soft">
      <header className="sticky top-0 z-40 border-b border-ink-line bg-ink text-ondark">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/crm" className="font-extrabold tracking-tight">
            <span className="text-ondark">HH</span>
            <span className="text-brand">R</span>
            <span className="ml-2 text-sm font-semibold text-ondark-mute">CRM Sales</span>
          </Link>
          {user && (
            <div className="flex items-center gap-3 text-sm">
              <Link href="/crm/new" className="rounded-full bg-brand px-4 py-1.5 font-bold text-white hover:bg-brand-dark">
                + Deal
              </Link>
              <span className="hidden text-ondark-mute sm:inline">
                {user.name}{user.role !== "Sales" ? ` · ${user.role}` : ""}
              </span>
              <LogoutButton />
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
