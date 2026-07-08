"use client";

import { useCallback, useEffect, useState } from "react";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";

type Record = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
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
          <li key={r.id} className="flex justify-between rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-xs">
            <div>
              <p className="font-bold text-brown">{r.description || r.category}</p>
              <p className="text-brown-faint">{r.date} · {r.category}</p>
            </div>
            <p className={`font-extrabold ${r.type === "income" ? "text-ok" : "text-wait"}`}>
              {r.type === "income" ? "+" : "-"}{r.amount.toLocaleString()}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
