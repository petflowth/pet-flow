"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { groupBookings } from "@/lib/booking-group";
import { isAwaitingConfirmation, bookingLastDate } from "@/lib/booking-status";

type PendingBooking = {
  id: string;
  customerName: string;
  catName: string;
  service: "groom" | "room";
  status: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
  room?: string;
  lineUserId?: string;
  customerId?: string;
};

function whenText(b: PendingBooking) {
  if (b.service === "room" || b.checkin) {
    return `${b.checkin || b.date}${b.checkout ? ` → ${b.checkout}` : ""}`;
  }
  return `${b.date || ""}${b.time ? ` · ${b.time}` : ""}`.trim();
}

/**
 * รายการนัดที่ยังรอยืนยันทั้งหมดในหน้าเดียว — กดมาจากแดชบอร์ดเพื่อดูว่าเหลือใครบ้าง
 *
 * นับเฉพาะนัดที่ยังต้องยืนยันจริง: นัดที่ผ่านวันไปแล้วหรือออกบิลแล้วแปลว่าลูกค้ามาแล้ว
 * ไม่ต้องตามยืนยันย้อนหลัง (ใช้กติกาเดียวกับตัวเลขบนแดชบอร์ด จะได้ตรงกันเสมอ)
 */
export default function PendingConfirmPage() {
  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [billed, setBilled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    const [b, inv] = await Promise.all([
      fetch("/api/bookings").then((r) => r.json()).catch(() => ({ bookings: [] })),
      fetch("/api/invoices").then((r) => r.json()).catch(() => ({ invoices: [] })),
    ]);
    setBookings(b.bookings || []);
    setBilled(
      new Set(
        ((inv.invoices || []) as { bookingId?: string }[])
          .map((i) => i.bookingId)
          .filter(Boolean) as string[]
      )
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // บ้านเดียวกันจองพร้อมกันหลายตัว = ยืนยันทีเดียวทั้งบ้าน ไม่ต้องกดทีละตัว
  const groups = useMemo(() => {
    const waiting = bookings.filter((b) => isAwaitingConfirmation(b, today, billed));
    return groupBookings(waiting).sort((a, b) =>
      bookingLastDate(a[0]).localeCompare(bookingLastDate(b[0]))
    );
  }, [bookings, billed, today]);

  const confirmGroup = async (group: PendingBooking[]) => {
    setBusy(group[0].id);
    try {
      const results = await Promise.all(
        group.map((b) =>
          fetch("/api/bookings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: b.id, action: "confirm", lineUserId: b.lineUserId }),
          }).then((r) => r.ok)
        )
      );
      if (results.every(Boolean)) toast("ยืนยันนัดแล้ว ✔️", "success");
      else toast("ยืนยันไม่สำเร็จบางรายการ", "error");
      load();
    } finally {
      setBusy("");
    }
  };

  const overdue = groups.filter((g) => bookingLastDate(g[0]) < today);
  const upcoming = groups.filter((g) => bookingLastDate(g[0]) >= today);

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  const renderGroup = (group: PendingBooking[]) => {
    const b = group[0];
    const names = group.map((x) => x.catName).join(", ");
    return (
      <li
        key={group.map((x) => x.id).join(",")}
        className="rounded-petflow-sm border border-petflow-line bg-card p-3"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-bold text-brown">
              👤 {b.customerName}
              <span className="ml-2 font-normal text-brown-soft">
                🐱 {names}
                {group.length > 1 ? ` (${group.length} ตัว)` : ""}
              </span>
            </p>
            <p className="text-xs text-brown-soft">
              {b.service === "room" ? "🏠 ห้องพัก" : "🛁 อาบน้ำ"} · {whenText(b)}
            </p>
            {!b.lineUserId && (
              <p className="mt-1 text-[10px] font-bold text-wait">
                ⚠️ ยังไม่ได้ผูก LINE — ยืนยันได้ แต่ลูกค้าจะไม่ได้รับการ์ด
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={busy === b.id}
            onClick={() => confirmGroup(group)}
            className="shrink-0 rounded-full bg-sage/25 px-3 py-1.5 text-[11px] font-extrabold text-ok disabled:opacity-40"
          >
            {busy === b.id ? "…" : "✔️ ยืนยัน"}
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold text-petflow-chocolate">⏳ นัดรอยืนยัน</h1>
        <Link
          href="/admin/schedule"
          className="rounded-full bg-paper px-3 py-1.5 text-[11px] font-bold text-brown-soft"
        >
          📅 เปิดตาราง
        </Link>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-petflow border border-dashed border-petflow-line py-10 text-center">
          <p className="text-sm font-bold text-ok">🎉 ยืนยันครบทุกนัดแล้ว</p>
          <p className="mt-1 text-xs text-brown-soft">
            นัดที่ผ่านมาแล้วหรือออกบิลแล้ว ไม่ต้องตามยืนยันย้อนหลัง
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-brown-soft">
            เหลือ {groups.length} รายการ (บ้านที่มาหลายตัว นับเป็นรายการเดียว)
          </p>

          {overdue.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-extrabold text-wait">
                ⚠️ เลยวันนัดแล้ว แต่ยังไม่ได้ออกบิล ({overdue.length})
              </p>
              <p className="mb-2 text-[10px] text-brown-faint">
                ถ้าลูกค้ามาแล้วให้ออกบิล ถ้าไม่มาให้กด &quot;ไม่มา&quot; ในตาราง
                รายการจะได้หายจากคิวนี้
              </p>
              <ul className="space-y-2">{overdue.map(renderGroup)}</ul>
            </section>
          )}

          {upcoming.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs font-extrabold text-petflow-chocolate">
                📅 นัดที่กำลังจะถึง ({upcoming.length})
              </p>
              <ul className="space-y-2">{upcoming.map(renderGroup)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
