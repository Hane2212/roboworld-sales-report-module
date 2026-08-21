"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const input = "w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-strong outline-none focus:border-brand";

export default function NewDealForm({
  khuVucList, salesList, defaultRegion,
}: {
  khuVucList: string[];
  salesList: string[];
  defaultRegion: string;
}) {
  const router = useRouter();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const f = new FormData(e.currentTarget);
    const fu = String(f.get("followUp") || "");
    const res = await fetch("/api/crm/deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        khach: f.get("khach"),
        khuVuc: f.get("khuVuc"),
        sales: f.get("sales") || undefined,
        stage: f.get("stage"),
        followUp: fu ? fu.split("-").reverse().join("/") : "",
        ghiChu: f.get("ghiChu"),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      router.push(`/crm/deal/${data.ma}`);
      router.refresh();
    } else {
      setErr(data.error || "Không tạo được deal");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/crm" className="text-sm text-mute hover:text-brand">← Bảng điều khiển</Link>
      <h1 className="mt-2 text-xl font-extrabold text-strong">Thêm deal mới</h1>
      <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border border-black/8 bg-white p-6">
        <input name="khach" required placeholder="Tên khách hàng / công ty *" className={input} />
        <div className="grid grid-cols-2 gap-3">
          <select name="khuVuc" defaultValue={khuVucList.includes(defaultRegion) ? defaultRegion : khuVucList[0]} className={input}>
            {khuVucList.map((k) => <option key={k}>{k}</option>)}
          </select>
          <select name="stage" defaultValue="Liên hệ mới" className={input}>
            <option>Liên hệ mới</option>
            <option>Cơ hội</option>
            <option>Khảo sát</option>
          </select>
        </div>
        {salesList.length > 0 && (
          <select name="sales" defaultValue="" className={input}>
            <option value="">Sales phụ trách: tôi</option>
            {salesList.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <label className="block text-xs text-mute">
          Hẹn follow-up đầu tiên
          <input name="followUp" type="date" className={`${input} mt-1`} />
        </label>
        <textarea name="ghiChu" rows={2} placeholder="Ghi chú (nhu cầu, robot quan tâm...)" className={input} />
        {err && <p className="text-sm font-semibold text-brand">{err}</p>}
        <button disabled={busy} className="w-full rounded-full bg-brand py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50">
          {busy ? "Đang tạo..." : "Tạo deal (mã tự sinh theo khu vực)"}
        </button>
      </form>
    </div>
  );
}
