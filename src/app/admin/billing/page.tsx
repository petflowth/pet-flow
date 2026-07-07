"use client";

import { useCallback, useEffect, useState } from "react";

type Customer = {
  id: string;
  name: string;
  lineUserId?: string;
  cats: { name: string }[];
  isMember: boolean;
  memberCredit: number;
};

type Promo = { id: string; title: { th: string }; discountPercent?: number };

type Invoice = {
  id: string;
  total: number;
  status: string;
  customerName: string;
  catName: string;
};

export default function BillingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [promoId, setPromoId] = useState("");
  const [items, setItems] = useState([{ label: "อาบน้ำแมว", amount: 350 }]);

  const load = useCallback(async () => {
    const [c, p, i] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/promos?active=1"),
      fetch("/api/invoices"),
    ]);
    setCustomers((await c.json()).customers || []);
    setPromos((await p.json()).promos || []);
    setInvoices((await i.json()).invoices || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = customers.find((c) => c.id === customerId);

  const createBill = async () => {
    if (!selected) return alert("เลือกลูกค้า");
    const cat = selected.cats[0]?.name || "น้องแมว";
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        customerId: selected.id,
        lineUserId: selected.lineUserId,
        customerName: selected.name,
        catName: cat,
        items,
        promoId: promoId || undefined,
      }),
    });
    const data = await res.json();
    if (data.invoice) {
      alert(`สร้างบิล ${data.invoice.id} — ${data.invoice.total} บาท`);
      load();
    }
  };

  const sendPayment = async (id: string) => {
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "send_payment" }),
    });
    if (res.ok) alert("ส่งลิงก์ชำระเงิน LINE แล้ว 📨");
    else alert("ส่งไม่สำเร็จ — ตรวจ LINE User ID");
  };

  const markPaid = async (id: string, method: "transfer" | "member_credit" | "cash") => {
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mark_paid", paymentMethod: method }),
    });
    if (res.ok) {
      alert("รับชำระแล้ว — ส่งใบเสร็จ + แต้ม + ลิงก์รีวิว 📨");
      load();
    } else {
      const err = await res.json();
      alert(err.error === "insufficient_credit" ? "เครดิต Member ไม่พอ" : "ไม่สำเร็จ");
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">💳 คิดเงิน</h1>

      <div className="mb-4 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <label className="block text-xs font-bold text-brown-soft">
          ลูกค้า
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
          >
            <option value="">— เลือก —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.cats[0]?.name}
                {c.isMember ? ` (Member ${c.memberCredit}฿)` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-bold text-brown-soft">
          โปรโมชั่น
          <select
            value={promoId}
            onChange={(e) => setPromoId(e.target.value)}
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
          >
            <option value="">ไม่ใช้โปร</option>
            {promos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title.th}
                {p.discountPercent ? ` (${p.discountPercent}%)` : ""}
              </option>
            ))}
          </select>
        </label>

        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <input
              value={item.label}
              onChange={(e) => {
                const next = [...items];
                next[i].label = e.target.value;
                setItems(next);
              }}
              className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={item.amount}
              onChange={(e) => {
                const next = [...items];
                next[i].amount = Number(e.target.value);
                setItems(next);
              }}
              className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, { label: "บริการเพิ่ม", amount: 0 }])}
          className="text-xs font-bold text-latte-deep"
        >
          + รายการ
        </button>

        <button
          type="button"
          onClick={createBill}
          className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-catcha-chocolate"
        >
          สร้างบิล
        </button>
      </div>

      <h2 className="mb-2 text-sm font-extrabold">บิลล่าสุด</h2>
      <ul className="space-y-3">
        {invoices.map((inv) => (
          <li key={inv.id} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="font-bold text-brown">
              {inv.catName} · {inv.customerName}
            </p>
            <p className="text-sm text-latte-deep font-extrabold">
              {inv.total.toLocaleString()} บาท · {inv.status === "paid" ? "✅ ชำระแล้ว" : "⏳ รอชำระ"}
            </p>
            {inv.status === "pending" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => sendPayment(inv.id)}
                  className="rounded-full bg-latte/25 px-3 py-1.5 text-xs font-bold"
                >
                  📨 ส่งลิงก์โอน
                </button>
                <button
                  type="button"
                  onClick={() => markPaid(inv.id, "transfer")}
                  className="rounded-full bg-sage/20 px-3 py-1.5 text-xs font-bold text-ok"
                >
                  ✅ รับโอนแล้ว
                </button>
                {selected?.isMember && (
                  <button
                    type="button"
                    onClick={() => markPaid(inv.id, "member_credit")}
                    className="rounded-full bg-honey/30 px-3 py-1.5 text-xs font-bold"
                  >
                    💎 หัก Member
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => markPaid(inv.id, "cash")}
                  className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold"
                >
                  💵 เงินสด
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
