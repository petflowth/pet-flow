"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookingEditModal, type EditableBooking } from "@/components/BookingEditModal";
import { CustomerSendButtons } from "@/components/CustomerSendButtons";
import { InvoiceActionButtons } from "@/components/InvoiceActionButtons";
import { bookingOnDate } from "@/lib/booking-customer-match";
import { toast } from "@/components/Toast";
import { PreviewSendModal } from "@/components/PreviewSendModal";
import { groupBookings } from "@/lib/booking-group";
import { buildRoomBoard, roomCapacity } from "@/lib/room-board";

type CalendarDay = EditableBooking & {
  customerId?: string;
  /** ป้ายเตือนของแมวตัวนี้ — หลังบ้านเท่านั้น (API ไม่ส่งให้ฝั่งลูกค้า) */
  catMedical?: string;
  catStaffNote?: string;
  catPrivateNote?: string;
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
  return `${d} ${months[m - 1]} ${y}`;
}

/** ตารางนัด + รายการนัดรายวัน — ใช้ในหน้า /admin/schedule */
/**
 * รายการย่อในตารางสัปดาห์/รายวัน — แถบสีซ้ายบอกสถานะทันทีโดยไม่ต้องอ่าน
 * เขียว = เข้าพัก · น้ำตาลเข้ม = ยืนยันแล้ว · เหลือง = ยังไม่ยืนยัน
 */
/**
 * ป้ายเตือนต่อแมว — สิ่งที่ช่าง/พนักงานต้องรู้ก่อนจับน้อง โดยไม่ต้องเปิดหน้าลูกค้า
 * โน้ตลับร้านเป็นสีแดงเพราะเป็นเรื่องความปลอดภัย (กัด/ข่วน) ไม่ใช่ข้อมูลทั่วไป
 * การ์ดของบ้านที่มีหลายตัวจะติดชื่อน้องกำกับ จะได้ไม่สับสนว่าป้ายของตัวไหน
 */
function CatTags({ group }: { group: CalendarDay[] }) {
  const rows = group
    .map((b) => ({
      name: b.catName,
      tags: [
        b.catPrivateNote ? { text: b.catPrivateNote, kind: "danger" as const } : null,
        b.catMedical && b.catMedical !== "ไม่มี"
          ? { text: `💊 ${b.catMedical}`, kind: "warn" as const }
          : null,
        b.catStaffNote ? { text: b.catStaffNote, kind: "info" as const } : null,
      ].filter(Boolean) as { text: string; kind: "danger" | "warn" | "info" }[],
    }))
    .filter((r) => r.tags.length > 0);
  if (rows.length === 0) return null;

  const many = group.length > 1;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {rows.flatMap((r) =>
        r.tags.map((tag, i) => (
          <span
            key={`${r.name}-${i}`}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              tag.kind === "danger"
                ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                : tag.kind === "warn"
                  ? "bg-wait/15 text-wait"
                  : "bg-latte/20 text-brown"
            }`}
          >
            {tag.kind === "danger" && "⚠️ "}
            {many ? `${r.name}: ` : ""}
            {tag.text}
          </span>
        ))
      )}
    </div>
  );
}

function MiniEntry({ group, onClick }: { group: CalendarDay[]; onClick: () => void }) {
  const b = group[0];
  const isRoom = b.service === "room";
  const confirmed = group.every((x) => x.status === "confirmed");
  const names = group.map((x) => x.catName).join(", ");
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${names} · ${b.customerName}`}
      className={`block w-full truncate rounded-lg border-l-[3px] px-1.5 py-1 text-left text-[10px] font-bold leading-tight ${
        isRoom
          ? "border-ok bg-sage/20 text-brown"
          : confirmed
            ? "border-latte-deep bg-latte/20 text-petflow-chocolate"
            : "border-honey-deep bg-honey/25 text-petflow-chocolate"
      }`}
    >
      {isRoom ? "🏠 " : b.time ? `${b.time} ` : "🛁 "}
      {names}
      <span className="font-normal text-brown-faint"> · {b.customerName}</span>
    </button>
  );
}

export function BookingCalendar() {
  const [bookings, setBookings] = useState<CalendarDay[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CalendarDay | null>(null);
  const [zoomSignature, setZoomSignature] = useState<string | null>(null);
  // นัดที่บิลจ่ายจบแล้ว (รายงานขึ้นมาจาก BillButton) — ติดป้าย "จบเคส" ให้เห็นชัดทั้งการ์ด
  const [paidCases, setPaidCases] = useState<Record<string, boolean>>({});
  const [rooms, setRooms] = useState<
    {
      id: string;
      name: string;
      size: string;
      price: number;
      count: number;
      cats?: { th: string };
      extra?: { th: string };
    }[]
  >([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);
  const [closedDates, setClosedDates] = useState<{ date: string; note?: string }[]>([]);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);
  const [togglingClosed, setTogglingClosed] = useState(false);
  /** การ์ดที่รอยืนยันก่อนส่งจริง พร้อมงานที่จะทำต่อเมื่อกดยืนยัน */
  const [stagePreview, setStagePreview] = useState<{
    messages: Record<string, unknown>[];
    run: () => Promise<void>;
  } | null>(null);
  /** กรองรายการตามสถานะ — ไว้กวาดงานค้างเร็วๆ */
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
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
  /** มุมมองตาราง — เดือนดูภาพรวม, สัปดาห์วางแผน, วันทำงานหน้าร้าน, ห้องดูที่ว่าง */
  const [view, setView] = useState<"month" | "week" | "day" | "rooms">("week");

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

  /**
   * เดินสถานะทั้งบ้านพร้อมกัน — "พร้อมรับกลับ" จะแจ้งลูกค้าทาง LINE ให้ด้วย
   * (ดูตัวอย่างการ์ดก่อนส่งเสมอ เพราะเป็นข้อความที่ลูกค้าได้รับจริง)
   */
  const setStageFor = async (group: CalendarDay[], action: string) => {
    const b = group[0];
    const ids = group.map((x) => x.id);
    const names = group.map((x) => x.catName).join(", ");

    if (action === "set_no_show") {
      if (!confirm(`บันทึกว่า ${names} · ${b.customerName} ไม่มาตามนัด?`)) return;
    }

    const run = async () => {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, action, ids, lineUserId: b.lineUserId }),
      });
      const data = await res.json().catch(() => ({}));
      setStagePreview(null);
      if (!res.ok) return toast(data.error || "บันทึกไม่สำเร็จ", "error");
      if (action === "set_ready") {
        toast(data.sent ? "แจ้งลูกค้าแล้ว — น้องพร้อมกลับบ้าน 🎉" : "บันทึกแล้ว (ส่ง LINE ไม่ได้)", data.sent ? "success" : "info");
      } else {
        toast(action === "set_done" ? "ปิดงานแล้ว ✅" : "บันทึกว่าไม่มาแล้ว", "info");
      }
      load();
    };

    // ขั้นที่ส่งข้อความหาลูกค้า → ขอดูการ์ดก่อน
    if (action === "set_ready") {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: b.id, action, ids, lineUserId: b.lineUserId, preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.preview?.length) {
        setStagePreview({ messages: data.preview, run });
        return;
      }
    }
    await run();
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

  // เลื่อนวัน/สัปดาห์ — เที่ยงวันกัน timezone ดึงวันเพี้ยนตอนแปลงกลับเป็น ISO
  const shiftDays = (delta: number) => {
    const d = new Date(`${activeDate}T12:00:00`);
    d.setDate(d.getDate() + delta);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    setSelectedDate(key);
    setViewMonth(key.slice(0, 7));
  };
  const shiftView = (delta: number) =>
    view === "month" ? shiftMonth(delta) : shiftDays(view === "week" ? delta * 7 : delta);

  // 7 วันของสัปดาห์ที่กำลังดู (เริ่มวันอาทิตย์ ให้ตรงกับหัวตารางเดือน)
  const weekDates = (() => {
    const d = new Date(`${activeDate}T12:00:00`);
    d.setDate(d.getDate() - d.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(d);
      x.setDate(d.getDate() + i);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
        x.getDate()
      ).padStart(2, "0")}`;
    });
  })();

  // มุมมองรายวัน — แถวละชั่วโมง ครอบคลุมช่วงที่มีนัดจริง (อย่างน้อย 9:00–18:00)
  const dayGroups = groupBookings(dayBookings);

  // นับตามสถานะจาก "การ์ด" (บ้านละใบ) ไม่ใช่รายตัว — ให้ตรงกับที่ตาเห็นในลิสต์
  const statusChips = (
    [
      { id: "all" as const, label: "ทั้งหมด" },
      { id: "pending" as const, label: "รอยืนยัน" },
      { id: "confirmed" as const, label: "ยืนยันแล้ว" },
      { id: "ready" as const, label: "พร้อมรับกลับ" },
      { id: "done" as const, label: "เสร็จสิ้น" },
      { id: "no_show" as const, label: "ไม่มา" },
    ] as const
  )
    .map((c) => ({
      ...c,
      count:
        c.id === "all"
          ? dayGroups.length
          : dayGroups.filter((g) => g[0].status === c.id).length,
    }))
    .filter((c) => c.id === "all" || c.count > 0);

  const shownGroups =
    statusFilter === "all"
      ? dayGroups
      : dayGroups.filter((g) => g[0].status === statusFilter);
  const timedGroups = dayGroups.filter((g) => g[0].time);
  const allDayGroups = dayGroups.filter((g) => !g[0].time);
  const hourNums = timedGroups.map((g) => Number(g[0].time!.slice(0, 2)));
  const startHour = Math.min(9, ...hourNums);
  const endHour = Math.max(18, ...hourNums);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // ผังห้องของวันที่เลือก — ห้องไหนมีใคร ว่างกี่ห้องจริง วันไหนต้องรับต่อกัน
  const board = buildRoomBoard(
    rooms.map((r) => ({
      id: r.id,
      name: r.name,
      count: r.count,
      maxCats: roomCapacity(r),
    })),
    liveBookings,
    activeDate
  );

  const viewTitle =
    view === "month"
      ? `เดือน ${m}/${y}`
      : view === "week"
        ? `${formatThaiDate(weekDates[0])} – ${formatThaiDate(weekDates[6])}`
        : formatThaiDate(activeDate);

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-5">
      {stagePreview && (
        <PreviewSendModal
          messages={stagePreview.messages}
          sending={false}
          onConfirm={() => stagePreview.run()}
          onCancel={() => setStagePreview(null)}
        />
      )}
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
        {/* สลับมุมมอง — เดือนดูภาพรวม / สัปดาห์วางแผน / วันใช้ทำงานหน้าร้าน */}
        <div className="mb-3 flex gap-1.5">
          {(
            [
              { id: "month" as const, label: "🗓️ เดือน" },
              { id: "week" as const, label: "📆 สัปดาห์" },
              { id: "day" as const, label: "📋 วัน" },
              { id: "rooms" as const, label: "🏠 ห้อง" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={`flex-1 rounded-petflow-sm py-2 text-xs font-bold transition ${
                view === v.id
                  ? "bg-honey/45 text-petflow-chocolate shadow-petflow-sm"
                  : "bg-paper text-brown-soft"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftView(-1)}
              aria-label="ก่อนหน้า"
              className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-sm font-extrabold text-brown-soft"
            >
              ‹
            </button>
            <h2 className="truncate text-sm font-extrabold text-petflow-chocolate">{viewTitle}</h2>
            <button
              type="button"
              onClick={() => shiftView(1)}
              aria-label="ถัดไป"
              className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-sm font-extrabold text-brown-soft"
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
              className="shrink-0 rounded-full bg-honey/30 px-3 py-1 text-[10px] font-bold text-petflow-chocolate"
            >
              กลับวันนี้
            </button>
          )}
        </div>

        {view === "week" && (
          <div className="grid gap-1.5 sm:grid-cols-7">
            {weekDates.map((key) => {
              const items = groupBookings(liveBookings.filter((b) => bookingOnDate(b, key)));
              const d = new Date(`${key}T12:00:00`);
              const isToday = key === today;
              const isSelected = key === activeDate;
              return (
                <div
                  key={key}
                  className={`rounded-xl p-1.5 ${
                    isSelected
                      ? "bg-latte/25 ring-2 ring-latte-deep"
                      : isToday
                        ? "bg-honey/25 ring-1 ring-honey-deep"
                        : "bg-paper/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => pickDate(key)}
                    className="mb-1 flex w-full items-baseline gap-1.5 px-1 text-left sm:justify-center"
                  >
                    <span className="text-[10px] font-bold text-brown-faint">
                      {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"][d.getDay()]}
                    </span>
                    <span className="text-sm font-extrabold text-petflow-chocolate">
                      {d.getDate()}
                    </span>
                    {items.length > 0 && (
                      <span className="text-[9px] font-bold text-brown-faint">
                        · {items.length}
                      </span>
                    )}
                  </button>
                  <div className="space-y-1">
                    {items.length === 0 ? (
                      <p className="px-1 pb-1 text-[9px] text-brown-faint sm:text-center">—</p>
                    ) : (
                      items.map((g) => (
                        <MiniEntry key={g[0].id} group={g} onClick={() => pickDate(key)} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "day" && (
          <div>
            {allDayGroups.length > 0 && (
              <div className="mb-2 rounded-xl bg-sage/15 p-2">
                <p className="mb-1 text-[10px] font-bold text-brown-faint">🏠 ทั้งวัน / เข้าพัก</p>
                <div className="space-y-1">
                  {allDayGroups.map((g) => (
                    <MiniEntry key={g[0].id} group={g} onClick={() => setEditing(g[0])} />
                  ))}
                </div>
              </div>
            )}
            <div className="divide-y divide-petflow-line">
              {hours.map((h) => {
                const slot = timedGroups.filter((g) => Number(g[0].time!.slice(0, 2)) === h);
                return (
                  <div key={h} className="flex gap-2 py-1.5">
                    <span className="w-11 shrink-0 pt-0.5 text-[10px] font-bold text-brown-faint">
                      {String(h).padStart(2, "0")}:00
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      {slot.length === 0 ? (
                        <div className="h-4 rounded bg-paper/40" />
                      ) : (
                        slot.map((g) => (
                          <MiniEntry key={g[0].id} group={g} onClick={() => setEditing(g[0])} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "rooms" && (
          <div>
            {/* สรุปหัวตาราง — ว่างกี่ห้องจริง เห็นตัวเดียวจบ */}
            <div
              className={`mb-3 flex items-center justify-between gap-3 rounded-petflow-sm px-3 py-2.5 ${
                board.isFull ? "bg-red-50 ring-1 ring-red-300" : "bg-sage/15"
              }`}
            >
              <div>
                <p className="text-xs font-extrabold text-petflow-chocolate">
                  {board.isFull ? "🔴 ห้องเต็มแล้ว" : `🟢 ว่าง ${board.free} ห้อง`}
                </p>
                <p className="text-[10px] text-brown-soft">
                  ใช้อยู่ {board.occupied} / {board.totalUnits} ห้อง ·{" "}
                  {formatThaiDate(activeDate)}
                </p>
              </div>
              <Link
                href={`/admin/bookings/new?date=${activeDate}`}
                className="shrink-0 rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep px-3 py-2 text-[11px] font-extrabold text-petflow-chocolate shadow-petflow-sm"
              >
                ➕ จองห้อง
              </Link>
            </div>

            {/* จองเกินจำนวนห้อง — ต้องเห็นก่อนเพื่อน */}
            {board.overflow.length > 0 && (
              <div className="mb-3 rounded-petflow-sm bg-red-50 px-3 py-2 ring-1 ring-red-300">
                <p className="text-[11px] font-extrabold text-red-600">
                  ⚠️ จองเกินจำนวนห้องที่มี {board.overflow.length} รายการ
                </p>
                <p className="mt-0.5 text-[10px] text-brown-soft">
                  {board.overflow.map((b) => `${b.catName} · ${b.customerName}`).join(" / ")}
                  {" — ต้องย้ายประเภทห้องหรือเลื่อนวัน"}
                </p>
              </div>
            )}

            {/* รับต่อกันในวันเดียว — ห้องเดิมมีคนออกและคนเข้าวันนี้ */}
            {board.turnovers.length > 0 && (
              <div className="mb-3 rounded-petflow-sm bg-wait/10 px-3 py-2.5 ring-1 ring-wait/40">
                <p className="text-[11px] font-extrabold text-wait">
                  🔄 ต้องเคลียร์ห้องรับต่อวันนี้ {board.turnovers.length} ห้อง
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {board.turnovers.map((u) => {
                    const out = u.leaving[0];
                    const inn = u.staying[0];
                    const outNames = u.leaving.map((x) => x.catName).join(", ");
                    const innNames = u.staying.map((x) => x.catName).join(", ");
                    const gapOk = out.pickupTime && inn.arrivalTime
                      ? out.pickupTime <= inn.arrivalTime
                      : true;
                    return (
                      <li
                        key={`${u.typeId}-${u.unit}`}
                        className="rounded-lg bg-card px-2 py-1.5 text-[10px]"
                      >
                        <p className="font-extrabold text-petflow-chocolate">
                          {u.typeName} #{u.unit}
                        </p>
                        <p className="mt-0.5 text-brown-soft">
                          ⬅️ ออก: {outNames} · {out.customerName} —{" "}
                          <span className={out.pickupTime ? "font-bold text-ok" : "text-brown-faint"}>
                            {out.pickupTime ? `รับ ${out.pickupTime} น.` : "ยังไม่แจ้งเวลารับ"}
                          </span>
                        </p>
                        <p className="text-brown-soft">
                          ➡️ เข้า: {innNames} · {inn.customerName} —{" "}
                          <span className={inn.arrivalTime ? "font-bold text-ok" : "text-brown-faint"}>
                            {inn.arrivalTime ? `ส่ง ${inn.arrivalTime} น.` : "ยังไม่แจ้งเวลาส่ง"}
                          </span>
                        </p>
                        {!gapOk && (
                          <p className="mt-1 rounded bg-red-50 px-1.5 py-1 font-bold text-red-700">
                            ⚠️ เวลาชนกัน — คนใหม่มาส่ง {inn.arrivalTime} น. ก่อนคนเก่ามารับ{" "}
                            {out.pickupTime} น.
                          </p>
                        )}
                        {gapOk && (!out.pickupTime || !inn.arrivalTime) && (
                          <p className="mt-1 text-brown-faint">
                            💡 ใส่เวลารับ-ส่งในหน้าแก้ไขนัด จะเช็คให้ว่าคิวชนกันไหม
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* ผังห้องจริง — แยกตามประเภท ห้องละกล่อง */}
            <div className="space-y-3">
              {board.byType.map((t) => (
                <div key={t.typeId}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-extrabold text-petflow-chocolate">
                      {t.typeName}
                    </p>
                    <p
                      className={`text-[10px] font-bold ${
                        t.free === 0 ? "text-red-600" : "text-ok"
                      }`}
                    >
                      {t.free === 0 ? "เต็ม" : `ว่าง ${t.free}`} / {t.total} ห้อง
                      {t.cats > 0 && ` · ${t.cats} ตัว`}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                    {t.units.map((u) => {
                      const host = u.staying[0];
                      const busy = u.staying.length > 0 || !!u.partOf;
                      return (
                        <button
                          key={u.unit}
                          type="button"
                          onClick={() => host && setEditing(host as CalendarDay)}
                          disabled={!host}
                          className={`min-h-[62px] rounded-xl px-2 py-1.5 text-left transition ${
                            u.turnover
                              ? "bg-wait/20 ring-1 ring-wait"
                              : busy
                                ? "bg-latte/25 ring-1 ring-latte-deep/40 hover:bg-latte/35"
                                : "bg-paper/50 ring-1 ring-dashed ring-petflow-line"
                          }`}
                        >
                          <p className="text-[9px] font-bold text-brown-faint">
                            #{u.unit}
                            {u.turnover && " · 🔄 รับต่อ"}
                            {!u.turnover && u.arriving && " · 🆕 เข้าวันนี้"}
                            {u.staying.length > 1 && ` · ${u.staying.length} ตัว`}
                          </p>
                          {u.partOf && (
                            <p className="truncate text-[9px] font-bold text-latte-deep">
                              🔗 {u.partOf}
                            </p>
                          )}
                          {host ? (
                            <>
                              <p className="truncate text-[11px] font-extrabold text-petflow-chocolate">
                                {u.staying.map((x) => x.catName).join(", ")}
                              </p>
                              <p className="truncate text-[9px] text-brown-soft">
                                {host.customerName}
                              </p>
                              <p className="truncate text-[9px] text-brown-faint">
                                ถึง {host.checkout || "-"}
                              </p>
                            </>
                          ) : u.partOf ? (
                            <p className="pt-1 text-center text-[9px] text-brown-faint">
                              (ห้องที่เชื่อมอยู่)
                            </p>
                          ) : (
                            <p className="pt-2 text-center text-[10px] font-bold text-brown-faint">
                              ว่าง
                            </p>
                          )}
                          {u.leaving.length > 0 && (
                            <p className="mt-0.5 truncate text-[9px] text-wait">
                              ⬅️ {u.leaving.map((x) => x.catName).join(", ")} ออก
                            </p>
                          )}
                          {u.overCapacity && (
                            <p className="mt-0.5 truncate text-[9px] font-bold text-red-600">
                              ⚠️ เกินความจุ ({u.capacity})
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "month" && (
        <>
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
        </>
        )}
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
        {/* กรองตามสถานะ พร้อมตัวเลข — กวาดงานค้างได้เร็วโดยไม่ต้องไล่อ่านทีละใบ */}
        {dayBookings.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {statusChips.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setStatusFilter(c.id)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                  statusFilter === c.id
                    ? "bg-latte-deep text-white"
                    : "bg-paper text-brown-soft hover:bg-honey/20"
                }`}
              >
                {c.label} {c.count}
              </button>
            ))}
          </div>
        )}
        <ul className="space-y-2">
          {shownGroups.length === 0 ? (
            <li className="rounded-petflow-sm border border-dashed border-petflow-line py-6 text-center">
              <p className="text-xs text-brown-soft">
                {dayBookings.length === 0
                  ? "ไม่มีนัด/การเข้าพักในวันนี้"
                  : "ไม่มีรายการในสถานะนี้"}
              </p>
              <Link
                href={`/admin/bookings/new?date=${activeDate}`}
                className="mt-2 inline-block text-xs font-bold text-latte-deep underline"
              >
                ➕ จองคิววันที่ {formatThaiDate(activeDate)}
              </Link>
            </li>
          ) : (
            shownGroups.map((group) => {
              const b = group[0];
              const allConfirmed = group.every((x) => x.status === "confirmed");
              const stage = group[0].status as BookingStatus;
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
                    <CatTags group={group} />
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
                      caseDone || stage === "done"
                        ? "bg-ok text-white"
                        : stage === "ready"
                          ? "bg-latte-deep text-white"
                          : stage === "no_show"
                            ? "bg-red-50 text-red-600"
                            : allConfirmed
                              ? "bg-sage/20 text-ok"
                              : "bg-honey/25 text-wait"
                    }`}
                  >
                    {caseDone
                      ? "✅ จบเคส"
                      : stage === "ready"
                        ? "🎉 พร้อมรับกลับ"
                        : BOOKING_STATUS_LABELS[stage] || "รอยืนยัน"}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!allConfirmed && stage !== "ready" && stage !== "done" && (
                    <button
                      type="button"
                      onClick={() => confirmGroup(group)}
                      className="rounded-full bg-sage/25 px-2.5 py-1 text-[10px] font-bold text-ok"
                    >
                      ✔️ ยืนยันนัด
                    </button>
                  )}
                  {/* เดินงานทีละขั้น: ยืนยันแล้ว → พร้อมรับกลับ (แจ้งลูกค้า) → ปิดงาน */}
                  {allConfirmed && stage !== "ready" && stage !== "done" && (
                    <button
                      type="button"
                      onClick={() => setStageFor(group, "set_ready")}
                      className="rounded-full bg-latte-deep px-2.5 py-1 text-[10px] font-extrabold text-white"
                    >
                      🎉 น้องพร้อมกลับบ้าน
                    </button>
                  )}
                  {stage === "ready" && (
                    <button
                      type="button"
                      onClick={() => setStageFor(group, "set_done")}
                      className="rounded-full bg-ok/20 px-2.5 py-1 text-[10px] font-bold text-ok"
                    >
                      ✅ ปิดงาน
                    </button>
                  )}
                  {stage !== "done" && stage !== "no_show" && (
                    <button
                      type="button"
                      onClick={() => setStageFor(group, "set_no_show")}
                      className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-brown-soft"
                    >
                      🚫 ไม่มา
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
                  {/* บ้านที่มาหลายตัว — ยกเลิกทีละตัวได้ เผื่อน้องตัวใดตัวหนึ่งมาไม่ได้ */}
                  {group.length > 1 &&
                    group.map((x) => (
                      <button
                        key={`cancel-${x.id}`}
                        type="button"
                        onClick={() => cancelGroup([x])}
                        className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-wait"
                      >
                        ❌ ยกเลิก {x.catName}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => cancelGroup(group)}
                    className="rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-wait"
                  >
                    ❌ ยกเลิก{group.length > 1 ? "ทั้งบ้าน" : ""}
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
