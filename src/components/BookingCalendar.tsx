"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookingEditModal, type EditableBooking } from "@/components/BookingEditModal";
import { CustomerSendButtons } from "@/components/CustomerSendButtons";
import { bookingOnDate } from "@/lib/booking-customer-match";

type CalendarDay = EditableBooking & { customerId?: string; careNote?: string };

function bookingWhen(b: CalendarDay) {
  if (b.service === "room" || b.checkin) {
    return `${b.checkin || b.date}${b.checkout ? ` → ${b.checkout}` : ""}`;
  }
  return `${b.date} ${b.time || ""}`.trim();
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
  const [rooms, setRooms] = useState<{ id: string; name: string; size: string; price: number }[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);
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

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config?.rooms) setRooms(d.config.rooms);
        if (d.config?.groomSlots) setGroomSlots(d.config.groomSlots);
      });
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const activeDate = selectedDate || today;

  const liveBookings = bookings.filter((b) => b.status !== "cancelled");
  const dayBookings = liveBookings.filter((b) => bookingOnDate(b, activeDate));

  const pickDate = (key: string) => {
    setSelectedDate(key);
    queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelBooking = async (b: CalendarDay) => {
    if (!confirm(`ยกเลิก${b.service === "room" ? "การเข้าพัก" : "นัด"} ${b.catName} · ${b.customerName}?`)) return;
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, action: "cancel" }),
    });
    if (res.ok) {
      alert("ยกเลิกแล้ว");
      load();
    } else {
      alert("ยกเลิกไม่สำเร็จ");
    }
  };

  const ym = today.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
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

      <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-catcha-chocolate">
            🗓️ ตารางนัดเดือน {m}/{y}
          </h2>
          {activeDate !== today && (
            <button
              type="button"
              onClick={() => pickDate(today)}
              className="rounded-full bg-honey/30 px-3 py-1 text-[10px] font-bold text-catcha-chocolate"
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
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickDate(key)}
                className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-xl py-2 transition ${
                  isSelected
                    ? "bg-latte/40 text-catcha-chocolate ring-2 ring-latte-deep"
                    : isToday
                      ? "bg-honey/40 text-catcha-chocolate ring-1 ring-honey-deep"
                      : stays > 0
                        ? "bg-sage/25 text-brown hover:bg-sage/35"
                        : "bg-paper/60 text-brown hover:bg-paper"
                }`}
              >
                <span className="text-base font-extrabold leading-none">{day}</span>
                {stays > 0 && (
                  <span className="rounded-full bg-ok px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    🏠 พัก{stays > 1 ? ` ${stays}` : ""}
                  </span>
                )}
                {appts > 0 && (
                  <span className="rounded-full bg-latte-deep px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
                    {appts} นัด
                  </span>
                )}
                {stays === 0 && appts === 0 && <span className="h-[15px]" />}
              </button>
            );
          })}
        </div>
      </section>

      <section ref={queueRef} className="rounded-catcha bg-card p-4 shadow-catcha-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-catcha-chocolate">
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
          <Link
            href={`/admin/bookings/new?date=${activeDate}`}
            className="rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep px-4 py-2.5 text-xs font-extrabold text-catcha-chocolate shadow-catcha-sm"
          >
            ➕ จองคิววันนี้
          </Link>
        </div>
        <ul className="space-y-2">
          {dayBookings.length === 0 ? (
            <li className="rounded-catcha-sm border border-dashed border-catcha-line py-6 text-center">
              <p className="text-xs text-brown-soft">ไม่มีนัด/การเข้าพักในวันนี้</p>
              <Link
                href={`/admin/bookings/new?date=${activeDate}`}
                className="mt-2 inline-block text-xs font-bold text-latte-deep underline"
              >
                ➕ จองคิววันที่ {formatThaiDate(activeDate)}
              </Link>
            </li>
          ) : (
            dayBookings.map((b) => (
              <li
                key={b.id}
                className="rounded-catcha-sm border border-catcha-line bg-paper/50 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brown break-words">
                      {b.catName} · {b.customerName}
                    </p>
                    <p className="text-xs text-brown-soft break-words">
                      {b.service === "room" ? "🏠 ห้องพัก" : "🛁 อาบน้ำ"} · {bookingWhen(b)}
                    </p>
                    {b.careNote && (
                      <p className="mt-1 rounded-catcha-sm bg-sage/15 px-2 py-1 text-[11px] text-brown break-words">
                        📝 การดูแลจากลูกค้า: {b.careNote}
                      </p>
                    )}
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
                      b.status === "confirmed" ? "bg-sage/20 text-ok" : "bg-honey/25 text-wait"
                    }`}
                  >
                    {b.status === "confirmed" ? "ยืนยัน" : "รอยืนยัน"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  <a
                    href={`/api/calendar/${b.id}`}
                    className="rounded-full bg-paper px-2 py-1 text-[10px] font-bold text-brown-soft"
                  >
                    📲 iCal
                  </a>
                  <Link
                    href={`/admin/billing?bookingId=${b.id}`}
                    className="rounded-full bg-honey/45 px-2.5 py-1 text-[10px] font-extrabold text-catcha-chocolate"
                  >
                    🧾 ออกบิล
                  </Link>
                </div>
                <div className="mt-2 border-t border-catcha-line pt-2">
                  <CustomerSendButtons
                    bookingId={b.id}
                    lineUserId={b.lineUserId}
                    customerId={b.customerId}
                    service={b.service}
                    onDone={load}
                  />
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
