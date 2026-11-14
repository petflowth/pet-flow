"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson } from "@/lib/admin-fetch";
import { DateRangePicker } from "@/components/DateRangePicker";
import { resolveRange, type RangeId } from "@/lib/date-range";
import { IconChip, ListRowContent } from "@/components/HeaderBand";
import { Icon } from "@/components/Icon";
import { TodayCustomers } from "@/components/TodayCustomers";
import { bangkokToday } from "@/lib/bangkok-date";

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

/** นัดวันนี้ 1 รายการ = 1 บ้าน (ระบบเก็บแถวละตัว แต่ร้านดูเป็นบ้าน) */
type TodayItem = {
  id: string;
  kind: "groom" | "checkin" | "checkout";
  time: string;
  catNames: string[];
  customerName: string;
  status: string;
};

type DayInfo = {
  /** จำนวนบ้านที่มีนัดวันนี้ (อาบน้ำ + เช็คอิน) และจำนวนน้อง */
  houses: number;
  cats: number;
  staying: number;
  checkoutToday: number;
  newCustomers: number;
  /** สถานะคิววันนี้ นับเป็นบ้าน */
  byStatus: Record<string, number>;
};

const STATUS_STRIP: { id: string; label: string; cls: string }[] = [
  { id: "pending", label: "รอยืนยัน", cls: "bg-wait/15 text-wait" },
  { id: "confirmed", label: "ยืนยันแล้ว", cls: "bg-ok/15 text-ok" },
  { id: "ready", label: "พร้อมรับกลับ", cls: "bg-honey/35 text-petflow-chocolate" },
  { id: "done", label: "เสร็จสิ้น", cls: "bg-sage/30 text-petflow-chocolate" },
  { id: "no_show", label: "ไม่มา", cls: "bg-red-50 text-red-600" },
  { id: "cancelled", label: "ยกเลิก", cls: "bg-paper text-brown-soft" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [day, setDay] = useState<DayInfo | null>(null);
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
    // งานที่ต้องทำ + ภาพรวมวันนี้ — บิลค้าง, นัด, ห้องพัก, ลูกค้าใหม่
    try {
      const today = bangkokToday();
      const [invR, bkR, cuR] = await Promise.all([
        fetch("/api/invoices").then((r) => r.json()),
        fetch("/api/bookings").then((r) => r.json()),
        fetch("/api/customers").then((r) => r.json()).catch(() => ({})),
      ]);
      const invs = (invR.invoices || []) as { status: string; total: number; deposit?: number }[];
      const bks = (bkR.bookings || []) as {
        id?: string;
        customerId?: string;
        service?: string;
        date?: string;
        time?: string;
        checkin?: string;
        checkout?: string;
        arrivalTime?: string;
        pickupTime?: string;
        catName?: string;
        customerName?: string;
        consentAcceptedAt?: string;
        status?: string;
      }[];
      // นัดวันนี้ — รวมน้องบ้านเดียวกัน (ลูกค้า + ประเภท + เวลาเดียวกัน) เป็นรายการเดียว
      const groups = new Map<string, TodayItem>();
      const add = (b: (typeof bks)[number], kind: TodayItem["kind"], time: string) => {
        const k = [kind, b.customerId || b.customerName, time, b.checkin, b.checkout].join("|");
        const g = groups.get(k);
        if (g) g.catNames.push(b.catName || "-");
        else
          groups.set(k, {
            id: `${b.id}-${kind}`,
            kind,
            time,
            catNames: [b.catName || "-"],
            customerName: b.customerName || "",
            status: b.status || "",
          });
      };
      let staying = 0;
      for (const b of bks) {
        if (b.service === "room") {
          if ((b.checkin || b.date) === today) add(b, "checkin", b.arrivalTime || b.time || "");
          if (b.checkout === today) add(b, "checkout", b.pickupTime || "");
          const live = b.status !== "cancelled" && b.status !== "no_show";
          if (live && (b.checkin || "") <= today && today < (b.checkout || "")) staying += 1;
        } else if (b.date === today) {
          add(b, "groom", b.time || "");
        }
      }
      const all = Array.from(groups.values());
      const byStatus: Record<string, number> = {};
      for (const g of all) if (g.kind !== "checkout") byStatus[g.status] = (byStatus[g.status] || 0) + 1;
      const active = all.filter((g) => g.status !== "cancelled");
      active.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
      const arriving = active.filter((g) => g.kind !== "checkout");
      setDay({
        houses: arriving.length,
        cats: arriving.reduce((s, g) => s + g.catNames.length, 0),
        staying,
        checkoutToday: active.filter((g) => g.kind === "checkout").length,
        newCustomers: ((cuR.customers || []) as { createdAt?: string }[]).filter(
          (c) => (c.createdAt || "").slice(0, 10) === today
        ).length,
        byStatus,
      });
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

  const hasTasks =
    stats.queue > 0 || (tasks && (tasks.unpaidCount > 0 || tasks.pendingConsent > 0));

  return (
    <div className="space-y-6">
      {/* ตัวเลขหลัก 4 ช่อง — เปิดมาเห็นเลยว่าวันนี้เป็นยังไง */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            href="/admin/finance"
            icon="wallet"
            tone="bg-honey/35"
            label={`รายได้${range.label === "วันนี้" ? "วันนี้" : ` · ${range.label}`}`}
            value={stats.financeToday.income.toLocaleString()}
            unit="฿"
            sub={`สุทธิ ${stats.financeToday.net.toLocaleString()} ฿ · ${stats.salesToday.count} บิล`}
          />
          <KpiTile
            href="/admin/schedule"
            icon="calendar"
            tone="bg-sage/30"
            label="นัดวันนี้"
            value={String(day?.houses ?? stats.todayAppointments)}
            unit="นัด"
            sub={day ? `น้อง ${day.cats} ตัว` : `ยืนยัน ${stats.todayConfirmed}`}
          />
          <KpiTile
            href="/admin/schedule"
            icon="bed"
            tone="bg-latte/30"
            label="พักอยู่ตอนนี้"
            value={String(day?.staying ?? 0)}
            unit="ตัว"
            sub={day?.checkoutToday ? `ออกวันนี้ ${day.checkoutToday} บ้าน` : "ไม่มีเช็คเอาท์วันนี้"}
          />
          <KpiTile
            href="/admin/customers"
            icon="users"
            tone="bg-paper"
            label="ลูกค้าใหม่วันนี้"
            value={String(day?.newCustomers ?? 0)}
            unit="คน"
            sub={stats.queue > 0 ? `รอยืนยัน ${stats.queue} นัด` : "ไม่มีนัดค้างยืนยัน"}
            highlight={stats.queue > 0}
          />
        </div>
        <div className="mt-3">
          <DateRangePicker
            value={rangeId}
            onChange={setRangeId}
            custom={customRange}
            onCustomChange={setCustomRange}
          />
        </div>
      </section>

      {/* สถานะคิววันนี้ */}
      {day && (
        <section>
          <SectionTitle title="สถานะคิววันนี้" sub="นับเป็นบ้าน" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STATUS_STRIP.map((st) => (
              <div key={st.id} className={`rounded-petflow-sm px-2 py-2.5 text-center ${st.cls}`}>
                <p className="text-lg font-extrabold leading-none">{day.byStatus[st.id] || 0}</p>
                <p className="mt-1 text-[10px] font-bold">{st.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* เมนูลัด — 4 อย่างที่ใช้บ่อยสุด (ที่เหลืออยู่ในปุ่ม Menu ด้านล่าง) */}
      <nav aria-label="เมนูลัด" className="grid grid-cols-4 gap-2">
        <Link href="/admin/billing"><IconChip icon="receipt" label="ออกบิล" tone="honey" /></Link>
        <Link href="/admin/pending"><IconChip icon="inbox" label="รอยืนยัน" tone="latte" badge={stats.queue || undefined} /></Link>
        <Link href="/admin/finance"><IconChip icon="wallet" label="รายรับ-จ่าย" tone="sage" /></Link>
        {/* คิดเงิน = เปิดหน้าบิลที่ลิสต์ "รอชำระ" กดรับชำระได้เลย (สรุปข้อมูลย้ายไปอยู่ในปุ่ม Menu) */}
        <Link href="/admin/billing?view=pending"><IconChip icon="money" label="คิดเงิน" tone="paper" /></Link>
      </nav>

      {/* งานที่ต้องทำ */}
      {hasTasks && (
        <section>
          <SectionTitle title="To-do" sub="งานที่ต้องทำ" />
          <div className="divide-y divide-petflow-line rounded-petflow bg-card px-4 shadow-petflow-sm">
            {stats.queue > 0 && (
              <Link href="/admin/pending" className="block py-3">
                <ListRowContent icon="inbox" title="นัดรอยืนยัน" sub="ลูกค้ายังไม่กดยืนยัน" value={`${stats.queue} นัด`} valueClass="text-wait" />
              </Link>
            )}
            {tasks && tasks.unpaidCount > 0 && (
              <Link href="/admin/billing?view=pending" className="block py-3">
                <ListRowContent icon="card" title="บิลค้างชำระ" sub={`${tasks.unpaidCount} บิล`} value={`${tasks.unpaidDue.toLocaleString()} ฿`} valueClass="text-wait" />
              </Link>
            )}
            {tasks && tasks.pendingConsent > 0 && (
              <Link href="/admin/schedule" className="block py-3">
                <ListRowContent icon="doc" title="ยังไม่กดยอมรับเงื่อนไข" sub="ห้องพักที่กำลังจะมาถึง" value={`${tasks.pendingConsent} คน`} valueClass="text-latte-deep" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ลูกค้าวันนี้ — ต้องระวัง / ต้องทำ / การดูแล ของแต่ละบ้าน จากคำตอบที่ลูกค้ากรอก */}
      <TodayCustomers />
    </div>
  );
}

function SectionTitle({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-3 px-1">
      <div>
        <h2 className="text-base font-extrabold text-petflow-chocolate">{title}</h2>
        {sub ? <p className="text-[11px] text-brown-soft">{sub}</p> : null}
      </div>
      {action}
    </div>
  );
}

function KpiTile({
  href,
  icon,
  tone,
  label,
  value,
  unit,
  sub,
  highlight,
}: {
  href: string;
  icon: string;
  tone: string;
  label: string;
  value: string;
  unit: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href} className="block rounded-petflow bg-card p-4 shadow-petflow-sm transition active:scale-[0.98]">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone} text-petflow-chocolate`}>
        <Icon name={icon} size={20} />
      </span>
      <p className="mt-3 truncate text-[11px] font-bold text-brown-soft">{label}</p>
      <p className="mt-0.5 truncate text-2xl font-extrabold leading-tight tracking-tight text-petflow-chocolate">
        {value}
        <span className="ml-1 text-xs font-bold text-latte-deep">{unit}</span>
      </p>
      <p className={`mt-1 truncate text-[10px] font-bold ${highlight ? "text-wait" : "text-brown-faint"}`}>{sub}</p>
    </Link>
  );
}
