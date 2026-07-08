"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Booking } from "@/lib/business";
import { adminJson } from "@/lib/admin-fetch";

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

type CalendarDay = Booking & {
  lineUserId?: string;
  service?: "groom" | "room";
  room?: string;
  checkin?: string;
  checkout?: string;
  notes?: string;
};

function bookingWhen(b: CalendarDay) {
  if (b.service === "room" || b.checkin) {
    return `${b.checkin || b.date}${b.checkout ? ` → ${b.checkout}` : ""}`;
  }
  return `${b.date} ${b.time || ""}`.trim();
}

function BookingEditModal({
  booking,
  rooms,
  groomSlots,
  onClose,
  onSaved,
}: {
  booking: CalendarDay;
  rooms: { id: string; name: string; size: string; price: number }[];
  groomSlots: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [service, setService] = useState<"groom" | "room">(
    booking.service || (booking.roomType || booking.checkin ? "room" : "groom")
  );
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const payload =
      service === "groom"
        ? {
            action: "update",
            customerName: String(fd.get("customer") || ""),
            catName: String(fd.get("cat") || ""),
            service: "groom" as const,
            date: String(fd.get("date") || ""),
            time: String(fd.get("time") || "") || undefined,
            notes: String(fd.get("notes") || "") || undefined,
          }
        : {
            action: "update",
            customerName: String(fd.get("customer") || ""),
            catName: String(fd.get("cat") || ""),
            service: "room" as const,
            room: String(fd.get("room") || "") || undefined,
            checkin: String(fd.get("checkin") || ""),
            checkout: String(fd.get("checkout") || ""),
            date: String(fd.get("checkin") || ""),
            notes: String(fd.get("notes") || "") || undefined,
          };

    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: booking.id, ...payload }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      alert("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-catcha bg-card p-5 shadow-catcha">
        <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">✏️ แก้ไขนัด</h2>
        <div className="mb-3 flex gap-2">
          {(
            [
              { id: "groom" as const, label: "🛁 อาบน้ำ" },
              { id: "room" as const, label: "🏠 ห้องพัก" },
            ] as const
          ).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setService(s.id)}
              className={`flex-1 rounded-catcha-sm py-2 text-xs font-bold ${
                service === s.id ? "bg-honey/45 text-catcha-chocolate" : "bg-paper text-brown-soft"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <EditField label="ชื่อลูกค้า" name="customer" defaultValue={booking.customerName} required />
          <EditField label="ชื่อน้องแมว" name="cat" defaultValue={booking.catName} required />
          {service === "groom" ? (
            <>
              <EditField label="วันที่นัด" name="date" type="date" defaultValue={booking.date} required />
              <label className="block text-xs font-bold text-brown-soft">
                รอบเวลา
                <input
                  name="time"
                  type="time"
                  list="edit-groom-slots"
                  defaultValue={booking.time || "12:30"}
                  className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                />
                <datalist id="edit-groom-slots">
                  {groomSlots.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs font-bold text-brown-soft">
                ห้อง
                <select
                  name="room"
                  defaultValue={booking.room || booking.roomType || ""}
                  className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.size})
                    </option>
                  ))}
                </select>
              </label>
              <EditField label="เช็คอิน" name="checkin" type="date" defaultValue={booking.checkin || booking.date} required />
              <EditField label="เช็คเอาท์" name="checkout" type="date" defaultValue={booking.checkout || ""} required />
            </>
          )}
          <EditField label="โน้ต" name="notes" defaultValue={booking.notes || ""} textarea />
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-catcha-sm bg-paper py-2.5 text-xs font-bold text-brown-soft"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-catcha-sm bg-honey/40 py-2.5 text-xs font-extrabold text-catcha-chocolate disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditField({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  textarea,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm";
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} className={cls} rows={2} />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          className={cls}
        />
      )}
    </label>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [calendar, setCalendar] = useState<Record<string, CalendarDay[]>>({});
  const [bookings, setBookings] = useState<CalendarDay[]>([]);
  const [view, setView] = useState<"today" | "week">("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<CalendarDay | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string; size: string; price: number }[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);

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
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const filtered = bookings.filter((b) => {
    if (b.status === "cancelled") return false;
    const d = b.date || b.checkin || "";
    if (view === "today") return d === today;
    return d >= today && d <= weekEndStr;
  });

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
        <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">
          🗓️ ตารางนัดเดือน {m}/{y}
        </h2>
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
            return (
              <div
                key={key}
                className={`rounded-lg py-1.5 ${
                  isToday ? "bg-honey/40 font-extrabold text-catcha-chocolate" : "bg-paper/50"
                } ${count ? "ring-1 ring-latte/40" : ""}`}
              >
                {day}
                {count > 0 && (
                  <div className="text-[8px] text-latte-deep">{count}นัด</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex gap-2">
        {(["today", "week"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-2 text-xs font-bold ${
              view === v ? "bg-honey/50 text-catcha-chocolate" : "bg-paper text-brown-soft"
            }`}
          >
            {v === "today" ? "📅 วันนี้" : "🗓️ 7 วัน"}
          </button>
        ))}
      </div>

      <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
        <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">คิวนัด</h2>
        <ul className="space-y-2">
          {filtered.length === 0 ? (
            <li className="text-center text-xs text-brown-soft py-4">ไม่มีนัดในช่วงนี้</li>
          ) : (
            filtered.map((b) => (
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
