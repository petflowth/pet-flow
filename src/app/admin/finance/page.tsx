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

export default function FinancePage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [summary, setSummary] = useState({ income: 0, expense: 0, net: 0 });

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

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: fd.get("type"),
        amount: Number(fd.get("amount")),
        category: fd.get("category"),
        description: fd.get("description"),
        date: fd.get("date") || new Date().toISOString().slice(0, 10),
      }),
    });
    e.currentTarget.reset();
    load();
  };

  const del = async (id: string, title: string) => {
    if (!confirm(`ลบรายการ "${title}"?\nกู้คืนไม่ได้ (ยอดรวมจะปรับตามทันที)`)) return;
    await fetch(`/api/finance?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">📒 รายรับ-รายจ่าย</h1>

      <ExportSheetsButton className="mb-4" />

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-catcha-sm bg-sage/15 p-3">
          <p className="text-xs text-brown-soft">รายรับ</p>
          <p className="font-extrabold text-ok">{summary.income.toLocaleString()}</p>
        </div>
        <div className="rounded-catcha-sm bg-honey/20 p-3">
          <p className="text-xs text-brown-soft">รายจ่าย</p>
          <p className="font-extrabold text-wait">{summary.expense.toLocaleString()}</p>
        </div>
        <div className="rounded-catcha-sm bg-latte/15 p-3">
          <p className="text-xs text-brown-soft">สุทธิ</p>
          <p className="font-extrabold text-latte-deep">{summary.net.toLocaleString()}</p>
        </div>
      </div>

      <form onSubmit={submit} className="mb-5 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <select name="type" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm">
          <option value="income">รายรับ</option>
          <option value="expense">รายจ่าย</option>
        </select>
        <input name="amount" type="number" required placeholder="จำนวนเงิน" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <input name="category" placeholder="หมวด เช่น อาหารแมว, ค่าเช่า" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <input name="description" placeholder="รายละเอียด" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <button type="submit" className="w-full rounded-catcha-sm bg-honey/40 py-3 text-sm font-extrabold text-catcha-chocolate">
          บันทึก
        </button>
      </form>

      <ul className="space-y-2">
        {records.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-2 rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-brown">{r.displayTitle}</p>
              <p className="text-brown-faint">{r.date} · {r.category}</p>
              {r.customerId && (
                <Link
                  href={`/admin/customers?id=${r.customerId}`}
                  className="mt-0.5 inline-block text-[10px] font-bold text-latte-deep underline"
                >
                  👤 {r.customerName || "ดูลูกค้า"}
                </Link>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className={`font-extrabold ${r.type === "income" ? "text-ok" : "text-wait"}`}>
                {r.type === "income" ? "+" : "-"}{r.amount.toLocaleString()}
              </p>
              <button
                type="button"
                onClick={() => del(r.id, r.displayTitle)}
                className="text-[10px] font-bold text-wait/80 hover:text-wait"
              >
                🗑️ ลบ
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
