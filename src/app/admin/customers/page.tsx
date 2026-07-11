"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { CatRecord, CustomerRecord, MemberCreditUsageRecord, MemberTopupRecord } from "@/lib/customers-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { TIER_LABELS, tierBadgeClass } from "@/lib/customer-tier";
import { catCurrentAgeLabel } from "@/lib/cat-age";
import { RegistrationQrSection } from "@/components/LineSetupSection";
import { AddCustomerModal } from "@/components/AddCustomerModal";
import { toast } from "@/components/Toast";
import { CustomerLinkSection } from "@/components/CustomerLinkSection";
import type { PointsHistoryEntry } from "@/lib/points-store";
import type { Booking } from "@/lib/business";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";
import { BookingEditModal, type EditableBooking } from "@/components/BookingEditModal";

type Summary = {
  customer: CustomerRecord;
  points: number;
  visits: number;
  lastVisitDate?: string | null;
  daysSinceVisit?: number | null;
  inactive?: boolean;
  canFollowUp?: boolean;
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
  lastVisitDate,
  daysSinceVisit,
  inactive,
  canFollowUp,
  onSaved,
}: {
  customer: CustomerRecord;
  points: number;
  visits: number;
  lastVisitDate?: string | null;
  daysSinceVisit?: number | null;
  inactive?: boolean;
  canFollowUp?: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone || "");
  const [tier, setTier] = useState<CustomerTier>(customer.tier || "new");
  const [msg, setMsg] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [addAmt, setAddAmt] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  const addBonusPoints = async () => {
    const n = Math.round(Number(addAmt) || 0);
    if (!n || !customer.lineUserId) return;
    const reason = addReason.trim() || "แต้มพิเศษจากร้าน";
    setAddBusy(true);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "admin_add",
          lineUserId: customer.lineUserId,
          amount: n,
          reason,
          displayName: customer.name,
        }),
      });
      if (res.ok) {
        setMsg(`✅ ${n > 0 ? "เพิ่ม" : "ปรับ"} ${n} แต้มแล้ว (${reason})`);
        setAddAmt("");
        setAddReason("");
        onSaved();
        setTimeout(() => setMsg(""), 2500);
      } else {
        setMsg("❌ เพิ่มแต้มไม่สำเร็จ");
      }
    } finally {
      setAddBusy(false);
    }
  };
  const heroCat = customer.cats.find((cat) => cat.photoDataUrl) || customer.cats[0];

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

  const removeCustomer = async () => {
    if (
      !confirm(
        `ลบลูกค้า "${customer.name}" และประวัติทั้งหมด (แมว/นัด/แต้ม)?\nลบแล้วกู้คืนไม่ได้`
      )
    )
      return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: customer.id, action: "delete_customer" }),
    });
    if (res.ok) onSaved();
    else setMsg("ลบไม่สำเร็จ");
  };

  const sendFollowUp = async () => {
    if (!customer.lineUserId) {
      setMsg("❌ ลูกค้ายังไม่ได้ผูก LINE");
      return;
    }
    if (!confirm(`ส่งข้อความตาม ${customer.name} ทาง LINE?`)) return;
    setFollowUpBusy(true);
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer.id,
        action: "send_follow_up",
        force: !canFollowUp,
      }),
    });
    const data = await res.json();
    setFollowUpBusy(false);
    if (res.ok) {
      setMsg("✅ ส่งข้อความตามแล้ว");
      onSaved();
    } else {
      setMsg(`❌ ${data.error || "ส่งไม่สำเร็จ"}`);
    }
    setTimeout(() => setMsg(""), 3000);
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
          <div className="mt-2 space-y-0.5 text-[10px] text-brown-soft">
            {customer.email && <p>📧 {customer.email}</p>}
            {customer.birthday && <p>🎂 วันเกิด {customer.birthday}</p>}
            {customer.referralSource && (
              <p>📣 รู้จักจาก: {customer.referralSource}</p>
            )}
            <p className={customer.marketingConsent ? "text-ok" : "font-bold text-wait"}>
              {customer.marketingConsent
                ? "🔔 ยินยอมรับข่าวสาร/โปร"
                : "🔕 ไม่รับข่าวสาร/โปร"}
            </p>
          </div>
          <div className="mt-3">
            <p className="mb-1.5 text-[10px] font-bold text-brown-soft">กลุ่มลูกค้า (Tier)</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${tierBadgeClass(customer.tier || "new")}`}>
              {TIER_LABELS[customer.tier || "new"]}
            </span>
          </div>
          {inactive && (
            <p className="mt-2 rounded-catcha-sm bg-wait/10 px-2.5 py-1.5 text-[10px] font-bold text-wait">
              😴 หายไป {daysSinceVisit} วัน
              {lastVisitDate ? ` · มาครั้งล่าสุด ${lastVisitDate}` : ""}
            </p>
          )}
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

      <div className="mb-4 rounded-catcha-sm border border-latte/40 bg-latte/10 p-3">
        <p className="mb-1.5 text-xs font-extrabold text-catcha-chocolate">
          🎁 เพิ่มแต้มพิเศษ (แต้มฟรี)
        </p>
        {customer.lineUserId ? (
          <>
            <div className="flex flex-wrap gap-2">
              <input
                type="number"
                value={addAmt}
                onChange={(e) => setAddAmt(e.target.value)}
                placeholder="กี่แต้ม"
                className="w-20 rounded-catcha-sm border border-catcha-line bg-paper px-2 py-2 text-sm font-bold"
              />
              <input
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="เหตุผล เช่น รีวิวร้าน"
                className="min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={addBusy || !addAmt}
                onClick={addBonusPoints}
                className="shrink-0 rounded-catcha-sm bg-latte-deep px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
              >
                {addBusy ? "…" : "➕ เพิ่ม"}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-brown-faint">
              บันทึกในประวัติแต้มของลูกค้า (มีเหตุผลกำกับ) + แจ้งเตือนร้าน และแจ้งลูกค้าทาง LINE
            </p>
          </>
        ) : (
          <p className="text-[11px] font-bold text-brown-soft">
            ⚠️ ลูกค้ารายนี้ยังไม่ได้ผูก LINE — ต้องให้ลูกค้าเปิดแอปจาก LINE ก่อน
            ถึงจะเพิ่มแต้มสะสมได้ค่ะ (แต้มผูกกับบัญชี LINE)
          </p>
        )}
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

        {(inactive || customer.lineUserId) && (
          <div className="rounded-catcha-sm border border-catcha-line bg-paper/60 p-3">
            <p className="text-xs font-bold text-brown-soft">📲 ตามลูกค้าทาง LINE</p>
            {customer.lastFollowUpAt && (
              <p className="mt-1 text-[10px] text-brown-faint">
                ส่งล่าสุด: {customer.lastFollowUpAt.slice(0, 10)}
              </p>
            )}
            <button
              type="button"
              disabled={followUpBusy || !customer.lineUserId}
              onClick={sendFollowUp}
              className="mt-2 w-full rounded-catcha-sm bg-sage/25 px-3 py-2.5 text-xs font-bold text-ok disabled:opacity-50"
            >
              {followUpBusy
                ? "กำลังส่ง…"
                : canFollowUp
                  ? "ส่งข้อความตามลูกค้า"
                  : "ส่งซ้ำ (ข้าม cooldown)"}
            </button>
            {!customer.lineUserId && (
              <p className="mt-1 text-[10px] text-wait">ต้องผูก LINE ก่อนจึงส่งได้</p>
            )}
          </div>
        )}
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

      <button
        type="button"
        onClick={removeCustomer}
        className="mt-4 w-full rounded-catcha-sm border border-wait/40 bg-wait/10 py-2 text-[11px] font-bold text-wait"
      >
        🗑️ ลบลูกค้าคนนี้
      </button>
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
  const [showTools, setShowTools] = useState(false);

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

  const deleteCustomerRow = async (c: CustomerListItem) => {
    if (!confirm(`ลบลูกค้า ${c.name}?\n(ย้ายลงถังขยะ กู้คืนได้ที่เมนู 🗑️ ถังขยะ)`)) return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, action: "delete_customer" }),
    });
    if (res.ok) {
      toast("ย้ายลูกค้าลงถังขยะแล้ว 🗑️", "success");
      search(q);
    } else {
      toast("ลบไม่สำเร็จ", "error");
    }
  };

  // ค้นหาสด — พิมพ์แล้วกรองเลย (หน่วง 300ms) ไม่ต้องกดปุ่ม
  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

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

  const saveCatPrivateNote = async (catId: string, note: string) => {
    if (!selected) return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "update_cat_private_note",
        catId,
        note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.needSql) {
      alert(
        "บันทึกโน้ตลับยังไม่ได้ ต้องรัน SQL เพิ่มคอลัมน์ใน Supabase ก่อน (ดู webapp/OVERNIGHT_SQL.md)"
      );
    }
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
          lastVisitDate={selected.lastVisitDate}
          daysSinceVisit={selected.daysSinceVisit}
          inactive={selected.inactive}
          canFollowUp={selected.canFollowUp}
          onSaved={() => open(c.id)}
        />

        <CustomerLinkSection
          customerId={c.id}
          customerName={c.name}
          hasLine={Boolean(c.lineUserId)}
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
                  {(() => {
                    const ageLabel = catCurrentAgeLabel(cat);
                    const meta = [
                      cat.gender === "male"
                        ? "♂ ผู้"
                        : cat.gender === "female"
                          ? "♀ เมีย"
                          : "",
                      cat.breed,
                      ageLabel !== "—" ? `อายุ ${ageLabel}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    if (!meta && !cat.birthday && !cat.medical) return null;
                    return (
                      <div className="mt-2 space-y-1 rounded-catcha-sm bg-paper/60 px-2 py-1.5 text-[10px] text-brown-soft">
                        {meta && <p>{meta}</p>}
                        {cat.birthday && <p>🎂 วันเกิด {cat.birthday}</p>}
                        {cat.medical && (
                          <p className="font-bold text-wait">
                            🩺 โรคประจำตัว: {cat.medical}
                          </p>
                        )}
                      </div>
                    );
                  })()}
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
                  <label className="mt-2 block rounded-catcha-sm border border-wait/40 bg-wait/5 px-2 py-1.5 text-[10px] font-bold text-wait">
                    🔒 โน้ตลับร้าน (ลูกค้าไม่เห็น)
                    <textarea
                      defaultValue={cat.staffPrivateNote}
                      placeholder="เช่น กัด ข่วน ดุมาก ระวังตอนอาบน้ำ — เฉพาะพนักงาน"
                      className="mt-0.5 w-full rounded-catcha-sm border border-wait/30 bg-card px-2 py-1.5 text-xs font-normal text-brown"
                      rows={2}
                      onBlur={(e) => saveCatPrivateNote(cat.id, e.target.value)}
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
      <AddCustomerModal
        onAdded={(id) => {
          search(q);
          open(id);
        }}
      />

      <div className="relative mb-3 mt-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 พิมพ์เพื่อค้นหา ชื่อลูกค้า / แมว / เบอร์"
          className="w-full rounded-catcha-sm border border-catcha-line bg-card px-4 py-3 text-sm"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brown-faint"
          >
            ✕
          </button>
        )}
      </div>

      {/* เครื่องมือ (QR ลงทะเบียน / Export) — ซ่อนไว้ให้หน้าโล่ง */}
      <button
        type="button"
        onClick={() => setShowTools((v) => !v)}
        className="mb-3 w-full rounded-catcha-sm bg-paper px-4 py-2 text-left text-[11px] font-bold text-brown-soft"
      >
        🛠️ เครื่องมือ (QR ลงทะเบียน · Export) {showTools ? "▲" : "▼"}
      </button>
      {showTools && (
        <div className="mb-4">
          <RegistrationQrSection compact />
          <ExportSheetsButton className="mt-3" />
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-brown-soft">กำลังโหลด…</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] font-bold text-brown-faint">
            {list.length} ราย
          </p>
          <ul className="divide-y divide-catcha-line overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
            {list.map((c) => {
              const photo = c.cats.find((x) => x.photoDataUrl)?.photoDataUrl;
              return (
                <li key={c.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => open(c.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left transition active:bg-paper/60"
                  >
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        width={38}
                        height={38}
                        className="h-[38px] w-[38px] shrink-0 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-paper text-lg">
                        {c.cats.length ? "🐱" : "👤"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 truncate text-sm font-bold text-brown">
                        <span className="truncate">
                          {c.cats.map((x) => x.name).filter(Boolean).join(", ") || c.name}
                        </span>
                        {c.isMember && <span className="shrink-0">💎</span>}
                      </p>
                      <p className="truncate text-[11px] text-brown-soft">
                        {c.name}
                        {c.phone ? ` · ${c.phone}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tierBadgeClass(c.tier || "new")}`}>
                        {TIER_LABELS[c.tier || "new"]}
                      </span>
                      {(c.upcomingAppointments ?? 0) > 0 && (
                        <span className="text-[10px] font-bold text-latte-deep">
                          📅 {c.upcomingAppointments}
                        </span>
                      )}
                      {c.memberCredit > 0 && (
                        <span className="text-[10px] font-bold text-ok">
                          {c.memberCredit}฿
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="ลบลูกค้า"
                    onClick={() => deleteCustomerRow(c)}
                    className="shrink-0 px-3 py-2.5 text-sm text-brown-faint transition hover:text-wait active:text-wait"
                  >
                    🗑️
                  </button>
                </li>
              );
            })}
            {list.length === 0 && (
              <li className="px-3 py-4 text-center text-xs text-brown-soft">
                ไม่พบลูกค้า
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
