"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";
import { toJpegDataUrl } from "@/lib/image-convert";
import { toast } from "@/components/Toast";

type Record = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
  customerId?: string;
  customerName?: string;
  catName?: string;
  displayTitle: string;
  receiptUrl?: string;
};

const TODAY = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { type: "income", amount: "", category: "", description: "", date: TODAY() };

export default function FinancePage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [busyReceipt, setBusyReceipt] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/finance?summary=1");
    const data = await res.json();
    setSummary(data.summary);
    const list = await fetch("/api/finance");
    const listData = await list.json();
    setRecords(listData.records || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, date: TODAY() });
    setEditingId(null);
    setReceipt("");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      description: form.description,
      date: form.date || TODAY(),
      // ส่ง receipt เฉพาะตอนแนบใหม่ (data URL) — ตอนแก้ไขไม่แนบใหม่ก็ไม่แตะรูปเดิม
      ...(receipt.startsWith("data:") ? { receipt } : {}),
    };
    if (editingId) {
      await fetch("/api/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...payload }),
      });
    } else {
      await fetch("/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetForm();
    load();
  };

  const startEdit = (r: Record) => {
    setEditingId(r.id);
    setForm({
      type: r.type,
      amount: String(r.amount),
      category: r.category || "",
      description: r.description || "",
      date: r.date,
    });
    setReceipt(r.receiptUrl || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /** เลือกรูปบิล — ย่อก่อนเสมอ กันไฟล์ใหญ่เปลืองที่ */
  const pickReceipt = async (file: File) => {
    setBusyReceipt(true);
    try {
      setReceipt(await toJpegDataUrl(file, 1400));
    } catch {
      toast("อ่านรูปไม่ได้ ลองรูปอื่นนะคะ", "error");
    } finally {
      setBusyReceipt(false);
    }
  };

  /** แนบ/เปลี่ยนรูปบิลของรายการที่มีอยู่แล้ว (จากแถวที่กางอยู่) */
  const attachToRow = async (id: string, file: File) => {
    setBusyReceipt(true);
    try {
      const dataUrl = await toJpegDataUrl(file, 1400);
      await fetch("/api/finance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, receipt: dataUrl }),
      });
      load();
    } catch {
      toast("แนบรูปไม่สำเร็จ", "error");
    } finally {
      setBusyReceipt(false);
    }
  };

  const del = async (id: string, title: string) => {
    if (!confirm(`ลบรายการ "${title}"?\nกู้คืนไม่ได้ (ยอดรวมจะปรับตามทันที)`)) return;
    await fetch(`/api/finance?id=${id}`, { method: "DELETE" });
    if (editingId === id) resetForm();
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold text-petflow-chocolate">📒 รายรับ-รายจ่าย</h1>
        <Link
          href="/admin/tax"
          className="shrink-0 rounded-petflow-sm bg-latte/25 px-3 py-2 text-xs font-extrabold text-latte-deep"
        >
          📑 เอกสารภาษี →
        </Link>
      </div>

      <ExportSheetsButton className="mb-4" />

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-petflow-sm bg-sage/15 p-3">
          <p className="text-xs text-brown-soft">รายรับ</p>
          <p className="font-extrabold text-ok">{summary.income.toLocaleString()}</p>
        </div>
        <div className="rounded-petflow-sm bg-honey/20 p-3">
          <p className="text-xs text-brown-soft">รายจ่าย</p>
          <p className="font-extrabold text-wait">{summary.expense.toLocaleString()}</p>
        </div>
        <div className="rounded-petflow-sm bg-latte/15 p-3">
          <p className="text-xs text-brown-soft">สุทธิ</p>
          <p className="font-extrabold text-latte-deep">{summary.net.toLocaleString()}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mb-5 space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm">
        {editingId && (
          <p className="text-xs font-extrabold text-latte-deep">✏️ กำลังแก้ไขรายการ</p>
        )}
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
          className="w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
        >
          <option value="income">รายรับ</option>
          <option value="expense">รายจ่าย</option>
        </select>
        <input
          type="number"
          required
          placeholder="จำนวนเงิน"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
        />
        <input
          placeholder="หมวด เช่น อาหารแมว, ค่าเช่า"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
        />
        <input
          placeholder="รายละเอียด"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
        />

        {/* แนบรูปบิล/ใบเสร็จ — ไว้เป็นหลักฐานตอนยื่นภาษี (ย่อรูปให้อัตโนมัติ) */}
        <label className="flex cursor-pointer items-center gap-3 rounded-petflow-sm border border-dashed border-petflow-line bg-paper px-3 py-2.5">
          {receipt ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receipt} alt="บิล" className="h-12 w-12 shrink-0 rounded-petflow-sm object-cover" />
          ) : (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-petflow-sm bg-card text-xl">
              🧾
            </span>
          )}
          <span className="min-w-0 text-[11px] font-bold text-brown-soft">
            {busyReceipt ? "กำลังย่อรูป…" : receipt ? "เปลี่ยนรูปบิล/ใบเสร็จ" : "แนบรูปบิล/ใบเสร็จ (ถ้ามี)"}
            <span className="block font-normal text-brown-faint">
              เก็บไว้เป็นหลักฐานยื่นภาษี · ระบบย่อรูปให้ ไม่เปลืองที่
            </span>
          </span>
          {receipt && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setReceipt("");
              }}
              className="shrink-0 text-[11px] font-bold text-wait"
            >
              เอาออก
            </button>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pickReceipt(f);
            }}
          />
        </label>

        <button type="submit" className="w-full rounded-petflow-sm bg-honey/40 py-3 text-sm font-extrabold text-petflow-chocolate">
          {editingId ? "💾 บันทึกการแก้ไข" : "บันทึก"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded-petflow-sm bg-paper py-2 text-xs font-bold text-brown-soft"
          >
            ยกเลิกการแก้ไข
          </button>
        )}
      </form>

      <ul className="space-y-1.5">
        {records.map((r) => {
          const open = openId === r.id;
          // ชื่อย่อ — โชว์แค่แมว·เจ้าของ (หรือหมวด) ให้แถวสั้น กดค่อยกางดูรายละเอียดเต็ม
          const compact = r.customerName
            ? `${r.catName ? `🐱 ${r.catName} · ` : "👤 "}${r.customerName}`
            : r.category || r.displayTitle;
          return (
            <li key={r.id} className="overflow-hidden rounded-petflow-sm border border-petflow-line bg-card text-xs">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : r.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-brown-faint">{open ? "▾" : "▸"}</span>
                  <span className="min-w-0 truncate font-bold text-brown">{compact}</span>
                  {r.receiptUrl && <span className="shrink-0" title="มีรูปบิลแนบ">🧾</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-brown-faint">{r.date}</span>
                  <span className={`font-extrabold ${r.type === "income" ? "text-ok" : "text-wait"}`}>
                    {r.type === "income" ? "+" : "-"}
                    {r.amount.toLocaleString()}
                  </span>
                </span>
              </button>

              {open && (
                <div className="border-t border-petflow-line/60 bg-paper/40 px-3 py-2">
                  <p className="font-bold text-brown">{r.displayTitle}</p>
                  <p className="mt-0.5 text-brown-faint">
                    {r.date} · หมวด: {r.category || "-"}
                  </p>
                  {r.customerId && (
                    <Link
                      href={`/admin/customers?id=${r.customerId}`}
                      className="mt-1 inline-block text-[10px] font-bold text-latte-deep underline"
                    >
                      👤 {r.customerName || "ดูลูกค้า"}
                    </Link>
                  )}

                  {/* รูปบิล/ใบเสร็จ — แตะดูเต็มจอ หรือแนบถ้ายังไม่มี */}
                  <div className="mt-2">
                    {r.receiptUrl ? (
                      <button
                        type="button"
                        onClick={() => setZoomUrl(r.receiptUrl!)}
                        className="flex items-center gap-2 rounded-petflow-sm bg-sage/15 px-2.5 py-1.5 text-[11px] font-bold text-ok"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.receiptUrl} alt="บิล" className="h-8 w-8 rounded object-cover" />
                        🧾 ดูรูปบิล (แตะเพื่อขยาย)
                      </button>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-petflow-sm bg-paper px-2.5 py-1.5 text-[11px] font-bold text-brown-soft">
                        {busyReceipt ? "กำลังแนบ…" : "📎 แนบรูปบิล/ใบเสร็จ"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) attachToRow(r.id, f);
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="text-[11px] font-bold text-latte-deep"
                    >
                      ✏️ แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => del(r.id, r.displayTitle)}
                      className="text-[11px] font-bold text-wait/80 hover:text-wait"
                    >
                      🗑️ ลบ
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* ดูรูปบิลเต็มจอ */}
      {zoomUrl && (
        <button
          type="button"
          onClick={() => setZoomUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="รูปบิล" className="max-h-full max-w-full rounded-petflow object-contain" />
        </button>
      )}
    </div>
  );
}
