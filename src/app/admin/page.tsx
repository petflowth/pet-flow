"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminJson } from "@/lib/admin-fetch";
import { BookingEditModal, type EditableBooking } from "@/components/BookingEditModal";
import { bookingOnDate } from "@/lib/booking-customer-match";

type Stats = {
  today: string;
  queue: number;
  todayAppointments: number;
  todayConfirmed: number;
  salesToday: { total: number; count: number; pending: number };
  salesMonth: { total: number; count: number; pending: number };
  financeToday: { income: number; expense: number; net: number };
  financeMonth: { income: number; expense: number; net: number };
};

type CalendarDay = EditableBooking & { customerId?: string };

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

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [calendar, setCalendar] = useState<Record<string, CalendarDay[]>>({});
  const [bookings, setBookings] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CalendarDay | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string; size: string; price: number }[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);
  const queueRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [sResult, bResult] = await Promise.all([
      adminJson<{ stats: Stats; calendar: Record<string, CalendarDay[]> }>("/api/admin/stats"),
      adminJson<{ bookings: CalendarDay[] }>("/api/bookings"),
    ]);

    if (sResult.ok && sResult.data.stats) {
      setStats(sResult.data.stats);
      setCalendar(sResult.data.calendar || {});
      if (bResult.ok) setBookings(bResult.data.bookings || []);
      else setBookings([]);
      setSelectedDate((prev) => prev || sResult.data.stats.today);
    } else {
      setStats(null);
      setError(sResult.ok ? "โหลดสถิติไม่สำเร็จ" : sResult.error);
    }

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

  const today = stats?.today || new Date().toISOString().slice(0, 10);
  const activeDate = selectedDate || today;

  const dayBookings = bookings.filter(
    (b) => b.status !== "cancelled" && bookingOnDate(b, activeDate)
  );

  const pickDate = (key: string) => {
    setSelectedDate(key);
    queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancelBooking = async (b: CalendarDay) => {
    if (!confirm(`ยกเลิกนัด ${b.catName} · ${b.customerName}?`)) return;
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id, action: "cancel" }),
    });
    if (res.ok) {
      alert("ยกเลิกนัดแล้ว");
      load();
    } else {
      alert("ยกเลิกไม่สำเร็จ");
    }
  };

  const sendCard = async (b: CalendarDay) => {
    if (!b.lineUserId) {
      alert("ยังไม่มี LINE User ID");
      return;
    }
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: b.id,
        action: "send_reminder",
        lineUserId: b.lineUserId,
      }),
    });
    if (res.ok) alert("ส่งการ์ด LINE แล้ว 📨");
    else alert("ส่งไม่สำเร็จ");
  };

  const ym = today.slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startPad = firstDay.getDay();

  if (loading) {
    return <p className="text-center text-sm text-brown-soft py-10">กำลังโหลด…</p>;
  }

  if (!stats) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold text-wait">{error || "โหลดไม่สำเร็จ"}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-catcha-sm bg-honey/40 px-4 py-2 text-xs font-bold"
        >
          🔄 ลองใหม่
        </button>
      </div>
    );
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
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard emoji="💰" label="ยอดขายวันนี้" value={`${stats.salesToday.total.toLocaleString()} ฿`} sub={`${stats.salesToday.count} บิล`} />
          <StatCard emoji="⏳" label="คิวรอยืนยัน" value={String(stats.queue)} sub="นัด" />
          <StatCard emoji="📅" label="นัดวันนี้" value={String(stats.todayAppointments)} sub={`ยืนยัน ${stats.todayConfirmed}`} />
          <StatCard emoji="📒" label="สุทธิวันนี้" value={`${stats.financeToday.net.toLocaleString()} ฿`} sub={`เดือน ${stats.financeMonth.net.toLocaleString()} ฿`} />
        </div>
      )}

      <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-catcha-chocolate">
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
        <p className="mb-2 text-[10px] text-brown-soft">แตะวันที่เพื่อดูรายการนัด</p>
        <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-brown-faint">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
            <div key={d}>{d}</div>
          ))}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = `${ym}-${String(day).padStart(2, "0")}`;
            const count = calendar[key]?.length || 0;
            const isToday = key === today;
            const isSelected = key === activeDate;
            return (
              <button
                key={key}
                type="button"
                onClick={() => pickDate(key)}
                className={`rounded-lg py-1.5 transition ${
                  isSelected
                    ? "bg-latte/40 font-extrabold text-catcha-chocolate ring-2 ring-latte-deep"
                    : isToday
                      ? "bg-honey/40 font-extrabold text-catcha-chocolate"
                      : "bg-paper/50 hover:bg-paper"
                } ${count ? "ring-1 ring-latte/40" : ""}`}
              >
                {day}
                {count > 0 && (
                  <div className="text-[8px] text-latte-deep">{count}นัด</div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section ref={queueRef} className="rounded-catcha bg-card p-4 shadow-catcha-sm">
        <h2 className="mb-1 text-sm font-extrabold text-catcha-chocolate">
          📋 นัดวันที่ {formatThaiDate(activeDate)}
        </h2>
        <p className="mb-3 text-[10px] text-brown-soft">
          {dayBookings.length} นัด{activeDate === today ? " (วันนี้)" : ""}
        </p>
        <ul className="space-y-2">
          {dayBookings.length === 0 ? (
            <li className="text-center text-xs text-brown-soft py-4">ไม่มีนัดในวันนี้</li>
          ) : (
            dayBookings.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-2 rounded-catcha-sm border border-catcha-line bg-paper/50 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-brown">
                    {b.catName} · {b.customerName}
                  </p>
                  <p className="text-xs text-brown-soft">
                    {b.service === "room" ? "🏠 ห้องพัก" : "🛁 อาบน้ำ"} · {bookingWhen(b)}
                  </p>
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
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    b.status === "confirmed" ? "bg-sage/20 text-ok" : "bg-honey/25 text-wait"
                  }`}
                >
                  {b.status === "confirmed" ? "ยืนยัน" : "รอยืนยัน"}
                </span>
                {b.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => sendCard(b)}
                    className="rounded-full bg-latte/30 px-3 py-1.5 text-xs font-bold"
                  >
                    📨 ส่งการ์ด
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/admin/billing" className="rounded-catcha-sm bg-honey/30 py-3 text-center text-xs font-bold text-catcha-chocolate">
          💳 คิดเงิน
        </Link>
        <Link href="/admin/finance" className="rounded-catcha-sm bg-latte/20 py-3 text-center text-xs font-bold text-catcha-chocolate">
          📒 รายรับ-จ่าย
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
  sub,
}: {
  emoji: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-catcha-sm bg-card p-4 shadow-catcha-sm">
      <p className="text-lg">{emoji}</p>
      <p className="text-lg font-extrabold text-latte-deep">{value}</p>
      <p className="text-[10px] font-bold text-brown-soft">{label}</p>
      <p className="text-[9px] text-brown-faint">{sub}</p>
    </div>
  );
}
