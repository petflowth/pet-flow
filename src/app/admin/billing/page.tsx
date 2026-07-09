"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SERVICE_PRESETS, type ServicePreset } from "@/lib/service-presets";
import {
  GROOM_PROGRAMS,
  GROOM_SIZES,
  groomPrice,
  groomProgram,
  groomSizeLabel,
  type GroomSize,
} from "@/lib/grooming-prices";

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
  subtotal?: number;
  discount?: number;
  deposit?: number;
  promoLabel?: string;
  status: string;
  customerName: string;
  catName: string;
  items?: { label: string; amount: number }[];
};

type ItemKind = "grooming" | "room" | "service" | "custom" | "freebie";
type Item = {
  kind: ItemKind;
  program: string;
  breed: string;
  size: GroomSize;
  roomLabel: string;
  roomPrice: number;
  nights: number;
  label: string;
  amount: number;
};

function newGrooming(): Item {
  const prog = GROOM_PROGRAMS[0];
  return {
    kind: "grooming",
    program: prog.id,
    breed: prog.breeds[0].breed,
    size: "m",
    roomLabel: "",
    roomPrice: 0,
    nights: 1,
    label: "",
    amount: 0,
  };
}

function computeLine(it: Item): { label: string; amount: number } {
  if (it.kind === "grooming") {
    const prog = groomProgram(it.program);
    return {
      label: `${prog?.name || "อาบน้ำ"} · ${it.breed} · ${groomSizeLabel(it.size)}`,
      amount: groomPrice(it.program, it.breed, it.size),
    };
  }
  if (it.kind === "room") {
    const n = Math.max(1, it.nights || 1);
    return {
      label: `${it.roomLabel || "ห้องพัก"} × ${n} คืน`,
      amount: (it.roomPrice || 0) * n,
    };
  }
  if (it.kind === "freebie") {
    return { label: `🎁 ${it.label || "ของแถม"} (ฟรี)`, amount: 0 };
  }
  return { label: it.label, amount: it.amount || 0 };
}

const KIND_OPTIONS: { id: ItemKind; label: string }[] = [
  { id: "grooming", label: "🛁 อาบน้ำ / กรูม" },
  { id: "room", label: "🏠 ห้องพัก" },
  { id: "service", label: "✨ บริการเสริม" },
  { id: "freebie", label: "🎁 ของแถม (ฟรี)" },
  { id: "custom", label: "✏️ พิมพ์เอง" },
];

const FREEBIE_PRESETS = [
  "กล้องวงจรปิด (CCTV)",
  "น้ำพุแมว",
  "รับ-ส่ง",
  "ขนม/ทรีท",
];

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
  const [deposit, setDeposit] = useState("");
  const [items, setItems] = useState<Item[]>([newGrooming()]);
  const [creating, setCreating] = useState(false);
  const [pay, setPay] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [shopName, setShopName] = useState("CatCha Hotel");
  const [billMsg, setBillMsg] = useState({
    summaryBookingTitle: "สรุปการจอง",
    summaryDepositTitle: "สรุปการจอง + แจ้งมัดจำ",
    summaryFullTitle: "สรุปการจอง + แจ้งยอดชำระ",
    summaryClosing: "",
  });
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

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
    setRooms(
      (config?.rooms || []).map((r: { name: string; price: number }) => ({
        label: `ห้อง ${r.name}`,
        amount: r.price,
      }))
    );
    if (config?.payment) setPay(config.payment);
    if (config?.business?.name) setShopName(config.business.name);
    if (config?.billing) setBillMsg(config.billing);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = customers.find((c) => c.id === customerId);

  const lines = items.map(computeLine);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
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
  const depositAmount = Math.min(total, Math.max(0, Number(deposit) || 0));
  const remaining = Math.max(0, total - depositAmount);

  const buildSummary = (mode: "booking" | "deposit" | "full") => {
    const catName = selected?.cats[0]?.name || "น้องแมว";
    const L: string[] = [];
    L.push(`🐾 ${shopName}`);
    L.push(
      mode === "deposit"
        ? billMsg.summaryDepositTitle
        : mode === "full"
          ? billMsg.summaryFullTitle
          : billMsg.summaryBookingTitle
    );
    L.push("");
    if (selected) L.push(`ลูกค้า: ${selected.name} · 🐱 ${catName}`);
    L.push("— รายการ —");
    for (const l of lines) {
      if (!l.label.trim()) continue;
      L.push(`• ${l.label}${l.amount > 0 ? ` — ${l.amount.toLocaleString()} บาท` : ""}`);
    }
    if (promoDiscount + manualDiscount > 0)
      L.push(`ส่วนลด: -${(promoDiscount + manualDiscount).toLocaleString()} บาท`);
    L.push(`ยอดสุทธิ: ${total.toLocaleString()} บาท`);
    if (mode === "deposit" && depositAmount > 0) {
      L.push(`มัดจำที่ต้องโอน: ${depositAmount.toLocaleString()} บาท`);
      L.push(`ยอดคงเหลือ (ชำระก่อนเข้าพัก): ${remaining.toLocaleString()} บาท`);
    }
    if (mode === "full") L.push(`ยอดที่ต้องโอน: ${total.toLocaleString()} บาท`);
    if (mode !== "booking" && pay.accountNumber) {
      L.push("");
      L.push("— โอนเงิน —");
      L.push(pay.bankName);
      L.push(`เลขบัญชี: ${pay.accountNumber}`);
      L.push(`ชื่อบัญชี: ${pay.accountName}`);
    }
    if (billMsg.summaryClosing) {
      L.push("");
      L.push(billMsg.summaryClosing);
    }
    return L.join("\n");
  };

  const sendSummaryLine = async (mode: "booking" | "deposit" | "full") => {
    if (!selected) return;
    if (!selected.lineUserId) return alert("ลูกค้ายังไม่ได้ผูก LINE — ส่งไม่ได้");
    setSending(true);
    const res = await fetch("/api/line/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: selected.lineUserId,
        text: buildSummary(mode),
      }),
    });
    setSending(false);
    alert(res.ok ? "ส่งเข้า LINE ลูกค้าแล้ว 📨" : "ส่งไม่สำเร็จ");
  };

  const copySummary = async (mode: "booking" | "deposit" | "full") => {
    try {
      await navigator.clipboard.writeText(buildSummary(mode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("ก๊อปไม่สำเร็จ");
    }
  };

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

  const pickCustomer = async (c: Customer) => {
    setCustomerId(c.id);
    setSearch(c.name);
    setShowList(false);
    setPromoId("");
    setAutoPromoLabel("");
    try {
      const res = await fetch(`/api/promos?autoFor=${c.id}&subtotal=${subtotal}`);
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

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const changeKind = (idx: number, kind: ItemKind) => {
    let patch: Partial<Item> = { kind };
    if (kind === "grooming") {
      const prog = GROOM_PROGRAMS[0];
      patch = { kind, program: prog.id, breed: prog.breeds[0].breed, size: "m" };
    } else if (kind === "room") {
      patch = {
        kind,
        roomLabel: rooms[0]?.label || "",
        roomPrice: rooms[0]?.amount || 0,
        nights: 1,
      };
    } else if (kind === "service") {
      patch = { kind, label: SERVICE_PRESETS[0].label, amount: SERVICE_PRESETS[0].amount };
    } else if (kind === "freebie") {
      patch = { kind, label: FREEBIE_PRESETS[0], amount: 0 };
    } else {
      patch = { kind, label: "", amount: 0 };
    }
    updateItem(idx, patch);
  };

  const changeProgram = (idx: number, program: string) => {
    const prog = groomProgram(program);
    updateItem(idx, { program, breed: prog?.breeds[0].breed || "" });
  };

  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  const createBill = async () => {
    if (!selected) return alert("เลือกลูกค้าก่อน");
    if (subtotal <= 0) return alert("ใส่รายการอย่างน้อย 1 อย่าง");
    setCreating(true);
    const cat = selected.cats[0]?.name || "น้องแมว";
    // เก็บของแถม (ฟรี) ด้วย — label มี แต่ยอด 0
    const payloadItems = lines.filter((l) => l.label.trim());
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        customerId: selected.id,
        lineUserId: selected.lineUserId,
        customerName: selected.name,
        catName: cat,
        items: payloadItems,
        promoId: promoId || undefined,
        extraDiscount: manualDiscount || undefined,
        deposit: depositAmount || undefined,
      }),
    });
    const data = await res.json();
    setCreating(false);
    if (data.invoice) {
      alert(`สร้างบิล ${data.invoice.id} — ${data.invoice.total} บาท`);
      setItems([newGrooming()]);
      setDiscount("");
      setDeposit("");
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

  const sub = "w-full rounded-lg border border-catcha-line bg-paper px-3 py-2 text-sm";
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
                    <li className="px-3 py-2 text-xs text-brown-soft">ไม่พบลูกค้า</li>
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

        {/* ── รายการ ── */}
        <div>
          <p className="mb-1 text-xs font-bold text-brown-soft">รายการ</p>
          <div className="space-y-2">
            {items.map((item, i) => {
              const line = computeLine(item);
              const prog = groomProgram(item.program);
              return (
                <div
                  key={i}
                  className="space-y-2 rounded-catcha-sm border border-catcha-line bg-paper/40 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={item.kind}
                      onChange={(e) => changeKind(i, e.target.value as ItemKind)}
                      className="min-w-0 flex-1 rounded-lg border border-catcha-line bg-card px-3 py-2 text-sm font-bold"
                    >
                      {KIND_OPTIONS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
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

                  {item.kind === "grooming" && (
                    <>
                      <select
                        value={item.program}
                        onChange={(e) => changeProgram(i, e.target.value)}
                        className={sub}
                      >
                        {GROOM_PROGRAMS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={item.breed}
                          onChange={(e) => updateItem(i, { breed: e.target.value })}
                          className={sub}
                        >
                          {prog?.breeds.map((b) => (
                            <option key={b.breed} value={b.breed}>
                              {b.breed}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.size}
                          onChange={(e) =>
                            updateItem(i, { size: e.target.value as GroomSize })
                          }
                          className={sub}
                        >
                          {GROOM_SIZES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {item.kind === "room" && (
                    <div className="flex gap-2">
                      <select
                        value={item.roomLabel}
                        onChange={(e) => {
                          const r = rooms.find((x) => x.label === e.target.value);
                          updateItem(i, {
                            roomLabel: e.target.value,
                            roomPrice: r?.amount || 0,
                          });
                        }}
                        className={`${sub} min-w-0 flex-1`}
                      >
                        {rooms.map((r) => (
                          <option key={r.label} value={r.label}>
                            {r.label} ({r.amount}฿/คืน)
                          </option>
                        ))}
                      </select>
                      <div className="flex shrink-0 items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={item.nights}
                          onChange={(e) =>
                            updateItem(i, { nights: Number(e.target.value) || 1 })
                          }
                          className="w-16 rounded-lg border border-catcha-line bg-paper px-2 py-2 text-center text-sm"
                        />
                        <span className="text-xs font-bold text-brown-soft">คืน</span>
                      </div>
                    </div>
                  )}

                  {item.kind === "service" && (
                    <select
                      value={item.label}
                      onChange={(e) => {
                        const p = SERVICE_PRESETS.find((x) => x.label === e.target.value);
                        updateItem(i, {
                          label: e.target.value,
                          amount: p?.amount ?? item.amount,
                        });
                      }}
                      className={sub}
                    >
                      {SERVICE_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {item.kind === "custom" && (
                    <input
                      value={item.label}
                      onChange={(e) => updateItem(i, { label: e.target.value })}
                      placeholder="พิมพ์ชื่อรายการ"
                      className={sub}
                    />
                  )}

                  {item.kind === "freebie" && (
                    <>
                      <input
                        value={item.label}
                        onChange={(e) => updateItem(i, { label: e.target.value })}
                        placeholder="ของแถม (เช่น กล้องวงจรปิด)"
                        list={`freebies-${i}`}
                        className={sub}
                      />
                      <datalist id={`freebies-${i}`}>
                        {FREEBIE_PRESETS.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] text-brown-faint">
                      {line.label}
                    </span>
                    {item.kind === "service" || item.kind === "custom" ? (
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={item.amount}
                        onChange={(e) =>
                          updateItem(i, { amount: Number(e.target.value) || 0 })
                        }
                        className="w-24 shrink-0 rounded-lg border border-catcha-line bg-paper px-3 py-1.5 text-right text-sm font-bold"
                      />
                    ) : item.kind === "freebie" ? (
                      <span className="shrink-0 text-sm font-extrabold text-ok">
                        ฟรี 🎁
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-extrabold text-latte-deep">
                        {line.amount.toLocaleString()} ฿
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newGrooming()])}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-catcha-sm border-2 border-dashed border-latte/60 bg-latte/10 py-2.5 text-sm font-extrabold text-latte-deep transition active:scale-[.98]"
          >
            <span className="text-lg">➕</span> เพิ่มรายการ
            <span className="text-lg">🧾</span>
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
          <div className="flex items-center justify-between gap-2 border-t border-catcha-line pt-1.5">
            <span className="text-xs font-bold text-brown-soft">💰 มัดจำ (ถ้ามี)</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              placeholder="0"
              className="w-24 rounded-lg border border-catcha-line bg-paper px-3 py-1.5 text-right text-sm"
            />
          </div>
          {depositAmount > 0 && (
            <div className="flex justify-between font-extrabold text-wait">
              <span>ยอดคงเหลือ (ก่อนเข้าพัก)</span>
              <span>{remaining.toLocaleString()} ฿</span>
            </div>
          )}
        </div>

        {/* ── สรุป (ก๊อป / ส่ง LINE ให้ลูกค้า) ── */}
        <div className="space-y-2 rounded-catcha-sm border border-catcha-line bg-card/80 p-2.5">
          <p className="text-[10px] font-bold text-brown-soft">
            สรุปให้ลูกค้า — ก๊อปไปแปะ หรือส่งเข้า LINE เลย
          </p>
          {(
            [
              ["booking", "📋 สรุปการจอง"],
              ["deposit", "💰 แจ้งมัดจำ"],
              ["full", "💳 แจ้งยอดเต็ม"],
            ] as const
          ).map(([mode, label]) => (
            <div key={mode} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-brown">
                {label}
              </span>
              <button
                type="button"
                onClick={() => copySummary(mode)}
                disabled={!selected}
                className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-[10px] font-bold text-brown-soft disabled:opacity-40"
              >
                📋 ก๊อป
              </button>
              <button
                type="button"
                onClick={() => sendSummaryLine(mode)}
                disabled={!selected || sending}
                className="shrink-0 rounded-full bg-[#06C755]/15 px-3 py-1.5 text-[10px] font-bold text-[#06883c] disabled:opacity-40"
              >
                💬 ส่ง LINE
              </button>
            </div>
          ))}
        </div>
        {copied && (
          <p className="text-center text-[11px] font-bold text-ok">✅ ก๊อปข้อความแล้ว — เอาไปแปะแชทลูกค้าได้เลย</p>
        )}

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

            {inv.items && inv.items.length > 0 && (
              <div className="mt-2 space-y-0.5 rounded-catcha-sm bg-paper/50 px-3 py-2 text-xs text-brown-soft">
                {inv.items.map((it, k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{it.label}</span>
                    <span className="shrink-0">{it.amount.toLocaleString()} ฿</span>
                  </div>
                ))}
                {inv.discount ? (
                  <div className="flex justify-between border-t border-catcha-line pt-0.5 text-wait">
                    <span>ส่วนลด{inv.promoLabel ? ` (${inv.promoLabel})` : ""}</span>
                    <span>-{inv.discount.toLocaleString()} ฿</span>
                  </div>
                ) : null}
              </div>
            )}

            <p className="mt-2 text-sm font-extrabold text-latte-deep">
              {inv.total.toLocaleString()} บาท ·{" "}
              {inv.status === "paid" ? "✅ ชำระแล้ว" : "⏳ รอชำระ"}
            </p>
            {inv.status === "pending" && (inv.deposit ?? 0) > 0 && (
              <p className="text-[11px] font-bold text-wait">
                💰 มัดจำ {inv.deposit!.toLocaleString()} · คงเหลือ{" "}
                {(inv.total - inv.deposit!).toLocaleString()} บาท
              </p>
            )}
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
