"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type Booking } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { groomProgram } from "@/lib/grooming-prices";
import { groupBookings, groupCatNames } from "@/lib/booking-group";

const CHECKIN_TIMES = ["10:00", "12:00", "14:00", "16:00", "18:00"];

/** API ส่ง checkin มาด้วยจริง (ใช้จัดกลุ่มบ้านเดียวกัน/นัดเดียวกัน) แต่ type Booking กลางไม่มีฟิลด์นี้ */
type BookingRow = Booking & { checkin?: string };

function BookingsContent() {
  const { locale } = useLocale();
  const { profile, ready } = useLiff();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const m = t(locale).bookings;
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickId, setPickId] = useState<string | null>(null);
  const [checkin, setCheckin] = useState("14:00");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const scrolledRef = useRef(false);

  const load = useCallback(async () => {
    if (!profile?.lineUserId) return;
    const q = new URLSearchParams({ lineUserId: profile.lineUserId });
    const res = await fetch(`/api/bookings?${q}`);
    const data = await res.json();
    setBookings(data.bookings || []);
    setLoading(false);
  }, [profile?.lineUserId]);

  useEffect(() => {
    if (!profile?.lineUserId) {
      if (ready) setLoading(false);
      return;
    }
    load();
  }, [profile?.lineUserId, load, ready]);

  useEffect(() => {
    if (!highlightId || loading || scrolledRef.current) return;
    // นัดที่ถูก highlight อาจถูกรวมเป็นการ์ดเดียวกับตัวอื่นในบ้านเดียวกัน — หากลุ่มก่อน
    // แล้วอ้างอิงด้วย id ของตัวหลักในกลุ่ม (นั่นคือ id ที่การ์ดจริงเรนเดอร์ไว้)
    const group = groupBookings(bookings).find((g) => g.some((b) => b.id === highlightId));
    if (!group) return;
    const primary = group[0];
    scrolledRef.current = true;
    if (primary.status === "pending" && primary.service === "room") {
      setPickId(primary.id);
    }
    requestAnimationFrame(() => {
      document.getElementById(`booking-${primary.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [highlightId, loading, bookings]);

  // บ้านเดียวกัน จองพร้อมกันหลายตัว → ยืนยันครั้งเดียวทั้งกลุ่ม (ids.length > 1 = ยิง
  // confirm_group ให้ร้านได้แจ้งเตือนเป็นข้อความเดียว ไม่ใช่แยกทีละตัวเหมือนเดิม)
  const confirmGroup = async (ids: string[], primary: BookingRow) => {
    if (confirmingId) return;
    setConfirmingId(ids[0]);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ids[0],
          ids,
          action: ids.length > 1 ? "confirm_group" : "confirm",
          // ต้องส่ง lineUserId ไปด้วย ไม่งั้นฝั่งเซิร์ฟเวอร์เช็คว่า "นัดนี้เป็นของเราไหม" ไม่ผ่าน → 401
          lineUserId: profile?.lineUserId,
          checkinTime: primary.service === "room" ? checkin : undefined,
        }),
      });

      if (res.ok) {
        await load();
        setPickId(null);
      } else {
        alert(locale === "th" ? "ยืนยันไม่สำเร็จ" : "Could not confirm");
      }
    } catch {
      alert(locale === "th" ? "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง" : "Connection failed, try again");
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-petflow-chocolate">📅 {m.title}</h1>
        <LangSwitch />
      </div>

      {loading ? (
        <p className="text-center text-sm text-brown-soft py-8">{t(locale).common.loading}</p>
      ) : bookings.length === 0 ? (
        <p className="rounded-petflow bg-card p-6 text-center text-sm text-brown-soft shadow-petflow">
          {m.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {groupBookings(bookings).map((group) => {
            // บ้านเดียวกัน + นัดเดียวกัน หลายตัว → รวมเป็นการ์ดเดียว ยืนยันทีเดียวจบ
            // (สถานะต้องตรงกันทั้งกลุ่มถึงจะรวมโชว์ — ถ้าบางตัวยืนยันไปแล้วบางตัวยังไม่
            //  ให้แยกโชว์ทีละตัวแทน กันสับสน)
            const sameStatus = group.every((x) => x.status === group[0].status);
            const combine = group.length > 1 && sameStatus;
            const primary = group[0];
            const ids = group.map((x) => x.id);
            const catLabel = combine ? groupCatNames(group) : primary.catName;

            return (
              <li
                key={primary.id}
                id={`booking-${primary.id}`}
                className={`rounded-petflow border bg-card p-4 shadow-petflow-sm ${
                  group.some((x) => x.id === highlightId)
                    ? "border-sage ring-2 ring-sage/30"
                    : "border-petflow-line"
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-brown">
                      {catLabel}{" "}
                      <span className="font-medium text-brown-soft">· {primary.customerName}</span>
                    </p>
                    <p className="mt-1 text-xs text-brown-soft">
                      {primary.service === "groom" ? m.groom : m.room} · {primary.date}
                      {primary.time ? ` · ${primary.time}` : ""}
                    </p>
                    {primary.groomProgram && (
                      <p className="mt-0.5 text-[11px] font-bold text-latte-deep">
                        🧴 {groomProgram(primary.groomProgram)?.name || primary.groomProgram}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                      primary.status === "confirmed"
                        ? "bg-sage/20 text-ok"
                        : primary.status === "cancelled"
                          ? "bg-brown-soft/15 text-brown-soft"
                          : "bg-honey/25 text-wait"
                    }`}
                  >
                    {primary.status === "confirmed"
                      ? m.confirmed
                      : primary.status === "cancelled"
                        ? m.cancelled
                        : m.pending}
                  </span>
                </div>

                {!combine && group.length > 1 && (
                  <ul className="mb-2 space-y-1 text-xs text-brown-soft">
                    {group.slice(1).map((x) => (
                      <li key={x.id}>🐱 {x.catName}</li>
                    ))}
                  </ul>
                )}

                {/* นัดที่ลูกค้าจองเอง → รอร้านยืนยัน ลูกค้ายืนยันเองไม่ได้ (กัน "จองเอง ยืนยันเอง") */}
                {primary.status === "pending" && primary.selfBooked && (
                  <p className="rounded-petflow-sm bg-honey/25 px-3 py-2.5 text-center text-xs font-bold text-wait">
                    ⏳{" "}
                    {locale === "th"
                      ? "รอร้านยืนยันคิว — จะแจ้งกลับทาง LINE ทันทีที่ยืนยันนะคะ"
                      : "Waiting for the shop to confirm — we'll notify you on LINE"}
                  </p>
                )}
                {/* นัดที่ร้านสร้างให้ → ลูกค้ากดยืนยันเข้าร่วม (ตอบรับ) ได้ตามเดิม */}
                {primary.status === "pending" && !primary.selfBooked && (
                  <>
                    {primary.service === "room" && pickId === primary.id && (
                      <div className="mb-3 rounded-petflow-sm bg-paper p-3">
                        <p className="mb-2 text-xs font-bold text-brown">{m.checkin}</p>
                        <div className="flex flex-wrap gap-2">
                          {CHECKIN_TIMES.map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setCheckin(time)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                                checkin === time
                                  ? "bg-latte-deep text-white"
                                  : "bg-card text-brown-soft"
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={confirmingId === primary.id}
                      onClick={() =>
                        primary.service === "room" && pickId !== primary.id
                          ? setPickId(primary.id)
                          : confirmGroup(combine ? ids : [primary.id], primary)
                      }
                      className="flex w-full items-center justify-center gap-2 rounded-petflow-sm bg-gradient-to-r from-latte to-latte-deep py-3 text-sm font-extrabold text-white disabled:opacity-70"
                    >
                      {confirmingId === primary.id ? (
                        <>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                          {locale === "th" ? "กำลังยืนยัน…" : "Confirming…"}
                        </>
                      ) : (
                        <>
                          🐾 {m.confirm}
                          {combine ? ` (${group.length} ตัว)` : ""}
                        </>
                      )}
                    </button>
                  </>
                )}
                {primary.checkinTime && (
                  <p className="mt-2 text-xs font-semibold text-ok">
                    ✓ Check-in {primary.checkinTime}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function BookingsPage() {
  const { locale } = useLocale();
  const m = t(locale).bookings;
  return (
    <Suspense
      fallback={
        <p className="px-4 py-10 text-center text-sm text-brown-soft">
          {m.title}…
        </p>
      }
    >
      <BookingsContent />
    </Suspense>
  );
}
