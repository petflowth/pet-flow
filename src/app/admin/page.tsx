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

type CalendarDay = Booking & { lineUserId?: string };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [calendar, setCalendar] = useState<Record<string, CalendarDay[]>>({});
  const [bookings, setBookings] = useState<CalendarDay[]>([]);
  const [view, setView] = useState<"today" | "week">("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const today = stats?.today || new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const filtered = bookings.filter((b) => {
    const d = b.date || "";
    if (view === "today") return d === today;
    return d >= today && d <= weekEndStr;
  });

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
                    {b.date} {b.time || ""}
                  </p>
                </div>
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
