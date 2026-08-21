"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CrmLogin() {
  const router = useRouter();
  const [names, setNames] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/crm/names")
      .then((r) => r.json())
      .then((d) => setNames(d.names || []))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/crm/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      router.push("/crm");
      router.refresh();
    } else {
      setErr(data.error || "Đăng nhập thất bại");
    }
  }

  const input =
    "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-strong outline-none focus:border-brand";

  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="text-center text-2xl font-extrabold text-strong">Đăng nhập CRM</h1>
      <p className="mt-1 text-center text-sm text-mute">
        Dành cho đội Sales & Leaders Roboworld
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-black/8 bg-white p-6">
        {names.length > 0 ? (
          <select required value={name} onChange={(e) => setName(e.target.value)} className={input}>
            <option value="" disabled>Chọn tên của bạn</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        ) : (
          <input
            required
            placeholder="Họ tên (đúng như danh sách)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input}
          />
        )}
        <input
          required
          type="password"
          inputMode="numeric"
          placeholder="Mã PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className={input}
        />
        {err && <p className="text-sm font-semibold text-brand">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded-full bg-brand py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Đang kiểm tra..." : "Đăng nhập"}
        </button>
        <p className="text-center text-xs text-mute">
          Quên PIN? Liên hệ Leader khu vực của bạn.
        </p>
      </form>
    </div>
  );
}
