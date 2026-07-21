"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";

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
};

const TODAY = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { type: "income", amount: "", category: "", description: "", date: TODAY() };

export default function FinancePage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

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
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      type: form.type,
      amount: Number(form.amount),
      category: form.category,
      description: form.description,
      date: form.date || TODAY(),
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    </div>
  );
}
