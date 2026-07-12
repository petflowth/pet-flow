"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import { TIER_LABELS } from "@/lib/customer-tier";

type Offer = { id: string; title: string; amount: number; reason: string; validDays: number; active: boolean };
type Coupon = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  customerName?: string;
  expiresAt?: string;
};

type Stats = {
  couponSummary: {
    total: number;
    active: number;
    used: number;
    expired: number;
    cancelled: number;
    valueUsed: number;
    valueOutstanding: number;
  };
  perOffer: { id: string; title: string; amount: number; issued: number; used: number; valueUsed: number; rate: number }[];
  referral: { issued: number; used: number; valueUsed: number };
  perPromo: { id: string; title: string; active: boolean; claims: number; uses: number; discount: number }[];
};

const TIERS = ["all", "new", "regular", "member", "vip"] as const;

export default function AdminCouponsPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [validDays, setValidDays] = useState("60");
  const [busy, setBusy] = useState("");
  const [tierByOffer, setTierByOffer] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      fetch("/api/coupons/offers").then((r) => r.json()),
      fetch("/api/coupons/stats").then((r) => r.json()),
    ]);
    setOffers(d.offers || []);
    setCoupons(d.coupons || []);
    setStats(s);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createOffer = async () => {
    const amt = Math.round(Number(amount) || 0);
    if (!title.trim() || amt <= 0) return toast("ใส่ชื่อแคมเปญ + มูลค่า", "error");
    setBusy("create");
    try {
      const res = await fetch("/api/coupons/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), amount: amt, validDays: Number(validDays) || 60 }),
      });
      if (res.ok) {
        toast("สร้างแคมเปญคูปองแล้ว 🎟️", "success");
        setTitle("");
        setAmount("");
        load();
      } else toast("สร้างไม่สำเร็จ", "error");
    } finally {
      setBusy("");
    }
  };

  const blast = async (offer: Offer) => {
    const tier = tierByOffer[offer.id] || "all";
    if (!confirm(`ยิงการ์ดคูปอง "${offer.title}" (฿${offer.amount}) ไปหา ${tier === "all" ? "ลูกค้าทุกกลุ่ม" : TIER_LABELS[tier as keyof typeof TIER_LABELS]}?`))
      return;
    setBusy("blast:" + offer.id);
    try {
      const res = await fetch("/api/coupons/offers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "blast", offerId: offer.id, tier }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) toast(`ยิงการ์ดแล้ว ส่งสำเร็จ ${d.sent} คน 🎟️`, "success");
      else toast(d.error ? `ไม่สำเร็จ: ${d.error}` : "ยิงไม่สำเร็จ", "error");
    } finally {
      setBusy("");
    }
  };

  const toggleOffer = async (offer: Offer) => {
    await fetch("/api/coupons/offers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_active", offerId: offer.id, active: !offer.active }),
    });
    load();
  };

  const cancelCoupon = async (c: Coupon) => {
    if (!confirm(`ยกเลิกคูปอง ฿${c.amount} ของ ${c.customerName}?`)) return;
    await fetch("/api/coupons/offers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_coupon", couponId: c.id }),
    });
    toast("ยกเลิกคูปองแล้ว", "success");
    load();
  };

  const statusLabel: Record<string, string> = {
    active: "🟢 ใช้ได้",
    used: "✅ ใช้แล้ว",
    expired: "⛔ หมดอายุ",
    cancelled: "🚫 ยกเลิก",
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">🎟️ คูปอง & แคมเปญ</h1>

      {/* ── สถิติ ── */}
      {stats && (
        <div className="mb-5 space-y-3">
          <p className="text-xs font-extrabold text-catcha-chocolate">📊 สถิติคูปอง</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-catcha-sm bg-latte/15 p-2.5">
              <p className="text-[10px] font-bold text-brown-soft">ออกไปทั้งหมด</p>
              <p className="text-lg font-extrabold text-latte-deep">{stats.couponSummary.total}</p>
            </div>
            <div className="rounded-catcha-sm bg-sage/15 p-2.5">
              <p className="text-[10px] font-bold text-brown-soft">ใช้แล้ว</p>
              <p className="text-lg font-extrabold text-ok">{stats.couponSummary.used}</p>
            </div>
            <div className="rounded-catcha-sm bg-honey/20 p-2.5">
              <p className="text-[10px] font-bold text-brown-soft">ยังไม่ใช้</p>
              <p className="text-lg font-extrabold text-catcha-chocolate">{stats.couponSummary.active}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-catcha-sm bg-sage/10 p-2.5">
              <p className="text-[10px] font-bold text-brown-soft">💸 ส่วนลดที่ถูกใช้ไป</p>
              <p className="text-base font-extrabold text-ok">
                {stats.couponSummary.valueUsed.toLocaleString()} ฿
              </p>
            </div>
            <div className="rounded-catcha-sm bg-wait/10 p-2.5">
              <p className="text-[10px] font-bold text-brown-soft">⏳ คูปองค้าง (ภาระ)</p>
              <p className="text-base font-extrabold text-wait">
                {stats.couponSummary.valueOutstanding.toLocaleString()} ฿
              </p>
            </div>
          </div>

          <div className="rounded-catcha-sm border border-honey/40 bg-honey/10 p-3 text-xs">
            <span className="font-extrabold text-catcha-chocolate">🎁 ชวนเพื่อน:</span>{" "}
            ออกคูปอง {stats.referral.issued} ใบ · ใช้แล้ว {stats.referral.used} ใบ · ส่วนลด{" "}
            {stats.referral.valueUsed.toLocaleString()} ฿
          </div>

          {stats.perOffer.length > 0 && (
            <div className="overflow-x-auto rounded-catcha-sm border border-catcha-line">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-paper text-brown-soft">
                  <tr>
                    <th className="px-2 py-1.5 font-bold">แคมเปญ</th>
                    <th className="px-2 py-1.5 text-center font-bold">ออก</th>
                    <th className="px-2 py-1.5 text-center font-bold">ใช้</th>
                    <th className="px-2 py-1.5 text-center font-bold">อัตราใช้</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perOffer.map((o) => (
                    <tr key={o.id} className="border-t border-catcha-line">
                      <td className="px-2 py-1.5 font-bold text-brown">
                        {o.title} <span className="text-brown-faint">฿{o.amount}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center">{o.issued}</td>
                      <td className="px-2 py-1.5 text-center text-ok">{o.used}</td>
                      <td className="px-2 py-1.5 text-center font-bold">{o.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="pt-1 text-xs font-extrabold text-catcha-chocolate">✨ สถิติโปรโมชั่น</p>
          {stats.perPromo.length === 0 ? (
            <p className="rounded-catcha-sm bg-paper px-3 py-2 text-center text-[11px] text-brown-soft">
              ยังไม่มีโปรโมชั่น
            </p>
          ) : (
            <div className="overflow-x-auto rounded-catcha-sm border border-catcha-line">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-paper text-brown-soft">
                  <tr>
                    <th className="px-2 py-1.5 font-bold">โปร</th>
                    <th className="px-2 py-1.5 text-center font-bold">กดรับ</th>
                    <th className="px-2 py-1.5 text-center font-bold">ใช้จริง</th>
                    <th className="px-2 py-1.5 text-center font-bold">ส่วนลดรวม</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perPromo.map((p) => (
                    <tr key={p.id} className="border-t border-catcha-line">
                      <td className="px-2 py-1.5 font-bold text-brown">
                        {p.title}
                        {!p.active && <span className="text-brown-faint"> (ปิด)</span>}
                      </td>
                      <td className="px-2 py-1.5 text-center">{p.claims}</td>
                      <td className="px-2 py-1.5 text-center text-ok">{p.uses}</td>
                      <td className="px-2 py-1.5 text-center font-bold">
                        {p.discount.toLocaleString()} ฿
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* สร้างแคมเปญ */}
      <div className="mb-5 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <p className="text-xs font-extrabold text-catcha-chocolate">
          ➕ สร้างแคมเปญคูปอง (ส่งการ์ดให้ลูกค้ากดรับ)
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ชื่อแคมเปญ เช่น ปีใหม่แจกส่วนลด 100฿"
          className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ส่วนลด (บาท)"
            className="min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
          />
          <div className="flex shrink-0 items-center gap-1">
            <input
              type="number"
              value={validDays}
              onChange={(e) => setValidDays(e.target.value)}
              className="w-16 rounded-catcha-sm border border-catcha-line bg-paper px-2 py-2 text-sm"
            />
            <span className="text-xs text-brown-soft">วัน</span>
          </div>
        </div>
        <button
          type="button"
          disabled={busy === "create"}
          onClick={createOffer}
          className="w-full rounded-catcha-sm bg-honey/40 py-2.5 text-sm font-extrabold text-catcha-chocolate disabled:opacity-50"
        >
          สร้างแคมเปญ
        </button>
      </div>

      {/* แคมเปญ */}
      <h2 className="mb-2 text-sm font-extrabold">แคมเปญ ({offers.length})</h2>
      <ul className="mb-6 space-y-2">
        {offers.length === 0 && (
          <li className="rounded-catcha-sm bg-paper px-3 py-3 text-center text-xs text-brown-soft">
            ยังไม่มีแคมเปญ
          </li>
        )}
        {offers.map((o) => (
          <li key={o.id} className="rounded-catcha border border-catcha-line bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-brown">{o.title}</p>
                <p className="text-[11px] text-brown-soft">
                  ฿{o.amount} · ใช้ได้ {o.validDays} วัน · {o.active ? "🟢 เปิด" : "⏸️ ปิด"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggleOffer(o)}
                className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-brown-soft"
              >
                {o.active ? "ปิดแคมเปญ" : "เปิด"}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={tierByOffer[o.id] || "all"}
                onChange={(e) => setTierByOffer((p) => ({ ...p, [o.id]: e.target.value }))}
                className="rounded-catcha-sm border border-catcha-line bg-paper px-2 py-1.5 text-xs"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t === "all" ? "ทุกกลุ่ม" : TIER_LABELS[t as keyof typeof TIER_LABELS]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!o.active || busy === "blast:" + o.id}
                onClick={() => blast(o)}
                className="rounded-full bg-latte-deep px-3 py-1.5 text-xs font-extrabold text-card disabled:opacity-40"
              >
                {busy === "blast:" + o.id ? "กำลังส่ง…" : "🎟️ ยิงการ์ดหากลุ่มนี้"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* คูปองทั้งหมด */}
      <h2 className="mb-2 text-sm font-extrabold">คูปองทั้งหมด ({coupons.length})</h2>
      <ul className="space-y-2">
        {coupons.length === 0 && (
          <li className="rounded-catcha-sm bg-paper px-3 py-3 text-center text-xs text-brown-soft">
            ยังไม่มีคูปอง
          </li>
        )}
        {coupons.map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-2 rounded-catcha-sm border border-catcha-line bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-brown">
                ฿{c.amount} · {c.customerName}
              </p>
              <p className="truncate text-[10px] text-brown-faint">
                {c.reason} · {statusLabel[c.status] || c.status}
              </p>
            </div>
            {c.status === "active" && (
              <button
                type="button"
                onClick={() => cancelCoupon(c)}
                className="shrink-0 text-[10px] font-bold text-wait"
              >
                🚫 ยกเลิก
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
