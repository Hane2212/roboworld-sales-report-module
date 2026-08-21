"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/crm/logout", { method: "POST" });
        router.push("/crm/login");
        router.refresh();
      }}
      className="text-xs text-ondark-mute underline hover:text-ondark"
    >
      Thoát
    </button>
  );
}
