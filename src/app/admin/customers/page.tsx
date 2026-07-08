"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { CatRecord, CustomerRecord, MemberCreditUsageRecord, MemberTopupRecord } from "@/lib/customers-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { TIER_LABELS, tierBadgeClass } from "@/lib/customer-tier";
import { RegistrationQrSection } from "@/components/LineSetupSection";
import { customerTierLabels } from "@/lib/promos-store";
import type { PointsHistoryEntry } from "@/lib/points-store";
import type { Booking } from "@/lib/business";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";
import { BookingEditModal, type EditableBooking } from "@/components/BookingEditModal";

type Summary = {
  customer: CustomerRecord;
  points: number;
  visits: number;
  history: {
    bookings: Booking[];
    upcomingBookings: EditableBooking[];
    pastBookings: EditableBooking[];
    services: { id: string; service: string; date: string; amount?: number; catName: string }[];
    points: PointsHistoryEntry[];
    memberTopups: MemberTopupRecord[];
    memberCreditUsage: MemberCreditUsageRecord[];
  };
};

type CustomerListItem = CustomerRecord & { upcomingAppointments?: number };

function bookingWhen(b: EditableBooking) {
  if (b.service === "room" || b.checkin) {
    return `${b.checkin || b.date}${b.checkout ? ` → ${b.checkout}` : ""}`;
  }
  return `${b.date}${b.time ? ` ${b.time}` : ""}`;
}

function statusLabel(status: Booking["status"]) {
  if (status === "confirmed") return "ยืนยันแล้ว";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return "รอยืนยัน";
}

function CustomerAppointmentsSection({
  bookings,
  onRefresh,
}: {
  bookings: EditableBooking[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<EditableBooking | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string; size: string; price: number }[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config?.rooms) setRooms(d.config.rooms);
        if (d.config?.groomSlots) setGroomSlots(d.config.groomSlots);
      });
  }, []);

  const cancelBooking = async (b: EditableBooking) => {
    if (!confirm(`ยกเลิกนัด ${b.catName} · ${b.date}?`)) return;
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, action: "cancel" }),
    });
    if (res.ok) {
      alert("ยกเลิกนัดแล้ว");
      onRefresh();
    } else {
      alert("ยกเลิกไม่สำเร็จ");
    }
  };

  return (
    <section className="mb-4 rounded-catcha bg-card p-4">
      {editing && (
        <BookingEditModal
          booking={editing}
          rooms={rooms}
          groomSlots={groomSlots}
          onClose={() => setEditing(null)}
          onSaved={onRefresh}
        />
      )}
      <h2 className="mb-2 text-sm font-extrabold text-catcha-chocolate">📅 นัดหมาย</h2>
      {bookings.length === 0 ? (
        <p className="text-xs text-brown-soft">ยังไม่มีนัดที่กำลังจะมาถึง</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-catcha-sm border border-catcha-line bg-paper/50 p-3"
            >
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-brown">
                    {b.catName} · {b.service === "room" ? "🏠 ห้องพัก" : "🛁 อาบน้ำ"}
                  </p>
                  <p className="text-xs text-brown-soft">{bookingWhen(b)}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      b.status === "confirmed"
                        ? "bg-sage/20 text-ok"
                        : "bg-honey/25 text-wait"
                    }`}
                  >
                    {statusLabel(b.status)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(b)}
                  className="rounded-full bg-honey/25 px-2.5 py-1 text-[10px] font-bold text-catcha-chocolate"
                >
                  ✏️ แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => cancelBooking(b)}
                  className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-wait"
                >
                  ❌ ยกเลิก
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const MEMBER_PROMOS = [
  { label: "10,000 → 12,000", paid: 10000, bonus: 2000 },
  { label: "5,000 → 5,500", paid: 5000, bonus: 500 },
  { label: "3,000 → 3,200", paid: 3000, bonus: 200 },
] as const;

function MemberTopupSection({
  customerId,
  memberCredit,
  onDone,
}: {
  customerId: string;
  memberCredit: number;
  onDone: () => void;
}) {
  const [paid, setPaid] = useState("");
  const [bonus, setBonus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const paidNum = Math.max(0, Number(paid) || 0);
  const bonusNum = Math.max(0, Number(bonus) || 0);
  const total = paidNum + bonusNum;

  const applyPromo = (p: number, b: number) => {
    setPaid(String(p));
    setBonus(String(b));
    setMsg("");
  };

  const submit = async () => {
    if (total <= 0) {
      setMsg("กรอกยอดรับเงินหรือแถมอย่างน้อย 1 บาท");
      return;
    }
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customerId,
        action: "topup_member",
        paidAmount: paidNum,
        bonusAmount: bonusNum,
        note: note.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setPaid("");
      setBonus("");
      setNote("");
      setMsg(`✅ เติมสำเร็จ +${total.toLocaleString()} บาท (คงเหลือ ${data.customer.memberCredit.toLocaleString()} บาท)`);
      onDone();
    } else {
      setMsg("❌ บันทึกไม่สำเร็จ");
    }
  };

  return (
    <section className="mb-4 rounded-catcha bg-card p-4">
      <h2 className="mb-1 text-sm font-extrabold">💎 เติมเครดิต Member</h2>
      <p className="mb-3 text-[10px] text-brown-soft">
        คงเหลือ <span className="font-bold text-latte-deep">{memberCredit.toLocaleString()} บาท</span>
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-bold text-brown-soft">
          💵 รับเงินจริง (บาท)
          <input
            type="number"
            min={0}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder="10000"
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm font-bold text-catcha-chocolate"
          />
        </label>
        <label className="block text-[10px] font-bold text-brown-soft">
          🎁 แถมเครดิต (บาท)
          <input
            type="number"
            min={0}
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            placeholder="2000"
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm font-bold text-latte-deep"
          />
        </label>
      </div>

      {total > 0 && (
        <p className="mb-3 rounded-catcha-sm bg-honey/20 px-3 py-2 text-center text-xs font-bold text-catcha-chocolate">
          ลูกค้าได้เครดิตรวม <span className="text-base">{total.toLocaleString()}</span> บาท
          {bonusNum > 0 && (
            <span className="block text-[10px] font-normal text-brown-soft">
              (จ่าย {paidNum.toLocaleString()} + แถม {bonusNum.toLocaleString()})
            </span>
          )}
        </p>
      )}

      <p className="mb-2 text-[10px] font-bold text-brown-faint">โปรด่วน</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {MEMBER_PROMOS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPromo(p.paid, p.bonus)}
            className="rounded-full bg-honey/30 px-3 py-1.5 text-[10px] font-bold text-catcha-chocolate"
          >
            {p.label}
          </button>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="โน้ต (ถ้ามี) เช่น โปรปีใหม่"
        className="mb-3 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-xs"
      />

      <button
        type="button"
        disabled={saving || total <= 0}
        onClick={submit}
        className="w-full rounded-catcha-sm bg-latte/30 py-2.5 text-sm font-extrabold text-catcha-chocolate disabled:opacity-40"
      >
        {saving ? "กำลังบันทึก…" : `บันทึกเติม Member +${total > 0 ? total.toLocaleString() : "—"} บาท`}
      </button>

      {msg && (
        <p className="mt-2 text-center text-[10px] font-bold text-brown">{msg}</p>
      )}
    </section>
  );
}

function MemberCreditHistorySection({
  memberCredit,
  topups,
  usage,
}: {
  memberCredit: number;
  topups: MemberTopupRecord[];
  usage: MemberCreditUsageRecord[];
}) {
  const totalToppedUp = topups.reduce((s, t) => s + t.creditAdded, 0);
  const totalUsed = usage.reduce((s, u) => s + u.amount, 0);

  type LedgerRow =
    | { kind: "topup"; at: string; topup: MemberTopupRecord }
    | { kind: "usage"; at: string; usage: MemberCreditUsageRecord };

  const ledger: LedgerRow[] = [
    ...topups.map((t) => ({ kind: "topup" as const, at: t.createdAt, topup: t })),
    ...usage.map((u) => ({ kind: "usage" as const, at: u.at, usage: u })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (!topups.length && !usage.length && memberCredit <= 0) return null;

  return (
    <section className="mb-4 rounded-catcha bg-card p-4">
      <h2 className="mb-1 text-sm font-extrabold text-catcha-chocolate">📒 ประวัติเครดิต Member</h2>
      <p className="mb-3 text-[10px] text-brown-soft">
        คงเหลือ{" "}
        <span className="font-bold text-latte-deep">{memberCredit.toLocaleString()} บาท</span>
        {totalToppedUp > 0 && (
          <>
            {" · "}
            เติมรวม {totalToppedUp.toLocaleString()} บาท
          </>
        )}
        {totalUsed > 0 && (
          <>
            {" · "}
            ใช้ไป {totalUsed.toLocaleString()} บาท
          </>
        )}
      </p>

      {ledger.length === 0 ? (
        <p className="text-xs text-brown-soft">ยังไม่มีประวัติเติม/ใช้เครดิต</p>
      ) : (
        <ul className="space-y-2">
          {ledger.map((row) =>
            row.kind === "topup" ? (
              <li
                key={row.topup.id}
                className="rounded-catcha-sm border border-catcha-line bg-paper/50 px-3 py-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-ok">+ เติมเครดิต</p>
                    <p className="text-brown-soft">
                      {row.topup.createdAt.slice(0, 10)} · รับ {row.topup.paidAmount.toLocaleString()} บาท
                      {row.topup.bonusAmount > 0 && (
                        <> · แถม {row.topup.bonusAmount.toLocaleString()} บาท</>
                      )}
                    </p>
                    {row.topup.note && (
                      <p className="text-[10px] text-brown-faint">{row.topup.note}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-ok">
                      +{row.topup.creditAdded.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-brown-faint">
                      คงเหลือ {row.topup.balanceAfter.toLocaleString()}
                    </p>
                  </div>
                </div>
              </li>
            ) : (
              <li
                key={row.usage.id}
                className="rounded-catcha-sm border border-catcha-line bg-paper/50 px-3 py-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-wait">− ใช้เครดิต</p>
                    <p className="text-brown-soft">
                      {row.usage.date} · {row.usage.description}
                    </p>
                  </div>
                  <p className="font-extrabold text-wait">−{row.usage.amount.toLocaleString()}</p>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}

function CustomerSummaryCard({
  customer,
  points,
  visits,
  onSaved,
}: {
  customer: CustomerRecord;
  points: number;
  visits: number;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [tier, setTier] = useState<CustomerTier>(customer.tier || "new");
  const [msg, setMsg] = useState("");
  const heroCat = customer.cats.find((cat) => cat.photoDataUrl) || customer.cats[0];
  const tiers = customerTierLabels(customer, visits);

  useEffect(() => {
    setName(customer.name);
    setPhone(customer.phone || "");
    setTier(customer.tier || "new");
  }, [customer.id, customer.name, customer.phone, customer.tier]);

  const save = async (patch: { name?: string; phone?: string }) => {
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer.id,
        action: "update_customer",
        patch,
      }),
    });
    if (res.ok) {
      setMsg("✅ บันทึกแล้ว");
      onSaved();
      setTimeout(() => setMsg(""), 2000);
    }
  };

  return (
    <section className="mb-4 overflow-hidden rounded-catcha bg-gradient-to-br from-honey/45 via-card to-latte/15 p-5 shadow-catcha">
      <div className="mb-4 flex items-start gap-3">
        {heroCat?.photoDataUrl ? (
          <Image
            src={heroCat.photoDataUrl}
            alt={heroCat.name}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-catcha-sm object-cover ring-2 ring-white/70"
            unoptimized
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-catcha-sm bg-card/80 text-3xl ring-2 ring-white/70">
            {customer.cats.length > 0 ? "🐱" : "👤"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-brown-soft">ข้อมูลลูกค้า</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-catcha-chocolate">
            {customer.name}
            {customer.isMember && (
              <span className="ml-2 align-middle text-sm font-extrabold text-latte-deep">💎 Member</span>
            )}
          </h1>
          {customer.lineDisplayName && customer.lineDisplayName !== customer.name && (
            <p className="mt-1 text-[10px] text-brown-soft">
              ชื่อใน LINE: <span className="font-bold text-brown">{customer.lineDisplayName}</span>
            </p>
          )}
          {customer.lineUserId && (
            <p className="mt-2 inline-block rounded-full bg-sage/20 px-2.5 py-0.5 text-[10px] font-bold text-ok">
              ✅ ผูก LINE แล้ว
            </p>
          )}
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold text-brown-soft">กลุ่มลูกค้า (Tier)</p>
            <div className="flex flex-wrap gap-1.5">
              {tiers.map((t) => (
                <span
                  key={t.id}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    t.id === "member"
                      ? "bg-latte/30 text-latte-deep"
                      : t.id === "new"
                        ? "bg-honey/30 text-catcha-chocolate"
                        : "bg-paper text-brown-soft"
                  }`}
                >
                  {t.label}
                </span>
              ))}
            </div>
            <p className="mt-1 text-[9px] text-brown-faint">
              ใช้กำหนดว่าเห็นโปรไหน · Member = เติมเครดิตแล้ว
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-catcha-sm bg-card/80 px-2 py-2.5 text-center shadow-catcha-sm">
          <p className="text-[10px] font-bold text-brown-soft">แต้ม</p>
          <p className="text-lg font-extrabold text-latte-deep">{points}</p>
        </div>
        <div className="rounded-catcha-sm bg-card/80 px-2 py-2.5 text-center shadow-catcha-sm">
          <p className="text-[10px] font-bold text-brown-soft">มาใช้บริการ</p>
          <p className="text-lg font-extrabold text-catcha-chocolate">{visits}</p>
          <p className="text-[10px] text-brown-faint">ครั้ง</p>
        </div>
        <div className="rounded-catcha-sm bg-card/80 px-2 py-2.5 text-center shadow-catcha-sm">
          <p className="text-[10px] font-bold text-brown-soft">เครดิต</p>
          <p className="text-lg font-extrabold text-catcha-chocolate">
            {customer.memberCredit.toLocaleString()}
          </p>
          <p className="text-[10px] text-brown-faint">บาท</p>
        </div>
      </div>

      <div className="space-y-3 rounded-catcha-sm border border-white/60 bg-card/70 p-3">
        <label className="block text-xs font-bold text-brown-soft">
          ชื่อที่ใช้ในร้าน (ตั้งเองได้)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (trimmed && trimmed !== customer.name) save({ name: trimmed });
            }}
            placeholder="เช่น คุณแม่น้องมะลิ"
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm font-bold text-brown"
          />
        </label>

        <label className="block text-xs font-bold text-brown-soft">
          เบอร์โทร
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => {
              if (phone.trim() !== (customer.phone || "")) save({ phone: phone.trim() || undefined });
            }}
            placeholder="08x-xxx-xxxx"
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <label className="mt-3 block text-xs font-bold text-brown-soft">
        ระดับลูกค้า
        <div className="mt-1 flex flex-wrap gap-2">
          {(Object.keys(TIER_LABELS) as CustomerTier[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={async () => {
                const res = await fetch("/api/customers", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: customer.id,
                    action: "set_tier",
                    tier: t,
                  }),
                });
                if (res.ok) {
                  setTier(t);
                  setMsg("✅ อัปเดตระดับแล้ว");
                  onSaved();
                  setTimeout(() => setMsg(""), 2000);
                }
              }}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                tier === t ? tierBadgeClass(t) : "bg-paper text-brown-faint"
              }`}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              const res = await fetch("/api/customers", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: customer.id,
                  action: "recalculate_tier",
                }),
              });
              const data = await res.json();
              if (res.ok && data.customer?.tier) {
                setTier(data.customer.tier);
                setMsg("✅ คำนวณระดับใหม่แล้ว");
                onSaved();
                setTimeout(() => setMsg(""), 2000);
              }
            }}
            className="rounded-full bg-paper px-3 py-1.5 text-[10px] font-bold text-brown-soft"
          >
            🔄 คำนวณอัตโนมัติ
          </button>
        </div>
      </label>

      {msg && <p className="mt-2 text-center text-[10px] font-bold text-ok">{msg}</p>}
    </section>
  );
}

function AddCatForm({ customerId, onAdded }: { customerId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setName("");
    setNote("");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customerId,
        action: "add_cat",
        name: name.trim(),
        staffNote: note.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && data.ok) {
      close();
      onAdded();
    } else {
      setError(data.error || "บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-catcha-sm border border-dashed border-latte/50 bg-paper/50 py-2.5 text-xs font-extrabold text-latte-deep"
      >
        ➕ เพิ่มน้องแมว
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-catcha bg-card p-5 shadow-catcha">
            <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">➕ เพิ่มน้องแมว</h2>
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs font-bold text-brown-soft">
                ชื่อน้องแมว *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น น้องจู๊ด"
                  required
                  autoFocus
                  className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm font-bold"
                />
              </label>
              <label className="block text-xs font-bold text-brown-soft">
                โน้ตนิสัย (ถ้ามี)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น แมวดุ อาบยาก กลัวเสียง"
                  rows={3}
                  className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-xs"
                />
              </label>
              {error && <p className="text-xs font-bold text-wait">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-catcha-sm bg-paper py-2.5 text-xs font-bold text-brown-soft"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex-1 rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-2.5 text-xs font-extrabold text-catcha-chocolate disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก…" : "💾 บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [list, setList] = useState<CustomerListItem[]>([]);
  const [selected, setSelected] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/customers${params}`);
    const data = await res.json();
    setList(data.customers || []);
    setLoading(false);
  }, []);

  const open = useCallback(async (id: string) => {
    const res = await fetch(`/api/customers?id=${id}`);
    const data = await res.json();
    setSelected(data);
  }, []);

  useEffect(() => {
    search("");
  }, [search]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) open(id);
  }, [searchParams, open]);

  const saveCat = async (
    catId: string,
    patch: { name?: string; staffNote?: string; photoDataUrl?: string }
  ) => {
    if (!selected) return;
    await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "update_cat",
        catId,
        patch,
      }),
    });
    open(selected.customer.id);
  };

  const deleteCatProfile = async (cat: CatRecord) => {
    if (!selected) return;
    if (!confirm(`ลบโปรไฟล์ ${cat.name}?`)) return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "delete_cat",
        catId: cat.id,
      }),
    });
    if (res.ok) open(selected.customer.id);
    else alert("ลบไม่สำเร็จ");
  };

  const saveCatNote = async (catId: string, staffNote: string, photoDataUrl?: string) => {
    await saveCat(catId, { staffNote, ...(photoDataUrl ? { photoDataUrl } : {}) });
  };


  const onPhoto = (cat: CatRecord, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      saveCatNote(cat.id, cat.staffNote || "", String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  if (selected) {
    const c = selected.customer;
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-3 text-xs font-bold text-brown-soft"
        >
          ← กลับ
        </button>
        <CustomerSummaryCard
          customer={c}
          points={selected.points}
          visits={selected.visits}
          onSaved={() => open(c.id)}
        />

        <section className="mb-4 space-y-3">
          <h2 className="text-sm font-extrabold text-catcha-chocolate">
            🐱 น้องแมว ({c.cats.length}) — โน้ตแยกแต่ละตัว
          </h2>

          <AddCatForm customerId={c.id} onAdded={() => open(c.id)} />

          {c.cats.length === 0 && (
            <p className="text-xs text-brown-soft">ยังไม่มีน้องแมว — กดปุ่มด้านบนเพื่อเพิ่ม</p>
          )}
          {c.cats.map((cat) => (
            <div key={cat.id} className="rounded-catcha border border-catcha-line bg-card p-4">
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => deleteCatProfile(cat)}
                  className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-wait"
                >
                  🗑️ ลบ
                </button>
              </div>
              <div className="flex gap-3">
                {cat.photoDataUrl ? (
                  <Image
                    src={cat.photoDataUrl}
                    alt={cat.name}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] rounded-catcha-sm object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-catcha-sm bg-paper text-2xl">
                    🐱
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-brown-soft">
                    ชื่อน้องแมว
                    <input
                      defaultValue={cat.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== cat.name) saveCat(cat.id, { name: v });
                      }}
                      className="mt-0.5 w-full rounded-catcha-sm border border-catcha-line bg-paper px-2 py-1.5 text-sm font-bold text-brown"
                    />
                  </label>
                  <label className="mt-2 block text-[10px] font-bold text-brown-soft">
                    โน้ตนิสัย (เฉพาะตัวนี้)
                    <textarea
                      defaultValue={cat.staffNote}
                      placeholder="เช่น แมวดุ อาบยาก ชอบให้ใส่ตะกร้า"
                      className="mt-0.5 w-full rounded-catcha-sm border border-catcha-line bg-paper px-2 py-1.5 text-xs"
                      rows={2}
                      onBlur={(e) => saveCatNote(cat.id, e.target.value, cat.photoDataUrl)}
                    />
                  </label>
                  <label className="mt-2 block text-[10px] font-bold text-latte-deep">
                    📷 อัปโหลดรูป (เห็นเฉพาะหลังบ้าน)
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-1 block w-full text-[10px]"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPhoto(cat, f);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </section>

        <MemberTopupSection
          customerId={c.id}
          memberCredit={c.memberCredit}
          onDone={() => open(c.id)}
        />

        <MemberCreditHistorySection
          memberCredit={c.memberCredit}
          topups={selected.history.memberTopups || []}
          usage={selected.history.memberCreditUsage || []}
        />

        <CustomerAppointmentsSection
          bookings={selected.history.upcomingBookings || []}
          onRefresh={() => open(c.id)}
        />

        <section className="mb-4 rounded-catcha bg-card p-4">
          <h2 className="mb-2 text-sm font-extrabold">📋 ประวัติใช้บริการ</h2>
          <ul className="space-y-2 text-xs text-brown-soft">
            {selected.history.services.map((s) => (
              <li key={s.id}>
                {s.date} · {s.catName} · {s.service}
                {s.amount ? ` · ${s.amount} บาท` : ""}
              </li>
            ))}
            {(selected.history.pastBookings || []).map((b) => (
              <li key={b.id}>
                {b.date} · {b.catName} · {b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} ·{" "}
                {statusLabel(b.status)}
              </li>
            ))}
            {!selected.history.services.length &&
              !(selected.history.pastBookings || []).length && <li>ยังไม่มีประวัติ</li>}
          </ul>
        </section>

        <section className="rounded-catcha bg-card p-4">
          <h2 className="mb-2 text-sm font-extrabold">🎁 ประวัติแลกแต้ม</h2>
          <ul className="space-y-2 text-xs text-brown-soft">
            {selected.history.points.map((p) => (
              <li key={p.id}>
                {p.at.slice(0, 10)} · {p.labelTh} · {p.points > 0 ? "+" : ""}
                {p.points} แต้ม
              </li>
            ))}
            {!selected.history.points.length && <li>ยังไม่มีประวัติแต้ม</li>}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">👤 ลูกค้า</h1>
      <RegistrationQrSection compact />
      <ExportSheetsButton className="mb-4 mt-4" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && search(q)}
        placeholder="ค้นหาชื่อลูกค้า / ชื่อแมว / เบอร์"
        className="mb-4 w-full rounded-catcha-sm border border-catcha-line bg-card px-4 py-3 text-sm"
      />
      <button
        type="button"
        onClick={() => search(q)}
        className="mb-4 w-full rounded-catcha-sm bg-latte/25 py-2.5 text-sm font-bold text-catcha-chocolate"
      >
        🔍 ค้นหา
      </button>

      {loading ? (
        <p className="text-center text-sm text-brown-soft">กำลังโหลด…</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                className="w-full rounded-catcha border border-catcha-line bg-card p-4 text-left shadow-catcha-sm"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-bold text-brown">
                      {c.cats[0]?.name || "—"} · {c.name}
                      <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] ${tierBadgeClass(c.tier || "new")}`}>
                        {TIER_LABELS[c.tier || "new"]}
                      </span>
                      {c.isMember && " 💎"}
                      {(c.upcomingAppointments ?? 0) > 0 && (
                        <span className="ml-1 rounded-full bg-honey/30 px-2 py-0.5 text-[10px] font-bold text-catcha-chocolate">
                          📅 {c.upcomingAppointments} นัด
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-brown-soft">
                      {c.cats.map((cat) => cat.staffNote).filter(Boolean).join(" · ") || "แตะดูประวัติ"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-latte-deep">
                    {c.memberCredit > 0 ? `${c.memberCredit} ฿` : "→"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
