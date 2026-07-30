"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson } from "@/lib/admin-fetch";
import { DateRangePicker } from "@/components/DateRangePicker";
import { resolveRange, type RangeId } from "@/lib/date-range";

type Stats = {
  today: string;
  queue: number;
  todayAppointments: number;
  todayConfirmed: number;
  salesToday: {
    total: number;
    count: number;
    creditTotal: number;
    creditCount: number;
    grossTotal: number;
    pending: number;
  };
  salesMonth: { total: number; count: number; pending: number };
  financeToday: { income: number; expense: number; net: number };
  financeMonth: { income: number; expense: number; net: number };
};

type Tasks = { unpaidCount: number; unpaidDue: number; pendingConsent: number };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** ช่วงเวลาของตัวเลขยอดขาย/บัญชี — คิว "รอยืนยัน" กับ "นัดวันนี้" ยึดวันนี้เสมอ */
  const [rangeId, setRangeId] = useState<RangeId>("today");
  const [customRange, setCustomRange] = useState(() => {
    const t = new Date().toISOString().slice(0, 10);
    return { from: t, to: t };
  });
  const range = resolveRange(rangeId, new Date().toISOString().slice(0, 10), customRange);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await adminJson<{ stats: Stats }>(
      `/api/admin/stats?from=${range.from}&to=${range.to}`
    );
    if (res.ok && res.data.stats) {
      setStats(res.data.stats);
    } else {
      setStats(null);
      setError(res.ok ? "โหลดสถิติไม่สำเร็จ" : res.error);
    }
    // งานที่ต้องทำ — บิลค้าง + ลูกค้ายังไม่กดยอมรับเงื่อนไข
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [invR, bkR] = await Promise.all([
        fetch("/api/invoices").then((r) => r.json()),
        fetch("/api/bookings").then((r) => r.json()),
      ]);
      const invs = (invR.invoices || []) as { status: string; total: number; deposit?: number }[];
      const bks = (bkR.bookings || []) as {
        service?: string;
        checkin?: string;
        consentAcceptedAt?: string;
        status?: string;
      }[];
      const pending = invs.filter((i) => i.status === "pending");
      setTasks({
        unpaidCount: pending.length,
        unpaidDue: pending.reduce((s, i) => s + (i.total - (i.deposit || 0)), 0),
        pendingConsent: bks.filter(
          (b) =>
            b.service === "room" &&
            b.status !== "cancelled" &&
            (b.checkin || "") >= today &&
            !b.consentAcceptedAt
        ).length,
      });
    } catch {
      setTasks(null);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  if (!stats) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold text-wait">{error || "โหลดไม่สำเร็จ"}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-petflow-sm bg-honey/40 px-4 py-2 text-xs font-bold"
        >
          🔄 ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <DateRangePicker
        value={rangeId}
        onChange={setRangeId}
        custom={customRange}
        onCustomChange={setCustomRange}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          emoji="💰"
          label={`รายรับ · ${range.label}`}
          value={`${stats.financeToday.income.toLocaleString()} ฿`}
          sub={
            // ใช้ยอดจากบัญชีรายรับ ไม่ใช่เฉพาะบิล — ขายคอร์ส/เติมเครดิตก็คือเงินเข้าเหมือนกัน
            // (เมื่อก่อนการ์ดนี้นับเฉพาะบิล เลยไม่ตรงกับ "สุทธิ" ที่นับทุกอย่าง)
            [
              `${stats.salesToday.count} บิล`,
              stats.salesToday.creditTotal > 0
                ? `ตัดเครดิต ${stats.salesToday.creditTotal.toLocaleString()} ฿`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")
          }
        />
        <StatCard emoji="⏳" label="คิวรอยืนยัน" value={String(stats.queue)} sub="นัด" />
        <StatCard emoji="📅" label="นัดวันนี้" value={String(stats.todayAppointments)} sub={`ยืนยัน ${stats.todayConfirmed}`} />
        <StatCard
          emoji="📒"
          label={`สุทธิ · ${range.label}`}
          value={`${stats.financeToday.net.toLocaleString()} ฿`}
          sub={
            stats.financeToday.expense > 0
              ? `หักรายจ่าย ${stats.financeToday.expense.toLocaleString()} ฿`
              : "ยังไม่มีรายจ่าย"
          }
        />
      </div>

      {/* งานที่ต้องทำ */}
      {(stats.queue > 0 ||
        (tasks && (tasks.unpaidCount > 0 || tasks.pendingConsent > 0))) && (
        <div className="rounded-petflow border border-honey/50 bg-honey/10 p-4">
          <p className="mb-2 text-sm font-extrabold text-petflow-chocolate">
            📌 งานที่ต้องทำ
          </p>
          <div className="space-y-1.5 text-sm">
            {stats.queue > 0 && (
              <Link
                href="/admin/pending"
                className="flex items-center justify-between rounded-petflow-sm bg-card px-3 py-2"
              >
                <span className="font-bold text-brown">⏳ นัดรอยืนยัน</span>
                <span className="font-extrabold text-wait">{stats.queue} นัด →</span>
              </Link>
            )}
            {tasks && tasks.unpaidCount > 0 && (
              <Link
                href="/admin/billing"
                className="flex items-center justify-between rounded-petflow-sm bg-card px-3 py-2"
              >
                <span className="font-bold text-brown">💳 บิลค้างชำระ</span>
                <span className="font-extrabold text-wait">
                  {tasks.unpaidDue.toLocaleString()} ฿ ({tasks.unpaidCount}) →
                </span>
              </Link>
            )}
            {tasks && tasks.pendingConsent > 0 && (
              <Link
                href="/admin/schedule"
                className="flex items-center justify-between rounded-petflow-sm bg-card px-3 py-2"
              >
                <span className="font-bold text-brown">📋 ยังไม่กดยอมรับเงื่อนไข</span>
                <span className="font-extrabold text-latte-deep">
                  {tasks.pendingConsent} คน →
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* เปิดตารางนัด (แยกหน้า) */}
      <Link
        href="/admin/schedule"
        className="flex items-center justify-between rounded-petflow bg-card p-4 shadow-petflow-sm"
      >
        <div>
          <p className="text-base font-extrabold text-petflow-chocolate">🗓️ ตารางนัด</p>
          <p className="text-xs text-brown-soft">
            วันนี้ {stats.todayAppointments} นัด · รอยืนยัน {stats.queue}
          </p>
        </div>
        <span className="rounded-full bg-honey/30 px-4 py-2 text-xs font-extrabold text-petflow-chocolate">
          เปิดตาราง →
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/admin/bookings/new" className="rounded-petflow-sm bg-latte/25 py-3 text-center text-xs font-bold text-petflow-chocolate">
          ➕ จองใหม่
        </Link>
        <Link href="/admin/billing" className="rounded-petflow-sm bg-honey/30 py-3 text-center text-xs font-bold text-petflow-chocolate">
          💳 คิดเงิน
        </Link>
        <Link href="/admin/customers" className="rounded-petflow-sm bg-paper py-3 text-center text-xs font-bold text-petflow-chocolate">
          👤 ลูกค้า
        </Link>
        <Link href="/admin/finance" className="rounded-petflow-sm bg-latte/20 py-3 text-center text-xs font-bold text-petflow-chocolate">
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
    <div className="rounded-petflow-sm bg-card p-4 shadow-petflow-sm">
      <p className="text-lg">{emoji}</p>
      <p className="text-lg font-extrabold text-latte-deep">{value}</p>
      <p className="text-xs font-bold text-brown-soft">{label}</p>
      <p className="text-[10px] text-brown-faint">{sub}</p>
    </div>
  );
}
