"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal, Report, CrmData } from "@/lib/crm/api";
import { STAGE_ORDER } from "@/lib/crm/rules";

const card = "mt-4 rounded-2xl border border-black/8 bg-white p-5";
const input = "w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-strong outline-none focus:border-brand";
const btn = "rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark disabled:opacity-50";
const btnGhost = "rounded-full border border-black/15 px-5 py-2.5 text-sm font-semibold text-strong hover:border-brand hover:text-brand disabled:opacity-50";

export default function DealActions({
  deal, reports, settings, canLead, userName, isAdmin,
}: {
  deal: Deal;
  reports: Report[];
  settings: CrmData["settings"];
  canLead: boolean;
  userName: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (data.ok) {
      setMsg({ ok: true, text: "✅ Đã lưu!" });
      router.refresh();
    } else {
      setMsg({ ok: false, text: data.error || "Có lỗi xảy ra" });
    }
    return data.ok as boolean;
  }

  const closed = deal.ketQua !== "";

  // form states
  const [ghiChu, setGhiChu] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [newStage, setNewStage] = useState("");
  const [skipLyDo, setSkipLyDo] = useState("");
  const [skipGiaiTrinh, setSkipGiaiTrinh] = useState("");
  const [bcLoai, setBcLoai] = useState(deal.bcBatBuoc !== "Không" && deal.bcBatBuoc ? deal.bcBatBuoc : "");
  const [bcLink, setBcLink] = useState("");
  const [bcGhiChu, setBcGhiChu] = useState("");
  const [rejectRow, setRejectRow] = useState<number | null>(null);
  const [rejectLyDo, setRejectLyDo] = useState("");

  return (
    <div>
      {msg && (
        <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-brand"}`}>
          {msg.text}
        </p>
      )}

      {/* Leader: duyệt Skip Demo */}
      {canLead && deal.skip === "Có" && deal.duyetSkip === "Chờ duyệt" && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-bold text-blue-900">🔔 Yêu cầu Skip Demo đang chờ bạn duyệt</h2>
          <p className="mt-1 text-sm text-blue-900">Lý do: {deal.lyDoSkip}</p>
          <p className="mt-1 text-xs text-blue-800">
            Kiểm tra BC Skip Demo ở danh sách báo cáo bên dưới trước khi quyết định.
          </p>
          <div className="mt-3 flex gap-3">
            <button disabled={busy} className={btn}
              onClick={() => post("/api/crm/deal-update", { ma: deal.ma, op: "skip-decide", quyetDinh: "Đã duyệt" })}>
              ✓ Duyệt Skip Demo
            </button>
            <button disabled={busy} className={btnGhost}
              onClick={() => post("/api/crm/deal-update", { ma: deal.ma, op: "skip-decide", quyetDinh: "Từ chối" })}>
              ✗ Từ chối
            </button>
          </div>
        </div>
      )}

      {!closed && (
        <>
          {/* Cập nhật hoạt động */}
          <div className={card}>
            <h2 className="font-bold text-strong">📞 Cập nhật hoạt động</h2>
            <p className="mt-1 text-xs text-mute">
              Vừa gọi điện / gặp khách / gửi báo giá? Bấm nút để hệ thống ghi nhận hôm nay — deal sẽ không bị nhắc oan.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input placeholder="Ghi chú nhanh (không bắt buộc)" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} className={input} />
              <input type="date" title="Hẹn follow-up tiếp theo" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={input} />
            </div>
            <button disabled={busy} className={`${btn} mt-3`}
              onClick={() => {
                const fu = followUp ? followUp.split("-").reverse().join("/") : "";
                post("/api/crm/deal-update", { ma: deal.ma, op: "activity", ghiChu: ghiChu || undefined, followUp: fu });
              }}>
              Tôi vừa làm việc với khách hôm nay
            </button>
          </div>

          {/* Nộp báo cáo */}
          <div className={card}>
            <h2 className="font-bold text-strong">📄 Nộp báo cáo</h2>
            <p className="mt-1 text-xs text-mute">
              Upload file lên Google Drive (bật chia sẻ nội bộ) rồi dán link vào đây.
            </p>
            <div className="mt-3 grid gap-3">
              <select value={bcLoai} onChange={(e) => setBcLoai(e.target.value)} className={input}>
                <option value="" disabled>Chọn loại báo cáo</option>
                {settings.loaiBC.map((t) => <option key={t}>{t}</option>)}
              </select>
              <input placeholder="Dán link Google Drive (https://...)" value={bcLink} onChange={(e) => setBcLink(e.target.value)} className={input} />
              <input placeholder="Ghi chú (không bắt buộc)" value={bcGhiChu} onChange={(e) => setBcGhiChu(e.target.value)} className={input} />
            </div>
            <button disabled={busy || !bcLoai || !bcLink} className={`${btn} mt-3`}
              onClick={async () => {
                const ok = await post("/api/crm/report", { ma: deal.ma, loai: bcLoai, link: bcLink, ghiChu: bcGhiChu });
                if (ok) { setBcLink(""); setBcGhiChu(""); }
              }}>
              Nộp báo cáo
            </button>
          </div>

          {/* Chuyển stage */}
          <div className={card}>
            <h2 className="font-bold text-strong">➡️ Chuyển giai đoạn</h2>
            <p className="mt-1 text-xs text-mute">
              Hệ thống tự kiểm tra luật: đủ báo cáo bắt buộc mới được đi tiếp, không nhảy cóc.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <select value={newStage} onChange={(e) => setNewStage(e.target.value)} className={`${input} max-w-60`}>
                <option value="" disabled>Chọn stage mới</option>
                {STAGE_ORDER.filter((s) => s !== deal.stage && s !== "Win / Fail").map((s) => <option key={s}>{s}</option>)}
              </select>
              <button disabled={busy || !newStage} className={btn}
                onClick={() => post("/api/crm/deal-update", { ma: deal.ma, op: "stage", stage: newStage })}>
                Chuyển
              </button>
            </div>

            {deal.stage === "Khảo sát" && deal.skip !== "Có" && (
              <div className="mt-4 rounded-xl bg-paper-soft p-4">
                <p className="text-sm font-semibold text-strong">Muốn bỏ qua Demo?</p>
                <div className="mt-2 grid gap-3">
                  <select value={skipLyDo} onChange={(e) => setSkipLyDo(e.target.value)} className={input}>
                    <option value="" disabled>Chọn lý do bỏ qua Demo</option>
                    {settings.lyDoSkip.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  {skipLyDo.startsWith("Lý do khác") && (
                    <input placeholder="Giải trình rõ lý do *" value={skipGiaiTrinh} onChange={(e) => setSkipGiaiTrinh(e.target.value)} className={input} />
                  )}
                  <button disabled={busy || !skipLyDo} className={btnGhost}
                    onClick={() => post("/api/crm/deal-update", { ma: deal.ma, op: "skip-request", lyDo: skipLyDo, giaiTrinh: skipGiaiTrinh })}>
                    Gửi yêu cầu Skip Demo (kèm nộp BC Skip Demo ở trên)
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Chốt deal */}
          <div className={card}>
            <h2 className="font-bold text-strong">🏁 Chốt deal</h2>
            <div className="mt-3 flex gap-3">
              <button disabled={busy} className="rounded-full bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                onClick={() => { if (confirm(`Xác nhận deal ${deal.ma} THẮNG (Win)?`)) post("/api/crm/deal-update", { ma: deal.ma, op: "close", ketQua: "Win" }); }}>
                ✓ Win
              </button>
              <button disabled={busy} className={btnGhost}
                onClick={() => { if (confirm(`Xác nhận deal ${deal.ma} THUA (Fail)?`)) post("/api/crm/deal-update", { ma: deal.ma, op: "close", ketQua: "Fail" }); }}>
                ✗ Fail
              </button>
            </div>
          </div>
        </>
      )}

      {/* Danh sách báo cáo của deal */}
      <div className={card}>
        <h2 className="font-bold text-strong">📚 Báo cáo của deal này ({reports.length})</h2>
        {reports.length === 0 && <p className="mt-2 text-sm text-mute">Chưa có báo cáo nào.</p>}
        <ul className="mt-3 space-y-3">
          {reports.map((r) => (
            <li key={r.row} className="rounded-xl border border-black/8 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-strong">
                    {r.loai} · v{r.phienBan} ·{" "}
                    <span className={
                      r.trangThai === "Đã duyệt" ? "text-green-600" :
                      r.trangThai === "Từ chối" ? "text-brand" : "text-orange-600"
                    }>{r.trangThai}</span>
                  </p>
                  <p className="text-xs text-mute">
                    {r.ngayNop} · {r.sales}{r.nguoiDuyet ? ` · Duyệt: ${r.nguoiDuyet}` : ""}
                  </p>
                  {r.ghiChu && <p className="mt-1 text-xs text-mute">💬 {r.ghiChu}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <a href={r.link} target="_blank" rel="noopener" className="text-xs font-bold text-brand underline">Mở file</a>
                  {canLead && r.trangThai === "Đã nộp" && (r.sales !== userName || isAdmin) && (
                    <>
                      <button disabled={busy} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        onClick={() => post("/api/crm/report-status", { row: r.row, ma: deal.ma, trangThai: "Đã duyệt" })}>
                        Duyệt
                      </button>
                      <button disabled={busy} className="rounded-full border border-black/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        onClick={() => setRejectRow(rejectRow === r.row ? null : r.row)}>
                        Từ chối
                      </button>
                    </>
                  )}
                </div>
              </div>
              {rejectRow === r.row && (
                <div className="mt-2 flex gap-2">
                  <input placeholder="Lý do từ chối *" value={rejectLyDo} onChange={(e) => setRejectLyDo(e.target.value)} className={input} />
                  <button disabled={busy || !rejectLyDo.trim()} className={btn}
                    onClick={async () => {
                      const ok = await post("/api/crm/report-status", { row: r.row, ma: deal.ma, trangThai: "Từ chối", lyDo: rejectLyDo });
                      if (ok) { setRejectRow(null); setRejectLyDo(""); }
                    }}>
                    Gửi
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
