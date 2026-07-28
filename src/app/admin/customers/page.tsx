"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { CatRecord, CustomerRecord, MemberCreditUsageRecord, MemberTopupRecord, PackageUsageRecord } from "@/lib/customers-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { toJpegDataUrl } from "@/lib/image-convert";
import { CatMediaGallery } from "@/components/CatMediaGallery";
import { TIER_LABELS, tierBadgeClass } from "@/lib/customer-tier";
import { catCurrentAgeLabel } from "@/lib/cat-age";
import { RegistrationQrSection } from "@/components/LineSetupSection";
import { AddCustomerModal } from "@/components/AddCustomerModal";
import { toast } from "@/components/Toast";
import { PreviewSendModal } from "@/components/PreviewSendModal";
import { CustomerLinkSection } from "@/components/CustomerLinkSection";
import type { PointsHistoryEntry } from "@/lib/points-store";
import { parseGroomInfo, groomInfoSummary } from "@/lib/groom-info";
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
    packageUsage: PackageUsageRecord[];
  };
};

type CustomerListItem = CustomerRecord & { upcomingAppointments?: number; points?: number };
type SortKey = "name" | "tier" | "points" | "credit" | "upcoming" | "birthday" | "recent";

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
    <section className="mb-4 rounded-petflow bg-card p-4">
      {editing && (
        <BookingEditModal
          booking={editing}
          rooms={rooms}
          groomSlots={groomSlots}
          onClose={() => setEditing(null)}
          onSaved={onRefresh}
        />
      )}
      <h2 className="mb-2 text-sm font-extrabold text-petflow-chocolate">📅 นัดหมาย</h2>
      {bookings.length === 0 ? (
        <p className="text-xs text-brown-soft">ยังไม่มีนัดที่กำลังจะมาถึง</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-petflow-sm border border-petflow-line bg-paper/50 p-3"
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
                  className="rounded-full bg-honey/25 px-2.5 py-1 text-[10px] font-bold text-petflow-chocolate"
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
  // ยอดยกมาจากระบบเก่า — เติมเครดิตให้ลูกค้าจริง แต่ไม่ใช่เงินที่รับเข้าร้านเดือนนี้
  const [isLegacy, setIsLegacy] = useState(false);
  /** ค่าเริ่มต้น = ไม่แจ้ง — ยกยอดเก่าเข้าระบบทีละหลายคนไม่ควรไปกวนลูกค้า */
  const [notify, setNotify] = useState(false);

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
        isLegacy,
        notify,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setPaid("");
      setBonus("");
      setNote("");
      setIsLegacy(false);
      setNotify(false);
      setMsg(
        `✅ เติมสำเร็จ +${total.toLocaleString()} บาท (คงเหลือ ${data.customer.memberCredit.toLocaleString()} บาท)` +
          (isLegacy ? " · ยอดยกมา ไม่นับรายรับเดือนนี้" : "") +
          // เงินลงเรียบร้อยเสมอ — ถ้าส่ง LINE ไม่ได้ต้องบอกตรงๆ ไม่ใช่บอกว่าแจ้งแล้ว
          (notify
            ? data.notifyError
              ? ` · ⚠️ ส่ง LINE ไม่ได้: ${data.notifyError}`
              : " · แจ้งลูกค้าแล้ว 💬"
            : "")
      );
      onDone();
    } else {
      setMsg("❌ บันทึกไม่สำเร็จ");
    }
  };

  return (
    <section className="mb-4 rounded-petflow bg-card p-4">
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
            className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm font-bold text-petflow-chocolate"
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
            className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm font-bold text-latte-deep"
          />
        </label>
      </div>

      {total > 0 && (
        <p className="mb-3 rounded-petflow-sm bg-honey/20 px-3 py-2 text-center text-xs font-bold text-petflow-chocolate">
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
            className="rounded-full bg-honey/30 px-3 py-1.5 text-[10px] font-bold text-petflow-chocolate"
          >
            {p.label}
          </button>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="โน้ต (ถ้ามี) เช่น โปรปีใหม่"
        className="mb-3 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-xs"
      />

      <label className="mb-3 flex items-start gap-2 rounded-petflow-sm bg-paper/60 px-3 py-2 text-[11px] font-bold text-brown-soft">
        <input
          type="checkbox"
          checked={isLegacy}
          onChange={(e) => setIsLegacy(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-latte-deep"
        />
        <span>
          🕰️ ยอดยกมาจากระบบเก่า
          <span className="block font-normal text-brown-faint">
            เติมเครดิตให้ลูกค้าตามปกติ แต่จะ<b>ไม่นับเป็นรายรับ</b>ของร้านเดือนนี้
          </span>
        </span>
      </label>

      <label className="mb-3 flex items-start gap-2 rounded-petflow-sm bg-paper/60 px-3 py-2 text-[11px] font-bold text-brown-soft">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-latte-deep"
        />
        <span>
          💬 แจ้งลูกค้าทาง LINE ด้วย
          <span className="block font-normal text-brown-faint">
            ส่งการ์ดยอดคงเหลือให้ลูกค้า (เสียโควตา 1 ข้อความ) · ไม่ติ๊ก = เติมเงียบๆ
          </span>
        </span>
      </label>

      <button
        type="button"
        disabled={saving || total <= 0}
        onClick={submit}
        className="w-full rounded-petflow-sm bg-latte/30 py-2.5 text-sm font-extrabold text-petflow-chocolate disabled:opacity-40"
      >
        {saving
          ? "กำลังบันทึก…"
          : isLegacy
            ? `บันทึกยอดยกมา +${total > 0 ? total.toLocaleString() : "—"} บาท (ไม่นับรายรับ)`
            : `บันทึกเติม Member +${total > 0 ? total.toLocaleString() : "—"} บาท`}
      </button>

      {msg && (
        <p className="mt-2 text-center text-[10px] font-bold text-brown">{msg}</p>
      )}
    </section>
  );
}

function formatThaiDateTimeShort(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    calendar: "gregory",
  });
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time} น.`;
}

/**
 * การเข้าพัก + เงื่อนไข — หลักฐานที่ลูกค้าเซ็นยอมรับก่อนฝากแมว (วันเข้า-ออก, ลายเซ็น, โน้ตดูแลเพิ่มเติม)
 *
 * เมื่อก่อนข้อมูลนี้บันทึกไว้จริง (booking.consentAcceptedAt/careNote/consentSignature)
 * แต่ไม่เคยโผล่ที่ไหนในหลังบ้านเลย — ต้องไปหาทีละนัดในปฏิทินเอง ตอนนี้รวมมาไว้ที่นี่
 * ที่เดียว จะได้ใช้เป็นหลักฐานได้ทันทีถ้ามีปัญหา ไม่ต้องไล่หา
 */
function StaysConsentSection({ bookings }: { bookings: EditableBooking[] }) {
  const stays = bookings
    .filter((b) => b.service === "room" && b.status !== "cancelled")
    .sort((a, b) => (b.checkin || b.date).localeCompare(a.checkin || a.date));

  if (stays.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mb-4 rounded-petflow bg-card p-4">
      <h2 className="mb-2 text-sm font-extrabold">🏠 การเข้าพัก + เงื่อนไข</h2>
      <ul className="space-y-2">
        {stays.map((b) => {
          const staying =
            (b.checkin || "") <= today && today < (b.checkout || b.checkin || "");
          return (
            <li key={b.id} className="rounded-petflow-sm bg-paper/60 p-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-bold text-brown">
                  {b.checkin || b.date}
                  {b.checkout ? ` → ${b.checkout}` : ""}
                  {b.room ? ` · ห้อง ${b.room}` : ""}
                </span>
                {staying && (
                  <span className="rounded-full bg-ok/20 px-2 py-0.5 text-[10px] font-extrabold text-ok">
                    🏠 กำลังเข้าพักอยู่
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {b.consentAcceptedAt ? (
                  <span className="text-[10px] font-bold text-ok">
                    ✅ เซ็นยอมรับแล้ว · {formatThaiDateTimeShort(b.consentAcceptedAt)}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-wait">
                    ⏳ ยังไม่ได้เซ็นยอมรับ
                  </span>
                )}
                {b.consentSignature && (
                  <a
                    href={b.consentSignature}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-latte/30 px-2 py-0.5 text-[10px] font-bold text-petflow-chocolate"
                  >
                    ✍️ ดูลายเซ็น
                  </a>
                )}
              </div>
              {b.careNote && (
                <p className="mt-1.5 rounded-petflow-sm border border-honey/40 bg-honey/10 px-2 py-1.5 text-[11px] text-brown">
                  📝 {b.careNote}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * ประวัติใช้บริการ — รวมรายการที่บันทึกไว้กับนัดที่ผ่านมาเป็นไทม์ไลน์เดียว เรียงใหม่ก่อน
 *
 * ลูกค้าเก่าบางรายมีเป็นร้อยแถวและส่วนใหญ่เป็นนัดที่ยกเลิก เลยพับนัดที่ยกเลิก
 * ไว้ต่างหาก และโชว์แค่ 8 แถวแรกก่อน กดดูทั้งหมดได้
 */
function ServiceHistorySection({
  customerId,
  services,
  pastBookings,
  onChanged,
}: {
  customerId: string;
  services: { id: string; service: string; date: string; amount?: number; catName: string }[];
  pastBookings: EditableBooking[];
  onChanged: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const remove = async (label: string, req: () => Promise<unknown>) => {
    if (!confirm(label)) return;
    await req();
    onChanged();
  };

  type Row = { key: string; date: string; text: string; onDelete: () => void };

  const serviceRows: Row[] = services.map((s) => ({
    key: `s${s.id}`,
    date: s.date,
    text: `${s.catName} · ${s.service}${s.amount ? ` · ${s.amount} บาท` : ""}`,
    onDelete: () =>
      remove("ลบรายการนี้ออกจากประวัติ? กู้คืนไม่ได้", () =>
        fetch("/api/customers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customerId,
            action: "delete_service_record",
            serviceId: s.id,
          }),
        })
      ),
  }));

  const bookingRow = (b: EditableBooking): Row => ({
    key: `b${b.id}`,
    date: b.date,
    text: `${b.catName} · ${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · ${statusLabel(
      b.status
    )}`,
    onDelete: () =>
      remove("ลบนัดนี้ทิ้งถาวร? กู้คืนไม่ได้", () =>
        fetch("/api/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: b.id, action: "delete" }),
        })
      ),
  });

  const byDateDesc = (a: Row, b: Row) => b.date.localeCompare(a.date);
  const cancelledRows = pastBookings
    .filter((b) => b.status === "cancelled")
    .map(bookingRow)
    .sort(byDateDesc);
  const rows = [
    ...serviceRows,
    ...pastBookings.filter((b) => b.status !== "cancelled").map(bookingRow),
  ].sort(byDateDesc);

  const visible = showAll ? rows : rows.slice(0, 8);

  const rowList = (list: Row[]) => (
    <ul className="space-y-1.5 text-xs text-brown-soft">
      {list.map((r) => (
        <li
          key={r.key}
          className="flex items-center justify-between gap-2 rounded-petflow-sm bg-paper/60 px-2.5 py-1.5"
        >
          <span className="min-w-0">
            <span className="text-brown-faint">{r.date}</span> · {r.text}
          </span>
          <button
            type="button"
            onClick={r.onDelete}
            className="shrink-0 text-[11px] font-bold text-wait"
            aria-label="ลบรายการนี้"
          >
            🗑️
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="mb-4 rounded-petflow bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-extrabold">📋 ประวัติใช้บริการ</h2>
        {rows.length > 0 && (
          <span className="text-[10px] font-bold text-brown-faint">
            {rows.length} รายการ
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-brown-faint">ยังไม่มีประวัติ</p>
      ) : (
        <>
          {rowList(visible)}
          {rows.length > visible.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 w-full rounded-petflow-sm bg-latte/20 py-1.5 text-[11px] font-extrabold text-petflow-chocolate"
            >
              ดูทั้งหมดอีก {rows.length - visible.length} รายการ
            </button>
          )}
        </>
      )}

      {cancelledRows.length > 0 && (
        <div className="mt-3 border-t border-petflow-line pt-2">
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            className="w-full text-left text-[11px] font-bold text-brown-faint"
          >
            {showCancelled ? "▾" : "▸"} นัดที่ยกเลิก ({cancelledRows.length})
          </button>
          {showCancelled && <div className="mt-2">{rowList(cancelledRows)}</div>}
        </div>
      )}

      <p className="mt-2 text-[10px] text-brown-faint">
        ลงข้อมูลผิด? ลบรายการนั้นออกได้ — จะหายจากประวัติที่ลูกค้าเห็นในแอปด้วย
      </p>
    </section>
  );
}

/**
 * ประวัติคอร์ส — ซื้อเมื่อไหร่ ใช้ไปครั้งไหนบ้าง
 *
 * ยกเลิกการซื้อ = คอร์สหายไปทั้งใบ · ยกเลิกการใช้ = ถอนบิลใบนั้นออกจากสถานะจ่ายแล้ว
 * แล้วครั้งที่หักไปจะเด้งกลับเข้าคอร์สให้เอง (ดู revertInvoicePaid)
 */
function PackageHistorySection({
  customerId,
  usage,
  onChanged,
}: {
  customerId: string;
  usage: PackageUsageRecord[];
  onChanged: () => void;
}) {
  const [packages, setPackages] = useState<
    {
      id: string;
      name: string;
      totalUses: number;
      usedUses: number;
      price?: number;
      status: string;
      createdAt?: string;
    }[]
  >([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    fetch(`/api/packages?customerId=${customerId}`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => {});
  }, [customerId]);
  useEffect(() => {
    load();
  }, [load]);

  // ไม่เคยมีคอร์สเลยก็ไม่ต้องโชว์ช่องเปล่าให้รก
  if (!packages.length && !usage.length) return null;

  const cancelPurchase = async (id: string, name: string) => {
    if (!confirm(`ยกเลิกคอร์ส "${name}"? ลูกค้าจะใช้ครั้งที่เหลือไม่ได้อีก`)) return;
    setBusy(id);
    try {
      await fetch("/api/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      load();
      onChanged();
    } finally {
      setBusy("");
    }
  };

  const cancelUse = async (invoiceId: string) => {
    if (
      !confirm(
        "ยกเลิกการใช้ครั้งนี้?\nบิลใบนี้จะกลับไปเป็น 'ยังไม่จ่าย' และครั้งที่หักไปจะคืนเข้าคอร์สให้ค่ะ"
      )
    )
      return;
    setBusy(invoiceId);
    try {
      await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId, action: "unmark_paid" }),
      });
      load();
      onChanged();
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mb-4 rounded-petflow bg-card p-4">
      <h2 className="mb-2 text-sm font-extrabold">🎫 ประวัติคอร์ส / แพ็กเกจ</h2>

      <p className="mb-1.5 text-[10px] font-bold text-brown-faint">การซื้อ</p>
      <ul className="mb-3 space-y-1.5 text-xs text-brown-soft">
        {packages.map((p) => {
          const cancelled = p.status === "cancelled";
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-2 rounded-petflow-sm px-2.5 py-1.5 ${
                cancelled ? "bg-paper/60 line-through opacity-60" : "bg-sage/10"
              }`}
            >
              <span className="min-w-0">
                <b className="text-brown">{p.name}</b>{" "}
                <span className="text-brown-faint">
                  ({p.usedUses}/{p.totalUses} ครั้ง)
                </span>
                <span className="block text-[10px] text-brown-faint">
                  {p.createdAt ? p.createdAt.slice(0, 10) : "—"}
                  {p.price ? ` · ${p.price.toLocaleString()} บาท` : ""}
                </span>
              </span>
              {!cancelled && (
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => cancelPurchase(p.id, p.name)}
                  className="shrink-0 text-[11px] font-bold text-wait disabled:opacity-40"
                >
                  ยกเลิก
                </button>
              )}
            </li>
          );
        })}
        {!packages.length && <li className="text-brown-faint">ยังไม่เคยซื้อคอร์ส</li>}
      </ul>

      <p className="mb-1.5 text-[10px] font-bold text-brown-faint">การใช้</p>
      <ul className="space-y-1.5 text-xs text-brown-soft">
        {usage.map((u) => (
          <li
            key={u.invoiceId}
            className="flex items-center justify-between gap-2 rounded-petflow-sm bg-paper/70 px-2.5 py-1.5"
          >
            <span className="min-w-0">
              {u.date} · {u.description}
            </span>
            <button
              type="button"
              disabled={busy === u.invoiceId}
              onClick={() => cancelUse(u.invoiceId)}
              className="shrink-0 text-[11px] font-bold text-wait disabled:opacity-40"
            >
              คืนครั้ง
            </button>
          </li>
        ))}
        {!usage.length && <li className="text-brown-faint">ยังไม่เคยหักครั้งจากคอร์ส</li>}
      </ul>
    </section>
  );
}

function MemberCreditHistorySection({
  customerId,
  memberCredit,
  topups,
  usage,
  onChanged,
}: {
  customerId: string;
  memberCredit: number;
  topups: MemberTopupRecord[];
  usage: MemberCreditUsageRecord[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState("");

  /**
   * ยกเลิกรายการเติม — ถอนเครดิตออกและลบรายรับที่ลงคู่กันไว้
   * ถ้าลูกค้าใช้เครดิตไปแล้วบางส่วน เซิร์ฟเวอร์จะบล็อกและบอกให้ไปยกเลิกบิลก่อน
   */
  const cancelTopup = async (t: MemberTopupRecord) => {
    const label = t.isLegacy ? "ยอดยกมา" : "การเติมเครดิต";
    if (
      !confirm(
        `ยกเลิก${label} +${t.creditAdded.toLocaleString()} บาท?\n` +
          `เครดิตลูกค้าจะถูกหักออก ${t.creditAdded.toLocaleString()} บาท` +
          (t.isLegacy ? "" : " และลบรายรับที่ลงไว้ด้วย") +
          "\nกู้คืนไม่ได้"
      )
    )
      return;
    setBusy(t.id);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customerId, action: "cancel_topup", topupId: t.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(`ยกเลิกแล้ว — เครดิตคงเหลือ ${(data.balance ?? 0).toLocaleString()} บาท`, "success");
        onChanged();
      } else if (data.error === "credit_spent") {
        toast(
          `ยกเลิกไม่ได้ — ลูกค้าใช้เครดิตไปแล้ว (เหลือ ${(data.balance ?? 0).toLocaleString()} จากที่เติม ${(data.creditAdded ?? 0).toLocaleString()}) · ยกเลิกบิลที่ใช้เครดิตก่อน แล้วค่อยมายกเลิกรายการนี้`,
          "error"
        );
      } else {
        toast("ยกเลิกไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

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
    <section className="mb-4 rounded-petflow bg-card p-4">
      <h2 className="mb-1 text-sm font-extrabold text-petflow-chocolate">📒 ประวัติเครดิต Member</h2>
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
                className="rounded-petflow-sm border border-petflow-line bg-paper/50 px-3 py-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`font-bold ${row.topup.isLegacy ? "text-brown" : "text-ok"}`}>
                      {row.topup.isLegacy ? "🕰️ ยอดยกมาจากระบบเก่า" : "+ เติมเครดิต"}
                    </p>
                    <p className="text-brown-soft">
                      {row.topup.createdAt.slice(0, 10)} · รับ {row.topup.paidAmount.toLocaleString()} บาท
                      {row.topup.bonusAmount > 0 && (
                        <> · แถม {row.topup.bonusAmount.toLocaleString()} บาท</>
                      )}
                      {row.topup.isLegacy && <> · ไม่นับรายรับ</>}
                    </p>
                    {row.topup.note && (
                      <p className="text-[10px] text-brown-faint">{row.topup.note}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-extrabold text-ok">
                      +{row.topup.creditAdded.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-brown-faint">
                      คงเหลือ {row.topup.balanceAfter.toLocaleString()}
                    </p>
                    <button
                      type="button"
                      disabled={busy === row.topup.id}
                      onClick={() => cancelTopup(row.topup)}
                      className="mt-1 text-[10px] font-bold text-wait disabled:opacity-40"
                    >
                      {busy === row.topup.id ? "…" : "🗑️ ยกเลิก"}
                    </button>
                  </div>
                </div>
              </li>
            ) : (
              <li
                key={row.usage.id}
                className="rounded-petflow-sm border border-petflow-line bg-paper/50 px-3 py-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-wait">− ใช้เครดิต</p>
                    <p className="text-brown-soft">
                      {row.usage.date} · {row.usage.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-extrabold text-wait">
                      −{row.usage.amount.toLocaleString()}
                    </p>
                    {/* รายการนี้สร้างจากบิลที่จ่ายด้วยเครดิต ลบเดี่ยวๆ ไม่ได้
                        ต้องไปกด "ยกเลิกการชำระ" ที่บิล ซึ่งคืนเครดิตให้อัตโนมัติอยู่แล้ว */}
                    <p className="mt-0.5 text-[9px] text-brown-faint">
                      ยกเลิกที่บิล → คืนเครดิตอัตโนมัติ
                    </p>
                  </div>
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
  const [email, setEmail] = useState(customer.email || "");
  const [birthday, setBirthday] = useState(customer.birthday || "");
  const [address, setAddress] = useState(customer.address || "");
  const [addressMapUrl, setAddressMapUrl] = useState(customer.addressMapUrl || "");
  const [postalCode, setPostalCode] = useState(customer.postalCode || "");
  const [tier, setTier] = useState<CustomerTier>(customer.tier || "new");
  const [msg, setMsg] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [addAmt, setAddAmt] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  /** ค่าเริ่มต้น = ไม่แจ้ง — เพิ่มแต้มหลังบ้านไม่ต้องรบกวนลูกค้า */
  const [addNotify, setAddNotify] = useState(false);

  /** การ์ดที่รอยืนยันก่อนส่งจริง — null = ยังไม่ได้กดพรีวิว */
  const [pointsPreview, setPointsPreview] = useState<Record<string, unknown>[] | null>(null);

  const pointsPayload = () => ({
    action: "admin_add",
    lineUserId: customer.lineUserId,
    amount: Math.round(Number(addAmt) || 0),
    reason: addReason.trim() || "แต้มพิเศษจากร้าน",
    displayName: customer.name,
  });

  /** ติ๊กแจ้งลูกค้า → ขอตัวอย่างการ์ดมาดูก่อน ยังไม่เติมแต้มจริง */
  const previewBonusPoints = async () => {
    const n = Math.round(Number(addAmt) || 0);
    if (!n || !customer.lineUserId) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pointsPayload(), preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.preview) setPointsPreview(data.preview);
      else setMsg("❌ ดูตัวอย่างไม่สำเร็จ");
    } finally {
      setAddBusy(false);
    }
  };

  const addBonusPoints = async () => {
    const n = Math.round(Number(addAmt) || 0);
    if (!n || !customer.lineUserId) return;
    const reason = addReason.trim() || "แต้มพิเศษจากร้าน";
    setAddBusy(true);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pointsPayload(), reason, notify: addNotify }),
      });
      setPointsPreview(null);
      if (res.ok) {
        setMsg(
          `✅ ${n > 0 ? "เพิ่ม" : "ปรับ"} ${n} แต้มแล้ว (${reason})` +
            (n > 0 && !addNotify ? " · ไม่ได้แจ้งลูกค้า" : "")
        );
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

  // ── คอร์ส/แพ็กเกจ ──
  const [packages, setPackages] = useState<
    { id: string; name: string; totalUses: number; usedUses: number; status: string }[]
  >([]);
  const [pkgName, setPkgName] = useState("");
  const [pkgUses, setPkgUses] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgBusy, setPkgBusy] = useState(false);
  /** ค่าเริ่มต้น = ไม่แจ้ง / ไม่ใช่ยอดยกมา — เหมือนฝั่งเติมเครดิต Member */
  const [pkgNotify, setPkgNotify] = useState(false);
  const [pkgLegacy, setPkgLegacy] = useState(false);

  /** ครั้งที่ยังใช้ได้รวมทุกคอร์ส (ไม่นับที่ยกเลิก/ใช้หมดแล้ว) */
  const packageUsesLeft = packages
    .filter((p) => p.status === "active")
    .reduce((n, p) => n + Math.max(0, p.totalUses - p.usedUses), 0);

  const loadPackages = useCallback(() => {
    fetch(`/api/packages?customerId=${customer.id}`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => {});
  }, [customer.id]);
  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const sellPackage = async () => {
    const uses = Math.round(Number(pkgUses) || 0);
    const price = Math.round(Number(pkgPrice) || 0);
    if (!pkgName.trim() || uses <= 0) return;
    setPkgBusy(true);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          name: pkgName.trim(),
          totalUses: uses,
          price,
          isLegacy: pkgLegacy,
          notify: pkgNotify,
        }),
      });
      const pkgData = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(
          `✅ ${pkgLegacy ? "ยกคอร์ส" : "ขายคอร์ส"} "${pkgName.trim()}" แล้ว` +
            (pkgLegacy ? " · ไม่นับรายรับเดือนนี้" : "") +
            (pkgNotify
              ? pkgData.notifyError
                ? ` · ⚠️ ส่ง LINE ไม่ได้: ${pkgData.notifyError}`
                : " · แจ้งลูกค้าแล้ว 💬"
              : "")
        );
        setPkgName("");
        setPkgUses("");
        setPkgPrice("");
        setPkgLegacy(false);
        setPkgNotify(false);
        loadPackages();
        setTimeout(() => setMsg(""), 2500);
      }
    } finally {
      setPkgBusy(false);
    }
  };

  const cancelPackage = async (id: string) => {
    if (!confirm("ยกเลิกคอร์สนี้?")) return;
    await fetch("/api/packages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", packageId: id }),
    });
    loadPackages();
  };

  const heroCat = customer.cats.find((cat) => cat.photoDataUrl) || customer.cats[0];

  useEffect(() => {
    setName(customer.name);
    setPhone(customer.phone || "");
    setAddress(customer.address || "");
    setAddressMapUrl(customer.addressMapUrl || "");
    setPostalCode(customer.postalCode || "");
    setTier(customer.tier || "new");
  }, [
    customer.id,
    customer.name,
    customer.phone,
    customer.address,
    customer.addressMapUrl,
    customer.postalCode,
    customer.tier,
  ]);

  const save = async (patch: {
    name?: string;
    phone?: string;
    email?: string;
    birthday?: string;
    address?: string;
    addressMapUrl?: string;
    postalCode?: string;
  }) => {
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
    <section className="mb-4 overflow-hidden rounded-petflow bg-gradient-to-br from-honey/45 via-card to-latte/15 p-5 shadow-petflow">
      {msg && (
        <p className="mb-3 rounded-petflow-sm bg-sage/25 px-3 py-2 text-center text-xs font-extrabold text-ok">
          {msg}
        </p>
      )}
      <div className="mb-4 flex items-start gap-3">
        {heroCat?.photoDataUrl ? (
          <Image
            src={heroCat.photoDataUrl}
            alt={heroCat.name}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-petflow-sm object-cover ring-2 ring-white/70"
            unoptimized
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-petflow-sm bg-card/80 text-3xl ring-2 ring-white/70">
            {customer.cats.length > 0 ? "🐱" : "👤"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-brown-soft">ข้อมูลลูกค้า</p>
          <h1 className="mt-0.5 text-xl font-extrabold text-petflow-chocolate">
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
            {customer.address && (
              <p>
                📍 {customer.address}
                {customer.addressMapUrl && (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={customer.addressMapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-latte-deep underline"
                    >
                      แผนที่
                    </a>
                  </>
                )}
              </p>
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
            <p className="mt-2 rounded-petflow-sm bg-wait/10 px-2.5 py-1.5 text-[10px] font-bold text-wait">
              😴 หายไป {daysSinceVisit} วัน
              {lastVisitDate ? ` · มาครั้งล่าสุด ${lastVisitDate}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        <div className="rounded-petflow-sm bg-card/80 px-2 py-2.5 text-center shadow-petflow-sm">
          <p className="text-[10px] font-bold text-brown-soft">แต้ม</p>
          <p className="text-lg font-extrabold text-latte-deep">{points}</p>
        </div>
        <div className="rounded-petflow-sm bg-card/80 px-2 py-2.5 text-center shadow-petflow-sm">
          <p className="text-[10px] font-bold text-brown-soft">มาใช้บริการ</p>
          <p className="text-lg font-extrabold text-petflow-chocolate">{visits}</p>
          <p className="text-[10px] text-brown-faint">ครั้ง</p>
        </div>
        <div className="rounded-petflow-sm bg-card/80 px-2 py-2.5 text-center shadow-petflow-sm">
          <p className="text-[10px] font-bold text-brown-soft">เครดิต</p>
          <p className="text-lg font-extrabold text-petflow-chocolate">
            {customer.memberCredit.toLocaleString()}
          </p>
          <p className="text-[10px] text-brown-faint">บาท</p>
        </div>
        {/* คอร์สคงเหลือ — ลูกค้าจ่ายล่วงหน้าไว้แล้ว ต้องเห็นตั้งแต่แรกว่ายังใช้ได้กี่ครั้ง */}
        <div className="rounded-petflow-sm bg-card/80 px-2 py-2.5 text-center shadow-petflow-sm">
          <p className="text-[10px] font-bold text-brown-soft">คอร์สเหลือ</p>
          <p className="text-lg font-extrabold text-ok">{packageUsesLeft}</p>
          <p className="text-[10px] text-brown-faint">ครั้ง</p>
        </div>
      </div>

      <div className="mb-4 rounded-petflow-sm border border-latte/40 bg-latte/10 p-3">
        <p className="mb-1.5 text-xs font-extrabold text-petflow-chocolate">
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
                className="w-20 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-2 text-sm font-bold"
              />
              <input
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
                placeholder="เหตุผล เช่น รีวิวร้าน"
                className="min-w-0 flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={addBusy || !addAmt}
                onClick={addNotify ? previewBonusPoints : addBonusPoints}
                className="shrink-0 rounded-petflow-sm bg-latte-deep px-4 py-2 text-sm font-extrabold text-white disabled:opacity-40"
              >
                {addBusy ? "…" : addNotify ? "🔍 ดูการ์ด" : "➕ เพิ่ม"}
              </button>
            </div>
            {pointsPreview && (
              <PreviewSendModal
                messages={pointsPreview}
                sending={addBusy}
                onConfirm={addBonusPoints}
                onCancel={() => setPointsPreview(null)}
              />
            )}
            <label className="mt-2 flex items-center gap-2 text-[11px] font-bold text-brown-soft">
              <input
                type="checkbox"
                checked={addNotify}
                onChange={(e) => setAddNotify(e.target.checked)}
                className="h-3.5 w-3.5 accent-latte-deep"
              />
              แจ้งลูกค้าทาง LINE ด้วย (เสียโควตา 1 ข้อความ)
            </label>
            <p className="mt-1 text-[10px] text-brown-faint">
              บันทึกในประวัติแต้มของลูกค้า (มีเหตุผลกำกับ) + แจ้งเตือนร้านเสมอ ·
              ปกติจะ<b>ไม่</b>ส่งข้อความหาลูกค้า ถ้าอยากแจ้งค่อยติ๊กช่องด้านบน
            </p>
          </>
        ) : (
          <p className="text-[11px] font-bold text-brown-soft">
            ⚠️ ลูกค้ารายนี้ยังไม่ได้ผูก LINE — ต้องให้ลูกค้าเปิดแอปจาก LINE ก่อน
            ถึงจะเพิ่มแต้มสะสมได้ค่ะ (แต้มผูกกับบัญชี LINE)
          </p>
        )}
      </div>

      {/* ── คอร์ส/แพ็กเกจ ── */}
      <div className="mb-4 rounded-petflow-sm border border-sage/40 bg-sage/10 p-3">
        <p className="mb-1.5 text-xs font-extrabold text-petflow-chocolate">
          🎫 คอร์ส / แพ็กเกจ
        </p>
        {packages.filter((p) => p.status !== "cancelled").length > 0 && (
          <ul className="mb-2 space-y-1">
            {packages
              .filter((p) => p.status !== "cancelled")
              .map((p) => {
                const left = p.totalUses - p.usedUses;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-petflow-sm bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate font-bold text-brown">
                      {p.name}{" "}
                      <span className={left > 0 ? "text-ok" : "text-brown-faint"}>
                        (เหลือ {left}/{p.totalUses})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelPackage(p.id)}
                      className="shrink-0 text-[10px] font-bold text-wait"
                    >
                      ยกเลิก
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            value={pkgName}
            onChange={(e) => setPkgName(e.target.value)}
            placeholder="ชื่อคอร์ส เช่น อาบน้ำ 10 ครั้ง"
            className="min-w-0 flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2 text-sm"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            value={pkgUses}
            onChange={(e) => setPkgUses(e.target.value)}
            placeholder="กี่ครั้ง"
            className="w-20 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-2 text-sm"
          />
          <input
            type="number"
            value={pkgPrice}
            onChange={(e) => setPkgPrice(e.target.value)}
            placeholder="ราคา (บาท)"
            className="min-w-0 flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pkgBusy || !pkgName.trim() || !pkgUses}
            onClick={sellPackage}
            className="shrink-0 rounded-petflow-sm bg-sage px-3 py-2 text-sm font-extrabold text-card disabled:opacity-40"
          >
            {pkgLegacy ? "ยกคอร์สมา" : "ขายคอร์ส"}
          </button>
        </div>

        <label className="mt-2 flex items-start gap-2 text-[11px] font-bold text-brown-soft">
          <input
            type="checkbox"
            checked={pkgLegacy}
            onChange={(e) => setPkgLegacy(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-latte-deep"
          />
          <span>
            🕰️ ยกมาจากระบบเก่า
            <span className="block font-normal text-brown-faint">
              ลูกค้าได้ครั้งครบตามปกติ แต่จะ<b>ไม่นับเป็นรายรับ</b>ของร้านเดือนนี้
            </span>
          </span>
        </label>

        <label className="mt-1.5 flex items-start gap-2 text-[11px] font-bold text-brown-soft">
          <input
            type="checkbox"
            checked={pkgNotify}
            onChange={(e) => setPkgNotify(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 accent-latte-deep"
          />
          <span>
            💬 แจ้งลูกค้าทาง LINE ด้วย
            <span className="block font-normal text-brown-faint">
              ส่งการ์ดบอกจำนวนครั้งคงเหลือ (เสียโควตา 1 ข้อความ) · ไม่ติ๊ก = บันทึกเงียบๆ
            </span>
          </span>
        </label>

        <p className="mt-1.5 text-[10px] text-brown-faint">
          เวลาลูกค้ามาใช้ กดหักที่หน้าคิดเงิน (บิลนั้นฟรี) · ลูกค้าดูครั้งคงเหลือเองได้ในแอป
        </p>
      </div>

      <div className="space-y-3 rounded-petflow-sm border-2 border-latte/30 bg-card/70 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-petflow-chocolate">
          ✏️ แก้ไขข้อมูลลูกค้า
        </p>

        <label className="block text-xs font-bold text-brown-soft">
          <span className="mb-1 flex items-center gap-1">👤 ชื่อที่ใช้ในร้าน (ตั้งเองได้)</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (trimmed && trimmed !== customer.name) save({ name: trimmed });
            }}
            placeholder="เช่น คุณแม่น้องมะลิ"
            className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-3 py-2.5 text-sm font-bold text-brown outline-none transition focus:border-latte-deep focus:bg-card"
          />
        </label>

        <label className="block text-xs font-bold text-brown-soft">
          <span className="mb-1 flex items-center gap-1">📱 เบอร์โทร</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => {
              if (phone.trim() !== (customer.phone || "")) save({ phone: phone.trim() || undefined });
            }}
            placeholder="08x-xxx-xxxx"
            className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-latte-deep focus:bg-card"
          />
        </label>
        <label className="block text-xs font-bold text-brown-soft">
          <span className="mb-1 flex items-center gap-1">📧 อีเมล</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => {
              if (email.trim() !== (customer.email || "")) save({ email: email.trim() || undefined });
            }}
            placeholder="เช่น customer@email.com"
            className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-latte-deep focus:bg-card"
          />
        </label>
        <label className="block text-xs font-bold text-brown-soft">
          <span className="mb-1 flex items-center gap-1">🎂 วันเกิดลูกค้า</span>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            onBlur={() => {
              if (birthday !== (customer.birthday || "")) save({ birthday: birthday || undefined });
            }}
            className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-latte-deep focus:bg-card"
          />
        </label>
        <label className="block text-xs font-bold text-brown-soft">
          <span className="mb-1 flex items-center gap-1">📍 ที่อยู่บ้าน (บริการรับ-ส่ง)</span>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onBlur={() => {
              if (address.trim() !== (customer.address || "")) save({ address: address.trim() || undefined });
            }}
            placeholder="เช่น บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ"
            rows={2}
            className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-latte-deep focus:bg-card"
          />
        </label>
        <label className="block text-xs font-bold text-brown-soft">
          <span className="mb-1 flex items-center gap-1">🗺️ ลิงก์ Google Maps</span>
          <input
            value={addressMapUrl}
            onChange={(e) => setAddressMapUrl(e.target.value)}
            onBlur={() => {
              if (addressMapUrl.trim() !== (customer.addressMapUrl || ""))
                save({ addressMapUrl: addressMapUrl.trim() || undefined });
            }}
            placeholder="วางลิงก์ Google Maps ที่ลูกค้าแชร์มา"
            className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-latte-deep focus:bg-card"
          />
          {addressMapUrl && (
            <a
              href={addressMapUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-[10px] font-bold text-latte-deep underline"
            >
              📍 เปิดดูแผนที่
            </a>
          )}
        </label>
        <label className="block text-xs font-bold text-brown-soft">
          <span className="mb-1 flex items-center gap-1">📮 รหัสไปรษณีย์</span>
          <input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            onBlur={() => {
              if (postalCode.trim() !== (customer.postalCode || ""))
                save({ postalCode: postalCode.trim() || undefined });
            }}
            inputMode="numeric"
            placeholder="เช่น 10260"
            className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-latte-deep focus:bg-card"
          />
        </label>
        <p className="text-[10px] text-brown-faint">💾 พิมพ์แล้วแตะออกจากช่อง ระบบบันทึกให้อัตโนมัติ</p>

        {(inactive || customer.lineUserId) && (
          <div className="rounded-petflow-sm border border-petflow-line bg-paper/60 p-3">
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
              className="mt-2 w-full rounded-petflow-sm bg-sage/25 px-3 py-2.5 text-xs font-bold text-ok disabled:opacity-50"
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

      <label className="mt-3 block rounded-petflow-sm border-2 border-latte/30 bg-card/70 p-3.5 text-xs font-extrabold text-petflow-chocolate">
        🏷️ ระดับลูกค้า (Tier)
        <div className="mt-2 flex flex-wrap gap-2">
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

      {!customer.lineUserId && (
        <AdoptLineControl customer={customer} onMerged={onSaved} />
      )}

      {customer.lineUserId && (
        <button
          type="button"
          onClick={async () => {
            if (
              !confirm(
                `ปลดผูก LINE ของ "${customer.name}"?\n\n` +
                  `หลังปลด: ส่งลิงก์เชิญให้ลูกค้ากดผูกใหม่ได้เลย (ไม่ติด "ผูกไปแล้ว")\n` +
                  `แต้ม · คูปอง · บิล · แมว ยังอยู่ครบ ไม่หายไปไหน\n\n` +
                  `⚠️ ระหว่างที่ยังไม่ผูกใหม่ ลูกค้าจะไม่ได้รับข้อความจากร้าน`
              )
            )
              return;
            const res = await fetch("/api/customers", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: customer.id, action: "unlink_line" }),
            });
            if (res.ok) {
              toast("ปลดผูก LINE แล้ว — ส่งลิงก์เชิญให้ลูกค้าผูกใหม่ได้เลย 🔓", "success");
              onSaved();
            } else {
              toast("ปลดผูกไม่สำเร็จ", "error");
            }
          }}
          className="mt-2 w-full rounded-petflow-sm border border-wait/40 bg-wait/10 py-2 text-[11px] font-bold text-wait"
        >
          🔓 ปลดผูก LINE (ให้ลูกค้ากดผูกใหม่)
        </button>
      )}

      <MergeCustomerControl customer={customer} onMerged={onSaved} />

      <button
        type="button"
        onClick={removeCustomer}
        className="mt-4 w-full rounded-petflow-sm border border-wait/40 bg-wait/10 py-2 text-[11px] font-bold text-wait"
      >
        🗑️ ลบลูกค้าคนนี้
      </button>
    </section>
  );
}

/**
 * ลูกค้าคนนี้ยังไม่ผูก LINE ทั้งที่สมัครแล้ว — เพราะ LINE ไปติดอยู่บนอีก record
 * (ลูกค้าสมัครเอง/ระบบสร้างให้ตอนเปิดแอปครั้งแรก คนละตัวกับที่ร้านสร้างไว้)
 * ปุ่มนี้ให้ร้านดึง record ที่ถือ LINE เข้ามารวมได้เอง — ลูกค้าไม่ต้องกดอะไรเลย
 */
function AdoptLineControl({
  customer,
  onMerged,
}: {
  customer: CustomerRecord;
  onMerged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(customer.name);
  const [results, setResults] = useState<CustomerRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      try {
        const d = await fetch(`/api/customers?q=${encodeURIComponent(query)}`).then((r) =>
          r.json()
        );
        // เอาเฉพาะบัญชีที่ "มี LINE แล้ว" — บัญชีที่ยังไม่ผูกดึงมาก็ไม่ช่วยอะไร
        setResults(
          (d.customers || [])
            .filter((c: CustomerRecord) => c.id !== customer.id && c.lineUserId)
            .slice(0, 8)
        );
      } catch {
        /* ค้นไม่ได้ = ไม่โชว์ */
      } finally {
        setSearched(true);
      }
    },
    [customer.id]
  );

  useEffect(() => {
    if (open) void search(q);
    // เปิดครั้งแรกให้ค้นด้วยชื่อลูกค้าเลย — ส่วนใหญ่บัญชีซ้ำใช้ชื่อใกล้กัน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const adopt = async (source: CustomerRecord) => {
    if (
      !confirm(
        `ดึง LINE ของ "${source.lineDisplayName || source.name}" มาผูกกับ "${customer.name}"?\n\n` +
          `แต้ม · คูปอง · เครดิต · บิล · แมว จะย้ายมาที่ "${customer.name}" ทั้งหมด\n` +
          `แล้วบัญชีซ้ำ "${source.name}" จะถูกลบ (กู้ได้จากถังขยะ)\n\n` +
          `ลูกค้าไม่ต้องทำอะไรเลย`
      )
    )
      return;
    setBusy(true);
    try {
      // รวมบัญชีที่ถือ LINE (source) เข้าบัญชีนี้ (target) — ทิศทางกลับกับปุ่มรวมด้านล่าง
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          action: "merge_customer",
          targetId: customer.id,
        }),
      });
      if (res.ok) {
        toast("ผูก LINE ให้แล้ว ✓ ลูกค้าไม่ต้องทำอะไร", "success");
        onMerged();
      } else {
        toast("ผูกไม่สำเร็จ", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-petflow-sm border border-ok/40 bg-ok/10 py-2 text-[11px] font-bold text-ok"
      >
        🔗 ผูก LINE ให้เอง (ลูกค้าไม่ต้องกดอะไร)
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-petflow-sm border border-ok/40 bg-ok/5 p-3">
      <p className="mb-1 text-[11px] font-extrabold text-petflow-chocolate">
        🔗 ผูก LINE ให้ “{customer.name}”
      </p>
      {/* ทางลัด: นัดที่จองผ่าน LINE เก็บ LINE ID ไว้กับตัวนัดอยู่แล้ว — ดึงมาใช้ได้เลย
          ไม่ต้องหา record ซ้ำเอง (ต่อให้ตัวซ้ำโดนลบไปแล้วก็ยังดึงได้) */}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/customers", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: customer.id, action: "adopt_line_from_bookings" }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok) {
              toast("ผูก LINE จากนัดให้แล้ว ✓ ลูกค้าไม่ต้องทำอะไร", "success");
              onMerged();
            } else {
              toast(d.error || "ดึงจากนัดไม่ได้ — ลองเลือกจากรายชื่อด้านล่าง", "error");
            }
          } finally {
            setBusy(false);
          }
        }}
        className="mb-2 w-full rounded-petflow-sm bg-ok py-2 text-[11px] font-extrabold text-white disabled:opacity-40"
      >
        {busy ? "กำลังผูก…" : "⚡ ดึง LINE จากนัดของลูกค้าอัตโนมัติ (แนะนำ)"}
      </button>
      <p className="mb-2 text-[10px] text-brown-faint">
        หรือเลือกบัญชีที่ลูกค้าใช้อยู่จริง (บัญชีที่มี LINE แล้ว) — ระบบจะย้ายแต้ม/คูปอง/บิล
        มารวมที่นี่แล้วลบตัวซ้ำให้
      </p>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          void search(e.target.value);
        }}
        placeholder="พิมพ์ชื่อลูกค้า / ชื่อ LINE"
        className="w-full rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2 text-xs"
      />
      <ul className="mt-2 space-y-1">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => adopt(c)}
              className="w-full rounded-petflow-sm bg-card px-2.5 py-1.5 text-left text-xs font-bold text-brown disabled:opacity-40"
            >
              {c.name}
              {c.lineDisplayName && (
                <span className="ml-1 font-normal text-brown-faint">
                  · LINE: {c.lineDisplayName}
                </span>
              )}
            </button>
          </li>
        ))}
        {searched && results.length === 0 && (
          <li className="px-1 py-2 text-[10px] text-brown-faint">
            ไม่เจอบัญชีที่ผูก LINE ไว้ — ลองพิมพ์ชื่อ LINE ของลูกค้าดู
          </li>
        )}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 w-full rounded-petflow-sm bg-paper py-1.5 text-[10px] font-bold text-brown-soft"
      >
        ปิด
      </button>
    </div>
  );
}

/** รวมลูกค้าซ้ำ 2 record → 1 (คนเดียวโดนแยกเพราะ LINE ให้ ID คนละตัวคอม/มือถือ) */
function MergeCustomerControl({
  customer,
  onMerged,
}: {
  customer: CustomerRecord;
  onMerged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; lineDisplayName?: string; points?: number }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const search = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    try {
      const d = await fetch(`/api/customers?q=${encodeURIComponent(query)}`).then((r) => r.json());
      setResults((d.customers || []).filter((c: { id: string }) => c.id !== customer.id).slice(0, 8));
    } catch {
      /* ค้นไม่ได้ = ไม่โชว์ */
    }
  };

  const merge = async (target: { id: string; name: string }) => {
    if (
      !confirm(
        `รวม "${customer.name}" เข้ากับ "${target.name}"?\n\n` +
          `แต้ม · คูปอง · เครดิต · บิล · แมว · LINE ID จะย้ายไปที่ "${target.name}" ` +
          `แล้วลบ "${customer.name}" ทิ้ง\n\n⚠️ ทำแล้วกู้คืนไม่ได้`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, action: "merge_customer", targetId: target.id }),
      });
      if (res.ok) {
        toast("รวมบัญชีลูกค้าแล้ว ✓", "success");
        onMerged();
      } else {
        toast("รวมไม่สำเร็จ", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-petflow-sm border border-latte/40 bg-latte/10 py-2 text-[11px] font-bold text-latte-deep"
      >
        🔗 รวมกับลูกค้าอื่น (กรณีบัญชีซ้ำ)
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-petflow-sm border border-latte/40 bg-latte/10 p-3">
      <p className="mb-1 text-[11px] font-extrabold text-petflow-chocolate">
        🔗 รวม “{customer.name}” เข้ากับลูกค้าอีกคน
      </p>
      <p className="mb-2 text-[10px] text-brown-faint">
        ค้นหา “ลูกค้าปลายทาง” (ตัวที่จะเก็บไว้) — ข้อมูลของคนนี้จะย้ายไปที่นั่นทั้งหมดแล้วลบคนนี้ทิ้ง
      </p>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          search(e.target.value);
        }}
        placeholder="พิมพ์ชื่อลูกค้าปลายทาง"
        className="w-full rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2 text-xs"
      />
      <ul className="mt-2 space-y-1">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => merge(c)}
              className="w-full rounded-petflow-sm bg-card px-2.5 py-1.5 text-left text-xs font-bold text-brown disabled:opacity-40"
            >
              → {c.name}
              {c.lineDisplayName ? ` · LINE: ${c.lineDisplayName}` : ""}
              {typeof c.points === "number" ? ` · ${c.points} แต้ม` : ""}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-[10px] font-bold text-brown-faint"
      >
        ยกเลิก
      </button>
    </div>
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
        className="w-full rounded-petflow-sm border border-dashed border-latte/50 bg-paper/50 py-2.5 text-xs font-extrabold text-latte-deep"
      >
        ➕ เพิ่มน้องแมว
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-petflow bg-card p-5 shadow-petflow">
            <h2 className="mb-3 text-sm font-extrabold text-petflow-chocolate">➕ เพิ่มน้องแมว</h2>
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs font-bold text-brown-soft">
                ชื่อน้องแมว *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น น้องจู๊ด"
                  required
                  autoFocus
                  className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm font-bold"
                />
              </label>
              <label className="block text-xs font-bold text-brown-soft">
                โน้ตนิสัย (ถ้ามี)
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="เช่น แมวดุ อาบยาก กลัวเสียง"
                  rows={3}
                  className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-xs"
                />
              </label>
              {error && <p className="text-xs font-bold text-wait">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="flex-1 rounded-petflow-sm bg-paper py-2.5 text-xs font-bold text-brown-soft"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex-1 rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-2.5 text-xs font-extrabold text-petflow-chocolate disabled:opacity-50"
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
  const [tierFilter, setTierFilter] = useState<CustomerTier | "all">("all");
  const [lineFilter, setLineFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const resetFilters = () => {
    setQ("");
    setTierFilter("all");
    setLineFilter("all");
    setSortKey("recent");
    setSortDir("desc");
  };

  const visibleList = list
    .filter((c) => tierFilter === "all" || (c.tier || "new") === tierFilter)
    .filter((c) => {
      if (lineFilter === "all") return true;
      const linked = Boolean(c.lineUserId);
      return lineFilter === "linked" ? linked : !linked;
    })
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "th");
      else if (sortKey === "tier")
        cmp = (a.tier || "new").localeCompare(b.tier || "new");
      else if (sortKey === "points") cmp = (a.points || 0) - (b.points || 0);
      else if (sortKey === "credit") cmp = (a.memberCredit || 0) - (b.memberCredit || 0);
      else if (sortKey === "upcoming")
        cmp = (a.upcomingAppointments || 0) - (b.upcomingAppointments || 0);
      else if (sortKey === "birthday")
        cmp = (a.birthday || "").localeCompare(b.birthday || "");
      else if (sortKey === "recent")
        cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      return sortDir === "asc" ? cmp : -cmp;
    });

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/customers${params}`);
    const data = await res.json();
    setList(data.customers || []);
    setLoading(false);
  }, []);

  const open = useCallback(async (id: string) => {
    // ลูกค้าถูกลบไปแล้ว / ลิงก์เก่า → เมื่อก่อน setSelected({error}) แล้วจอขาวทั้งหน้า
    try {
      const res = await fetch(`/api/customers?id=${id}`);
      const data = await res.json();
      if (!res.ok || !data?.customer) {
        toast("ไม่พบข้อมูลลูกค้ารายนี้ (อาจถูกลบไปแล้ว)", "error");
        return;
      }
      setSelected(data);
    } catch {
      toast("โหลดข้อมูลลูกค้าไม่สำเร็จ ลองใหม่อีกครั้งนะคะ", "error");
    }
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
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "update_cat",
        catId,
        patch,
      }),
    });
    if (res.ok) toast("✅ บันทึกข้อมูลแมวแล้ว", "success");
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
      return;
    }
    // ยืนยันให้เห็นชัด — ก่อนหน้านี้เงียบทั้งตอนสำเร็จและตอนพลาด แยกไม่ออกว่าเซฟติดไหม
    if (res.ok) toast("บันทึกโน้ตลับร้านแล้ว 🔒", "success");
    else toast("บันทึกโน้ตลับไม่สำเร็จ", "error");
  };


  const onPhoto = async (cat: CatRecord, file: File) => {
    try {
      const dataUrl = await toJpegDataUrl(file);
      await saveCatNote(cat.id, cat.staffNote || "", dataUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    }
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
          <h2 className="text-sm font-extrabold text-petflow-chocolate">
            🐱 น้องแมว ({c.cats.length}) — โน้ตแยกแต่ละตัว
          </h2>

          <AddCatForm customerId={c.id} onAdded={() => open(c.id)} />

          {c.cats.length === 0 && (
            <p className="text-xs text-brown-soft">ยังไม่มีน้องแมว — กดปุ่มด้านบนเพื่อเพิ่ม</p>
          )}
          {c.cats.map((cat) => (
            <div key={cat.id} className="overflow-hidden rounded-petflow border-2 border-latte/30 bg-card shadow-petflow-sm">
              <div className="flex items-center justify-between bg-latte/10 px-4 py-2">
                <p className="flex items-center gap-1.5 text-xs font-extrabold text-petflow-chocolate">
                  ✏️ แก้ไขข้อมูล{cat.name ? ` — ${cat.name}` : "น้องแมว"}
                </p>
                <button
                  type="button"
                  onClick={() => deleteCatProfile(cat)}
                  className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-wait shadow-petflow-sm"
                >
                  🗑️ ลบตัวนี้
                </button>
              </div>
              <div className="flex gap-3 p-4">
                {cat.photoDataUrl ? (
                  <Image
                    src={cat.photoDataUrl}
                    alt={cat.name}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] shrink-0 rounded-petflow-sm object-cover ring-2 ring-latte/30"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-petflow-sm bg-paper text-2xl ring-2 ring-latte/30">
                    🐱
                  </div>
                )}
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-brown-soft">
                    <span className="mb-1 flex items-center gap-1">🐱 ชื่อน้องแมว</span>
                    <input
                      defaultValue={cat.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== cat.name) saveCat(cat.id, { name: v });
                      }}
                      className="w-full rounded-petflow-sm border-2 border-petflow-line bg-paper px-2.5 py-2 text-sm font-bold text-brown outline-none transition focus:border-latte-deep focus:bg-card"
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
                      <div className="mt-2 space-y-1 rounded-petflow-sm bg-paper/60 px-2 py-1.5 text-[10px] text-brown-soft">
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
                      className="mt-0.5 w-full rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-xs"
                      rows={2}
                      onBlur={(e) => saveCatNote(cat.id, e.target.value, cat.photoDataUrl)}
                    />
                  </label>
                  <label className="mt-2 block rounded-petflow-sm border border-wait/40 bg-wait/5 px-2 py-1.5 text-[10px] font-bold text-wait">
                    🔒 โน้ตลับร้าน (ลูกค้าไม่เห็น)
                    <textarea
                      defaultValue={cat.staffPrivateNote}
                      placeholder="เช่น กัด ข่วน ดุมาก ระวังตอนอาบน้ำ — เฉพาะพนักงาน"
                      className="mt-0.5 w-full rounded-petflow-sm border border-wait/30 bg-card px-2 py-1.5 text-xs font-normal text-brown"
                      rows={2}
                      onBlur={(e) => saveCatPrivateNote(cat.id, e.target.value)}
                    />
                  </label>
                  {(() => {
                    const gi = parseGroomInfo(cat.groomHealthInfo);
                    if (!gi) {
                      return (
                        <div className="mt-2 rounded-petflow-sm border border-petflow-line bg-paper/60 px-2 py-1.5">
                          <p className="text-[10px] font-extrabold text-brown-faint">
                            🩺 ประวัติก่อนอาบน้ำ — ลูกค้ายังไม่ได้กรอก
                          </p>
                        </div>
                      );
                    }
                    const s = groomInfoSummary(gi);
                    return (
                      <div className="mt-2 rounded-petflow-sm border border-sage/40 bg-sage/10 px-2 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-extrabold text-ok">
                            🩺 ประวัติก่อนอาบน้ำ (ลูกค้ากรอกไว้)
                          </p>
                          {gi.submittedAt && (
                            <p className="text-[9px] text-brown-faint">
                              {new Date(gi.submittedAt).toLocaleString("th-TH", {
                                dateStyle: "medium",
                                timeStyle: "short",
                                calendar: "gregory",
                              })}
                            </p>
                          )}
                        </div>
                        <dl className="mt-1.5 space-y-1 text-[10px] text-brown">
                          {Object.entries(s).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <dt className="w-24 shrink-0 font-bold text-brown-soft">{k}</dt>
                              <dd className="min-w-0 flex-1 break-words">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })()}
                  <label className="mt-2 block text-[10px] font-bold text-latte-deep">
                    📷 รูปโปรไฟล์ (ลูกค้าเห็นในแอปด้วย)
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

                  <CatMediaGallery customerId={c.id} cat={cat} onSaved={() => open(c.id)} />
                </div>
              </div>
            </div>
          ))}
        </section>

        <PackageHistorySection
          customerId={c.id}
          usage={selected.history.packageUsage || []}
          onChanged={() => open(c.id)}
        />

        <MemberTopupSection
          customerId={c.id}
          memberCredit={c.memberCredit}
          onDone={() => open(c.id)}
        />

        <MemberCreditHistorySection
          customerId={c.id}
          memberCredit={c.memberCredit}
          topups={selected.history.memberTopups || []}
          usage={selected.history.memberCreditUsage || []}
          onChanged={() => open(c.id)}
        />

        <CustomerAppointmentsSection
          bookings={selected.history.upcomingBookings || []}
          onRefresh={() => open(c.id)}
        />

        <StaysConsentSection
          bookings={[
            ...(selected.history.upcomingBookings || []),
            ...(selected.history.pastBookings || []),
          ]}
        />

        <ServiceHistorySection
          customerId={c.id}
          services={selected.history.services}
          pastBookings={selected.history.pastBookings || []}
          onChanged={() => open(c.id)}
        />

        <section className="rounded-petflow bg-card p-4">
          <h2 className="mb-2 text-sm font-extrabold">🎁 ประวัติแลกแต้ม</h2>
          <ul className="space-y-2 text-xs text-brown-soft">
            {selected.history.points.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span>
                  {p.at.slice(0, 10)} · {p.labelTh} · {p.points > 0 ? "+" : ""}
                  {p.points} แต้ม
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        `ลบรายการนี้? (${p.labelTh} · ${p.points > 0 ? "+" : ""}${p.points} แต้ม)\n` +
                          `ระบบจะปรับยอดแต้มคงเหลือย้อนกลับให้อัตโนมัติ` +
                          (p.points < 0
                            ? "\n\n⚠️ ถ้ารายการนี้เคยออกคูปองส่วนลดไปแล้ว การลบนี้ไม่ยกเลิกคูปองให้ — ไปเช็ค/ยกเลิกคูปองแยกต่างหากถ้าจำเป็น"
                            : "")
                      )
                    )
                      return;
                    const res = await fetch("/api/points", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "delete_history", entryId: p.id }),
                    });
                    if (res.ok) {
                      toast("ลบประวัติแต้มแล้ว", "success");
                      open(c.id);
                    } else {
                      toast("ลบไม่สำเร็จ", "error");
                    }
                  }}
                  className="shrink-0 text-[11px] font-bold text-wait"
                  aria-label="ลบรายการนี้"
                >
                  🗑️
                </button>
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
      <h1 className="mb-4 text-lg font-extrabold text-petflow-chocolate">👤 ลูกค้า</h1>
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
          className="w-full rounded-petflow-sm border border-petflow-line bg-card px-4 py-3 text-sm"
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

      {/* ตัวกรอง — กลุ่มลูกค้า / สถานะ LINE */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as CustomerTier | "all")}
          className="rounded-petflow-sm border border-petflow-line bg-card px-3 py-2 text-xs font-bold text-brown"
        >
          <option value="all">ทุกกลุ่ม</option>
          {(Object.keys(TIER_LABELS) as CustomerTier[]).map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value as "all" | "linked" | "unlinked")}
          className="rounded-petflow-sm border border-petflow-line bg-card px-3 py-2 text-xs font-bold text-brown"
        >
          <option value="all">ทุกสถานะ LINE</option>
          <option value="linked">✅ ผูก LINE แล้ว</option>
          <option value="unlinked">⏳ ยังไม่ผูก LINE</option>
        </select>
        {(tierFilter !== "all" || lineFilter !== "all" || q) && (
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-petflow-sm bg-paper px-3 py-2 text-xs font-bold text-brown-soft"
          >
            ↺ รีเซ็ต
          </button>
        )}
      </div>

      {/* เครื่องมือ (QR ลงทะเบียน / Export) — ซ่อนไว้ให้หน้าโล่ง */}
      <button
        type="button"
        onClick={() => setShowTools((v) => !v)}
        className="mb-3 w-full rounded-petflow-sm bg-paper px-4 py-2 text-left text-[11px] font-bold text-brown-soft"
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
            {visibleList.length} ราย
            {visibleList.length !== list.length ? ` (จากทั้งหมด ${list.length})` : ""}
          </p>

          {/* ── ตาราง (จอกว้าง) — คลิกหัวคอลัมน์เพื่อเรียง ── */}
          <div className="mb-4 hidden overflow-x-auto rounded-petflow border border-petflow-line bg-card shadow-petflow-sm md:block">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className="border-b border-petflow-line bg-paper/60 text-[10px] font-extrabold uppercase tracking-wide text-brown-soft">
                  <SortableTh label="ลูกค้า" sortKey="name" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2.5">แมว</th>
                  <th className="px-3 py-2.5">LINE</th>
                  <th className="px-3 py-2.5">เบอร์โทร</th>
                  <SortableTh label="วันเกิด" sortKey="birthday" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="กลุ่ม" sortKey="tier" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="แต้ม" sortKey="points" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="เครดิต" sortKey="credit" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="นัด" sortKey="upcoming" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="สมัคร" sortKey="recent" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visibleList.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => open(c.id)}
                    className="cursor-pointer border-b border-petflow-line last:border-0 transition hover:bg-paper/50"
                  >
                    <td className="px-3 py-2.5 font-bold text-brown">
                      {c.name}
                      {c.isMember && <span className="ml-1">💎</span>}
                      {c.lineDisplayName && c.lineDisplayName !== c.name && (
                        <span className="block text-[10px] font-normal text-brown-faint">
                          LINE: {c.lineDisplayName}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-brown-soft">
                      {c.cats.map((x) => x.name).filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.lineUserId ? (
                        <span className="rounded-full bg-sage/20 px-2 py-0.5 text-[10px] font-bold text-ok">
                          ✅ ผูกแล้ว
                        </span>
                      ) : (
                        <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-brown-faint">
                          ยังไม่ผูก
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-brown-soft">{c.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-brown-soft">{c.birthday || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tierBadgeClass(c.tier || "new")}`}>
                        {TIER_LABELS[c.tier || "new"]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-latte-deep">
                      {c.points || 0}
                    </td>
                    <td className="px-3 py-2.5 text-right text-brown-soft">
                      {c.memberCredit ? `${c.memberCredit.toLocaleString()}฿` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-brown-soft">
                      {c.upcomingAppointments ? `📅 ${c.upcomingAppointments}` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-brown-soft">
                      {c.createdAt ? c.createdAt.slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label="ลบลูกค้า"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomerRow(c);
                        }}
                        className="text-brown-faint transition hover:text-wait"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleList.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-brown-soft">
                      ไม่พบลูกค้า
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── การ์ด (มือถือ) ── */}
          <ul className="divide-y divide-petflow-line overflow-hidden rounded-petflow border border-petflow-line bg-card shadow-petflow-sm md:hidden">
            {visibleList.map((c) => {
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
            {visibleList.length === 0 && (
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

function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const isActive = active === sortKey;
  return (
    <th className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-0.5 ${isActive ? "text-petflow-chocolate" : "text-brown-soft"}`}
      >
        {label}
        <span className="text-[9px]">{isActive ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
