"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/Toast";

type Invoice = { id: string; catName: string; customerName: string; total: number; status: string };
type Customer = { id: string; name: string; cats: { name?: string }[] };

export default function TrashPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [inv, cus] = await Promise.all([
      fetch("/api/invoices?trash=1").then((r) => r.json()),
      fetch("/api/customers?trash=1").then((r) => r.json()),
    ]);
    setInvoices(inv.invoices || []);
    setCustomers(cus.customers || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const restoreInvoice = async (id: string) => {
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "restore" }),
    });
    if (res.ok) {
      toast("กู้บิลคืนแล้ว ♻️", "success");
      load();
    } else toast("กู้ไม่สำเร็จ", "error");
  };

  const restoreCustomer = async (id: string) => {
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "restore_customer" }),
    });
    if (res.ok) {
      toast("กู้ลูกค้าคืนแล้ว ♻️", "success");
      load();
    } else toast("กู้ไม่สำเร็จ", "error");
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  const empty = invoices.length === 0 && customers.length === 0;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold text-petflow-chocolate">🗑️ ถังขยะ</h1>
      <p className="text-xs text-brown-soft">
        รายการที่ลบไว้ กดกู้คืนได้ (บิลที่เคยจ่ายแล้ว กู้คืนได้แต่ควรเช็คยอดบัญชีอีกที)
      </p>

      {empty && (
        <p className="rounded-petflow bg-card p-6 text-center text-sm text-brown-soft shadow-petflow-sm">
          ถังขยะว่างเปล่า ✨
        </p>
      )}

      {invoices.length > 0 && (
        <section className="rounded-petflow bg-card p-4 shadow-petflow-sm">
          <h2 className="mb-3 text-sm font-extrabold text-petflow-chocolate">
            🧾 บิลที่ลบ ({invoices.length})
          </h2>
          <ul className="space-y-2">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-2 rounded-petflow-sm bg-paper/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brown">
                    {inv.catName} · {inv.customerName}
                  </p>
                  <p className="text-[11px] text-brown-soft">
                    {inv.total.toLocaleString()} บาท ·{" "}
                    {inv.status === "paid" ? "เคยชำระ" : "รอชำระ"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreInvoice(inv.id)}
                  className="shrink-0 rounded-full bg-sage/25 px-3 py-1.5 text-xs font-bold text-ok"
                >
                  ♻️ กู้คืน
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {customers.length > 0 && (
        <section className="rounded-petflow bg-card p-4 shadow-petflow-sm">
          <h2 className="mb-3 text-sm font-extrabold text-petflow-chocolate">
            👤 ลูกค้าที่ลบ ({customers.length})
          </h2>
          <ul className="space-y-2">
            {customers.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-petflow-sm bg-paper/50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-brown">{c.name}</p>
                  <p className="text-[11px] text-brown-soft">
                    🐱 {c.cats.map((x) => x.name).filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreCustomer(c.id)}
                  className="shrink-0 rounded-full bg-sage/25 px-3 py-1.5 text-xs font-bold text-ok"
                >
                  ♻️ กู้คืน
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
