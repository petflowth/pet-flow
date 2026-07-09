"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SERVICE_PRESETS, type ServicePreset } from "@/lib/service-presets";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  lineUserId?: string;
  cats: { name: string }[];
  isMember: boolean;
  memberCredit: number;
};

type Promo = {
  id: string;
  title: { th: string };
  discountPercent?: number;
  discountAmount?: number;
};

type Invoice = {
  id: string;
  total: number;
  status: string;
  customerName: string;
  catName: string;
};

type Item = { label: string; amount: number; custom: boolean };

const CUSTOM = "__custom__";

export default function BillingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rooms, setRooms] = useState<ServicePreset[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);

  const [promoId, setPromoId] = useState("");
  const [autoPromoLabel, setAutoPromoLabel] = useState("");
  const [discount, setDiscount] = useState("");
  const [items, setItems] = useState<Item[]>([
    { label: "อาบน้ำ – เป่าขน", amount: 350, custom: false },
  ]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [c, p, i, cfg] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/promos?active=1"),
      fetch("/api/invoices"),
      fetch("/api/config"),
    ]);
    setCustomers((await c.json()).customers || []);
    setPromos((await p.json()).promos || []);
    setInvoices((await i.json()).invoices || []);
    const config = (await cfg.json()).config;
    const roomPresets: ServicePreset[] = (config?.rooms || []).map(
      (r: { name: string; price: number }) => ({
        label: `ห้อง ${r.name} (/คืน)`,
        amount: r.price,
      })
    );
    setRooms(roomPresets);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const presets = useMemo(() => [...rooms, ...SERVICE_PRESETS], [rooms]);
  const selected = customers.find((c) => c.id === customerId);

  const subtotal = items.reduce((s, it) => s + (it.amount || 0), 0);
  const selectedPromo = promos.find((p) => p.id === promoId);
  const promoDiscount = selectedPromo
    ? Math.min(
        subtotal,
        Math.max(
          selectedPromo.discountPercent
            ? Math.round((subtotal * selectedPromo.discountPercent) / 100)
            : 0,
          selectedPromo.discountAmount || 0
        )
      )
    : 0;
  const manualDiscount = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - promoDiscount - manualDiscount);

  const filtered =
    search.trim().length === 0
      ? customers.slice(0, 8)
      : customers
          .filter((c) => {
            const q = search.toLowerCase();
            return (
              c.name.toLowerCase().includes(q) ||
              (c.phone || "").includes(q) ||
              c.cats.some((cat) => cat.name.toLowerCase().includes(q))
            );
          })
          .slice(0, 8);

  // เลือกลูกค้า → ดึงโปรที่ใช้ได้ ตัดอัตโนมัติ
  const pickCustomer = async (c: Customer) => {
    setCustomerId(c.id);
    setSearch(c.name);
    setShowList(false);
    setPromoId("");
    setAutoPromoLabel("");
    try {
      const res = await fetch(
        `/api/promos?autoFor=${c.id}&subtotal=${subtotal}`
      );
      const { promo } = await res.json();
      if (promo) {
        setPromoId(promo.id);
        setAutoPromoLabel(promo.label);
      }
    } catch {
      /* ไม่มีโปรก็ข้าม */
    }
  };

  const clearCustomer = () => {
    setCustomerId("");
    setSearch("");
    setPromoId("");
    setAutoPromoLabel("");
    setShowList(true);
  };

  const setPreset = (idx: number, value: string) => {
    if (value === CUSTOM) {
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, custom: true, label: "" } : it))
      );
      return;
    }
    const preset = presets.find((p) => p.label === value);
    if (!preset) return;
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { label: preset.label, amount: preset.amount, custom: false }
          : it
      )
    );
  };

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const createBill = async () => {
    if (!selected) return alert("เลือกลูกค้าก่อน");
    if (subtotal <= 0) return alert("ใส่รายการอย่างน้อย 1 อย่าง");
    setCreating(true);
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
        items: items
          .filter((it) => it.label.trim() && it.amount > 0)
          .map((it) => ({ label: it.label, amount: it.amount })),
        promoId: promoId || undefined,
        extraDiscount: manualDiscount || undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.invoice) {
      alert(`สร้างบิล ${data.invoice.id} — ${data.invoice.total} บาท`);
      setItems([{ label: "อาบน้ำ – เป่าขน", amount: 350, custom: false }]);
      setDiscount("");
      load();
    } else {
      alert("สร้างบิลไม่สำเร็จ");
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

  const markPaid = async (
    id: string,
    method: "transfer" | "member_credit" | "cash"
  ) => {
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mark_paid", paymentMethod: method }),
    });
    if (res.ok) {
      alert("รับชำระแล้ว — บันทึกรายรับ + ส่งใบเสร็จ + แต้ม 📨");
      load();
    } else {
      const err = await res.json();
      alert(err.error === "insufficient_credit" ? "เครดิต Member ไม่พอ" : "ไม่สำเร็จ");
    }
  };

  const field =
    "w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm";

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">💳 คิดเงิน</h1>

      <div className="mb-4 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        {/* ── ค้นหาลูกค้า ── */}
        <div>
          <p className="mb-1 text-xs font-bold text-brown-soft">ลูกค้า</p>
          {selected ? (
            <div className="flex items-center justify-between gap-2 rounded-catcha-sm border border-latte/50 bg-latte/10 px-3 py-2">
              <span className="min-w-0 truncate text-sm font-bold text-brown">
                🐱 {selected.cats[0]?.name || "—"} · {selected.name}
                {selected.isMember ? ` · 💎 ${selected.memberCredit}฿` : ""}
              </span>
              <button
                type="button"
                onClick={clearCustomer}
                className="shrink-0 text-xs font-bold text-wait"
              >
                ✕ เปลี่ยน
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                placeholder="🔍 พิมพ์ชื่อลูกค้า / ชื่อแมว / เบอร์"
                className={field}
              />
              {showList && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-catcha-sm border border-catcha-line bg-card shadow-catcha">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-brown-soft">
                      ไม่พบลูกค้า
                    </li>
                  ) : (
                    filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pickCustomer(c)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-paper"
                        >
                          <span className="font-bold text-brown">
                            {c.cats[0]?.name || "👤"}
                          </span>{" "}
                          · {c.name}
                          {c.isMember ? " 💎" : ""}
                          <span className="block text-[10px] text-brown-faint">
                            {c.phone || "ไม่มีเบอร์"}
                            {c.lineUserId ? " · LINE ✓" : ""}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ── รายการบริการ ── */}
        <div>
          <p className="mb-1 text-xs font-bold text-brown-soft">รายการ</p>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex gap-2">
                {item.custom ? (
                  <input
                    value={item.label}
                    onChange={(e) => updateItem(i, { label: e.target.value })}
                    placeholder="พิมพ์ชื่อรายการ"
                    className="min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                  />
                ) : (
                  <select
                    value={item.label}
                    onChange={(e) => setPreset(i, e.target.value)}
                    className="min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                  >
                    {presets.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                    <option value={CUSTOM}>✏️ พิมพ์เอง…</option>
                  </select>
                )}
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={item.amount}
                  onChange={(e) =>
                    updateItem(i, { amount: Number(e.target.value) || 0 })
                  }
                  className="w-24 shrink-0 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="shrink-0 px-1 text-brown-faint"
                    aria-label="ลบรายการ"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                { label: presets[0]?.label || "", amount: presets[0]?.amount || 0, custom: false },
              ])
            }
            className="mt-2 text-xs font-bold text-latte-deep"
          >
            + เพิ่มรายการ
          </button>
        </div>

        {/* ── โปร + ส่วนลด ── */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-xs font-bold text-brown-soft">
            โปรโมชั่น
            <select
              value={promoId}
              onChange={(e) => setPromoId(e.target.value)}
              className={`mt-1 ${field}`}
            >
              <option value="">ไม่ใช้โปร</option>
              {promos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title.th}
                  {p.discountPercent ? ` (${p.discountPercent}%)` : ""}
                  {p.discountAmount ? ` (-${p.discountAmount}฿)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-brown-soft">
            ส่วนลดเพิ่ม (บาท)
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              className={`mt-1 ${field}`}
            />
          </label>
        </div>

        {autoPromoLabel && promoId && (
          <p className="rounded-catcha-sm bg-sage/15 px-3 py-1.5 text-[11px] font-bold text-ok">
            ⚡ ใช้โปร &quot;{autoPromoLabel}&quot; อัตโนมัติ (ลูกค้าคนนี้มีสิทธิ์)
          </p>
        )}

        {/* ── สรุปยอด ── */}
        <div className="space-y-1 rounded-catcha-sm bg-paper/60 px-3 py-2 text-sm">
          <div className="flex justify-between text-brown-soft">
            <span>ยอดรวม</span>
            <span>{subtotal.toLocaleString()} ฿</span>
          </div>
          {(promoDiscount > 0 || manualDiscount > 0) && (
            <div className="flex justify-between text-wait">
              <span>ส่วนลด</span>
              <span>-{(promoDiscount + manualDiscount).toLocaleString()} ฿</span>
            </div>
          )}
          <div className="flex justify-between border-t border-catcha-line pt-1 text-base font-extrabold text-catcha-chocolate">
            <span>ยอดสุทธิ</span>
            <span>{total.toLocaleString()} ฿</span>
          </div>
        </div>

        <button
          type="button"
          disabled={creating}
          onClick={createBill}
          className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-60"
        >
          {creating ? "กำลังสร้าง…" : "สร้างบิล"}
        </button>
      </div>

      <h2 className="mb-2 text-sm font-extrabold">บิลล่าสุด</h2>
      <ul className="space-y-3">
        {invoices.map((inv) => (
          <li key={inv.id} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="font-bold text-brown">
              {inv.catName} · {inv.customerName}
            </p>
            <p className="text-sm font-extrabold text-latte-deep">
              {inv.total.toLocaleString()} บาท ·{" "}
              {inv.status === "paid" ? "✅ ชำระแล้ว" : "⏳ รอชำระ"}
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
