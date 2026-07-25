"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookingEditModal, type EditableBooking } from "@/components/BookingEditModal";
import { CustomerSendButtons } from "@/components/CustomerSendButtons";
import { InvoiceActionButtons } from "@/components/InvoiceActionButtons";
import { bookingOnDate } from "@/lib/booking-customer-match";
import { toast } from "@/components/Toast";
import { groupBookings } from "@/lib/booking-group";
import { groomProgram } from "@/lib/grooming-prices";

type CalendarDay = EditableBooking & {
  customerId?: string;
  careNote?: string;
  consentAcceptedAt?: string;
  consentSignature?: string;
  arrivalTime?: string;
  pickupTime?: string;
  /** ลูกค้าจองเองผ่านแอป — รอร้านกดรับคิว (ไม่ใช่รอลูกค้าตอบรับ) */
  selfBooked?: boolean;
};

function formatThaiDateTime(iso: string) {
  const d = new Date(iso);
  const day = formatThaiDate(iso.slice(0, 10));
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time} น.`;
}

function bookingWhen(b: CalendarDay) {
  if (b.service === "room" || b.checkin) {
    return `${b.checkin || b.date}${b.checkout ? ` → ${b.checkout}` : ""}`;
  }
  return `${b.date} ${b.time || ""}`.trim();
}

/** ปุ่ม "ออกบิล" ที่รู้สถานะบิลของนัดนี้ — กันออกบิลซ้ำ (1 นัด = 1 บิลเท่านั้น) */
function BillButton({
  bookingId,
  onPaidState,
}: {
  bookingId: string;
  /** แจ้งการ์ดแม่ว่าบิลของนัดนี้จ่ายจบแล้วหรือยัง — เอาไว้ติดป้าย "จบเคส" ทั้งใบ */
  onPaidState?: (paid: boolean) => void;
}) {
  const [inv, setInv] = useState<{ id: string; status: string; total: number } | null | undefined>(
    undefined
  );

  useEffect(() => {
    let alive = true;
    fetch(`/api/invoices?bookingId=${bookingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setInv(d.invoice || null);
        onPaidState?.(d.invoice?.status === "paid");
      })
      .catch(() => {
        if (alive) setInv(null);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  if (inv === undefined) {
    return (
      <span className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-brown-faint">
        🧾 …
      </span>
    );
  }
  if (inv?.status === "paid") {
    return (
      <span className="rounded-full bg-ok/15 px-2.5 py-1 text-[10px] font-extrabold text-ok">
        ✅ บิลปิดแล้ว ({inv.total.toLocaleString()}฿)
      </span>
    );
  }
  if (inv) {
    return (
      <Link
        href={`/admin/billing?bookingId=${bookingId}`}
        className="rounded-full bg-honey/45 px-2.5 py-1 text-[10px] font-extrabold text-petflow-chocolate"
      >
        🧾 แก้ไขบิล ({inv.total.toLocaleString()}฿ · ค้างอยู่)
      </Link>
    );
  }
  return (
    <Link
      href={`/admin/billing?bookingId=${bookingId}`}
      className="rounded-full bg-honey/45 px-2.5 py-1 text-[10px] font-extrabold text-petflow-chocolate"
    >
      🧾 ออกบิล
    </Link>
  );
}



function formatThaiDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${d} ${months[m - 1]} ${y + 543}`;
}

/** ตารางนัด + รายการนัดรายวัน — ใช้ในหน้า /admin/schedule */
export function BookingCalendar() {
  const [bookings, setBookings] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CalendarDay | null>(null);
  const [zoomSignature, setZoomSignature] = useState<string | null>(null);
  // นัดที่บิลจ่ายจบแล้ว (รายงานขึ้นมาจาก BillButton) — ติดป้าย "จบเคส" ให้เห็นชัดทั้งการ์ด
  const [paidCases, setPaidCases] = useState<Record<string, boolean>>({});
  const [rooms, setRooms] = useState<{ id: string; name: string; size: string; price: number }[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);
  const [closedDates, setClosedDates] = useState<{ date: string; note?: string }[]>([]);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);
  const [togglingClosed, setTogglingClosed] = useState(false);
  const queueRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/bookings");
    const data = await res.json().catch(() => ({ bookings: [] }));
    setBookings(data.bookings || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadConfig = useCallback(async () => {
    const d = await fetch("/api/config").then((r) => r.json());
    if (d.config?.rooms) setRooms(d.config.rooms);
    if (d.config?.groomSlots) setGroomSlots(d.config.groomSlots);
    setClosedDates(d.config?.closedDates || []);
    setClosedWeekdays(d.config?.closedWeekdays || []);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const today = new Date().toISOString().slice(0, 10);
  const activeDate = selectedDate || today;
  const activeWeekday = new Date(`${activeDate}T00:00:00`).getDay();
  const closedByWeekday = closedWeekdays.includes(activeWeekday);
  const closedByDate = closedDates.some((c) => c.date === activeDate);
  const dayIsClosed = closedByWeekday || closedByDate;

  /** ปิด/เปิดรับคิววันที่กำลังดูอยู่แบบเร็วๆ จากตารางนัด — เพิ่ม/ลบวันนี้ออกจาก closedDates
   * (ถ้าปิดเพราะเป็นวันหยุดประจำสัปดาห์อยู่แล้ว ต้องไปแก้ที่ตั้งค่า > อาบน้ำ ปุ่มนี้จัดการได้แค่วันเฉพาะกิจ) */
  const toggleDayClosed = async () => {
    if (closedByWeekday) return;
    setTogglingClosed(true);
    const nextClosedDates = closedByDate
      ? closedDates.filter((c) => c.date !== activeDate)
      : [...closedDates, { date: activeDate, note: "ปิดจากตารางนัด" }];
    const res = await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch: { closedDates: nextClosedDates } }),
    });
    if (res.ok) {
      setClosedDates(nextClosedDates);
      toast(closedByDate ? "เปิดรับคิววันนี้แล้ว ✔️" : "ปิดรับคิววันนี้แล้ว 🚫", "success");
    } else {
      toast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "error");
    }
    setTogglingClosed(false);
  };

  const [viewMonth, setViewMonth] = useState(() => today.slice(0, 7));

  const liveBookings = bookings.filter((b) => b.status !== "cancelled");
  const dayBookings = liveBookings.filter((b) => bookingOnDate(b, activeDate));

  const pickDate = (key: string) => {
    setSelectedDate(key);
    queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const confirmBooking = async (b: CalendarDay) => {
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, action: "confirm", lineUserId: b.lineUserId }),
    });
    const d = await res.json().catch(() => ({}));
    // notifyError = ยืนยันนัดสำเร็จ แต่แจ้งลูกค้าทาง LINE ไม่สำเร็จ (คนละเรื่องกับ res.ok)
    return { ok: res.ok, notifyError: d.notifyError as string | undefined };
  };

  const cancelBooking = async (b: CalendarDay) => {
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, action: "cancel" }),
    });
    return res.ok;
  };

  // การ์ดที่รวมหลายตัวในบ้านเดียวกัน (นัดเดียวกัน) — ยืนยัน/ยกเลิกให้ครบทุกตัวในทีเดียว
  const confirmGroup = async (group: CalendarDay[]) => {
    const results = await Promise.all(group.map(confirmBooking));
    if (results.every((r) => r.ok)) toast("ยืนยันนัดแล้ว ✔️", "success");
    else toast("ยืนยันไม่สำเร็จบางรายการ", "error");
    const notifyErr = results.find((r) => r.notifyError)?.notifyError;
    if (notifyErr) toast(`⚠️ ยืนยันนัดแล้ว แต่แจ้งลูกค้าทาง LINE ไม่สำเร็จ: ${notifyErr}`, "error");
    load();
  };

  const cancelGroup = async (group: CalendarDay[]) => {
    const names = group.map((b) => b.catName).join(", ");
    const label = group[0].service === "room" ? "การเข้าพัก" : "นัด";
    if (!confirm(`ยกเลิก${label} ${names} · ${group[0].customerName}?`)) return;
    const results = await Promise.all(group.map(cancelBooking));
    if (results.every(Boolean)) toast("ยกเลิกแล้ว", "info");
    else toast("ยกเลิกไม่สำเร็จบางรายการ", "error");
    load();
  };

  // เดือนที่กำลังดู — เลื่อนไปเดือนอื่นได้ (ดูนัดล่วงหน้า/ย้อนหลัง)
  const [y, m] = viewMonth.split("-").map(Number);
  const ym = viewMonth;
  const shiftMonth = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startPad = firstDay.getDay();

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-5">
      {editing && (
        <BookingEditModal
          booking={editing}
          rooms={rooms}
          groomSlots={groomSlots}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}

      <section className="rounded-petflow bg-card p-4 shadow-petflow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="เดือนก่อนหน้า"
              className="rounded-full bg-paper px-2.5 py-1 text-sm font-extrabold text-brown-soft"
            >
              ‹
            </button>
            <h2 className="text-base font-extrabold text-petflow-chocolate">
              🗓️ ตารางนัดเดือน {m}/{y}
            </h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="เดือนถัดไป"
              className="rounded-full bg-paper px-2.5 py-1 text-sm font-extrabold text-brown-soft"
            >
              ›
            </button>
          </div>
          {(activeDate !== today || ym !== today.slice(0, 7)) && (
            <button
              type="button"
              onClick={() => {
                setViewMonth(today.slice(0, 7));
                pickDate(today);
              }}
              className="rounded-full bg-honey/30 px-3 py-1 text-[10px] font-bold text-petflow-chocolate"
            >
              กลับวันนี้
            </button>
          )}
        </div>
        <p className="mb-2.5 text-xs text-brown-soft">แตะวันที่เพื่อดูรายการ · กดจองคิวได้เลย</p>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
            <div key={d} className="pb-1 text-xs font-bold text-brown-faint">
              {d}
            </div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = `${ym}-${String(day).padStart(2, "0")}`;
            const dayItems = liveBookings.filter((b) => bookingOnDate(b, key));
            const stays = dayItems.filter((b) => b.service === "room").length;
            const appts = dayItems.length - stays;
            const isToday = key === today;
            const isSelected = key === activeDate;
            const keyClosed =
              closedWeekdays.includes(new Date(`${key}T00:00:00`).getDay()) ||
              closedDates.some((c) => c.date === key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickDate(key)}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition ${
                  isSelected
                    ? "bg-latte/40 text-petflow-chocolate ring-2 ring-latte-deep"
                    : isToday
                      ? "bg-honey/40 text-petflow-chocolate ring-1 ring-honey-deep"
                      : keyClosed
                        ? "bg-wait/10 text-brown-faint hover:bg-wait/15"
                        : stays > 0
                          ? "bg-sage/25 text-brown hover:bg-sage/35"
                          : "bg-paper/60 text-brown hover:bg-paper"
                }`}
              >
                <span className="text-base font-extrabold leading-none">{day}</span>
                {keyClosed && (
                  <span className="rounded-full bg-wait px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    🚫 ปิด
                  </span>
                )}
                {!keyClosed && stays > 0 && (
                  <span className="rounded-full bg-ok px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    🏠 พัก{stays > 1 ? ` ${stays}` : ""}
                  </span>
                )}
                {!keyClosed && appts > 0 && (
                  <span className="rounded-full bg-latte-deep px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    {appts} นัด
                  </span>
                )}
                {!keyClosed && stays === 0 && appts === 0 && <span className="h-[15px]" />}
              </button>
            );
          })}
        </div>
      </section>

      <section ref={queueRef} className="rounded-petflow bg-card p-4 shadow-petflow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-petflow-chocolate">
              📋 วันที่ {formatThaiDate(activeDate)}
            </h2>
            <p className="text-[10px] text-brown-soft">
              {(() => {
                const stays = dayBookings.filter((b) => b.service === "room").length;
                const appts = dayBookings.length - stays;
                const parts = [
                  stays > 0 ? `🏠 เข้าพัก ${stays}` : "",
                  appts > 0 ? `🛁 นัด ${appts}` : "",
                ].filter(Boolean);
                return (parts.length ? parts.join(" · ") : "ไม่มีรายการ") +
                  (activeDate === today ? " (วันนี้)" : "");
              })()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={togglingClosed || closedByWeekday}
              onClick={toggleDayClosed}
              title={
                closedByWeekday
                  ? "ปิดเพราะเป็นวันหยุดประจำสัปดาห์ — ไปแก้ที่ ตั้งค่า > อาบน้ำ"
                  : undefined
              }
              className={`rounded-petflow-sm px-3 py-2.5 text-xs font-extrabold shadow-petflow-sm transition disabled:opacity-60 ${
                dayIsClosed
                  ? "border border-wait bg-wait/10 text-wait"
                  : "border border-petflow-line bg-card text-brown-soft"
              }`}
            >
              {togglingClosed ? "…" : dayIsClosed ? "🚫 ปิดรับคิวอยู่" : "✅ เปิดรับคิว"}
            </button>
            <Link
              href={`/admin/bookings/new?date=${activeDate}`}
              className="rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep px-4 py-2.5 text-xs font-extrabold text-petflow-chocolate shadow-petflow-sm"
            >
              ➕ จองคิววันนี้
            </Link>
          </div>
        </div>
        {dayIsClosed && (
          <p className="mb-3 rounded-petflow-sm bg-wait/10 px-3 py-2 text-xs font-bold text-wait">
            🚫 ลูกค้าจองคิวเอง/ห้องพักเองในวันนี้ไม่ได้
            {closedByWeekday
              ? " (วันหยุดประจำสัปดาห์)"
              : " — กดปุ่มด้านบนอีกครั้งเพื่อเปิดรับคิว"}
          </p>
        )}
        <ul className="space-y-2">
          {dayBookings.length === 0 ? (
            <li className="rounded-petflow-sm border border-dashed border-petflow-line py-6 text-center">
              <p className="text-xs text-brown-soft">ไม่มีนัด/การเข้าพักในวันนี้</p>
              <Link
                href={`/admin/bookings/new?date=${activeDate}`}
                className="mt-2 inline-block text-xs font-bold text-latte-deep underline"
              >
                ➕ จองคิววันที่ {formatThaiDate(activeDate)}
              </Link>
            </li>
          ) : (
            groupBookings(dayBookings).map((group) => {
              const b = group[0];
              const allConfirmed = group.every((x) => x.status === "confirmed");
              const catNames = group.map((x) => x.catName).join(", ");
              const caseDone = paidCases[b.id] === true;
              return (
              <li
                key={group.map((x) => x.id).join(",")}
                className={`rounded-petflow-sm border p-3 ${
                  caseDone
                    ? "border-ok/50 bg-ok/5"
                    : "border-petflow-line bg-paper/50"
                }`}
              >
                {caseDone && (
                  <p className="mb-2 flex items-center gap-1.5 rounded-petflow-sm bg-ok/15 px-2.5 py-1.5 text-[11px] font-extrabold text-ok">
                    🎉 เคสนี้จบแล้ว — ชำระครบ ปิดงานเรียบร้อย
                  </p>
                )}
                {/* นัดที่ลูกค้าจองเอง ต่างจากนัดที่ร้านสร้าง: "รอยืนยัน" = รอ "ร้าน" กดรับ ไม่ใช่รอลูกค้า */}
                {!allConfirmed && group.some((x) => x.selfBooked) && (
                  <p className="mb-2 rounded-petflow-sm bg-honey/25 px-2.5 py-1.5 text-[11px] font-extrabold text-wait">
                    🙋 ลูกค้าจองเองผ่านแอป — กด “✔️ ยืนยันนัด” เพื่อรับคิว
                    (ระบบจะแจ้งลูกค้าทาง LINE ให้อัตโนมัติ)
                  </p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brown break-words">
                      👤 {b.customerName}
                      <span className="ml-2 font-normal text-brown-soft">
                        🐱 {catNames}
                        {group.length > 1 ? ` (${group.length} ตัว)` : ""}
                      </span>
                    </p>
                    <p className="text-xs text-brown-soft break-words">
                      {b.service === "room" ? "🏠 ห้องพัก" : "🛁 อาบน้ำ"} · {bookingWhen(b)}
                    </p>
                    {b.groomProgram && (
                      <p className="text-[11px] font-bold text-latte-deep">
                        🧴 {groomProgram(b.groomProgram)?.name || b.groomProgram}
                      </p>
                    )}
                    {b.service === "room" &&
                      (b.consentAcceptedAt ? (
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-[11px] font-bold text-ok">
                            ✅ ยอมรับข้อตกลงแล้ว เมื่อ {formatThaiDateTime(b.consentAcceptedAt)}
                          </p>
                          {b.consentSignature && (
                            <button
                              type="button"
                              onClick={() => setZoomSignature(b.consentSignature!)}
                              className="shrink-0"
                              title="กดดูลายเซ็นแบบเต็ม"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={b.consentSignature}
                                alt="ลายเซ็นลูกค้า — กดเพื่อดูขยาย"
                                className="h-6 w-14 rounded border border-petflow-line bg-white object-contain"
                              />
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] font-bold text-wait">
                          ⏳ ยังไม่กดยอมรับข้อตกลง
                        </p>
                      ))}
                    {(b.arrivalTime || b.pickupTime) && (
                      <p className="mt-1 text-[11px] font-bold text-latte-deep">
                        {b.arrivalTime && `🚗 ลูกค้าแจ้งเวลาส่งน้อง: ${b.arrivalTime}`}
                        {b.arrivalTime && b.pickupTime && " · "}
                        {b.pickupTime && `🚗 ลูกค้าแจ้งเวลารับน้อง: ${b.pickupTime}`}
                      </p>
                    )}
                    {group
                      .filter((x) => x.careNote)
                      .map((x) => (
                        <p
                          key={x.id}
                          className="mt-1 rounded-petflow-sm bg-sage/15 px-2 py-1 text-[11px] text-brown break-words"
                        >
                          📝 {x.catName}: {x.careNote}
                        </p>
                      ))}
                    {b.customerId ? (
                      <Link
                        href={`/admin/customers?id=${b.customerId}`}
                        className="mt-1 inline-block text-[10px] font-bold text-latte-deep underline"
                      >
                        👤 ดูข้อมูลลูกค้า
                      </Link>
                    ) : (
                      <p className="mt-1 text-[10px] text-brown-faint">ยังไม่มีข้อมูลลูกค้าในระบบ</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      caseDone
                        ? "bg-ok text-white"
                        : allConfirmed
                          ? "bg-sage/20 text-ok"
                          : "bg-honey/25 text-wait"
                    }`}
                  >
                    {caseDone ? "✅ จบเคส" : allConfirmed ? "ยืนยัน" : "รอยืนยัน"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!allConfirmed && (
                    <button
                      type="button"
                      onClick={() => confirmGroup(group)}
                      className="rounded-full bg-sage/25 px-2.5 py-1 text-[10px] font-bold text-ok"
                    >
                      ✔️ ยืนยันนัด
                    </button>
                  )}
                  {group.length > 1 ? (
                    group.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setEditing(x)}
                        className="rounded-full bg-honey/25 px-2.5 py-1 text-[10px] font-bold text-petflow-chocolate"
                      >
                        ✏️ แก้ไข {x.catName}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditing(b)}
                      className="rounded-full bg-honey/25 px-2.5 py-1 text-[10px] font-bold text-petflow-chocolate"
                    >
                      ✏️ แก้ไข
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => cancelGroup(group)}
                    className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-wait"
                  >
                    ❌ ยกเลิก
                  </button>
                  <a
                    href={`/api/calendar/${b.id}`}
                    className="rounded-full bg-paper px-2 py-1 text-[10px] font-bold text-brown-soft"
                  >
                    📲 iCal
                  </a>
                  <BillButton
                    bookingId={b.id}
                    onPaidState={(paid) =>
                      setPaidCases((prev) =>
                        prev[b.id] === paid ? prev : { ...prev, [b.id]: paid }
                      )
                    }
                  />
                </div>
                <div className="mt-2 border-t border-petflow-line pt-2">
                  <CustomerSendButtons
                    bookingId={b.id}
                    lineUserId={b.lineUserId}
                    customerId={b.customerId}
                    service={b.service}
                    groomBookingIds={group.length > 1 ? group.map((x) => x.id) : undefined}
                    initialAutoOff={b.autoOff}
                    onDone={load}
                  />
                  <InvoiceActionButtons bookingId={b.id} onDone={load} />
                </div>
              </li>
              );
            })
          )}
        </ul>
      </section>

      {zoomSignature && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
          onClick={() => setZoomSignature(null)}
        >
          <div
            className="max-w-md rounded-petflow bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-xs font-bold text-brown-soft">
              ✍️ ลายเซ็นยืนยันตัวตนของลูกค้า
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoomSignature} alt="ลายเซ็นลูกค้าแบบเต็ม" className="w-full" />
            <button
              type="button"
              onClick={() => setZoomSignature(null)}
              className="mt-3 w-full rounded-petflow-sm bg-paper py-2 text-xs font-bold text-brown-soft"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
