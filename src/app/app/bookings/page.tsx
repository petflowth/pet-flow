"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type Booking } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { groomProgram } from "@/lib/grooming-prices";

const CHECKIN_TIMES = ["10:00", "12:00", "14:00", "16:00", "18:00"];

function BookingsContent() {
  const { locale } = useLocale();
  const { profile, ready } = useLiff();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  const m = t(locale).bookings;
  const [bookings, setBookings] = useState<Booking[]>([]);
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
    const target = bookings.find((b) => b.id === highlightId);
    if (!target) return;
    scrolledRef.current = true;
    if (target.status === "pending" && target.service === "room") {
      setPickId(target.id);
    }
    requestAnimationFrame(() => {
      document.getElementById(`booking-${highlightId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [highlightId, loading, bookings]);

  const confirm = async (id: string) => {
    if (confirmingId) return;
    const b = bookings.find((x) => x.id === id);
    if (!b) return;

    setConfirmingId(id);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          action: "confirm",
          // ต้องส่ง lineUserId ไปด้วย ไม่งั้นฝั่งเซิร์ฟเวอร์เช็คว่า "นัดนี้เป็นของเราไหม" ไม่ผ่าน → 401
          lineUserId: profile?.lineUserId,
          checkinTime: b.service === "room" ? checkin : undefined,
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
          {bookings.map((b) => (
            <li
              key={b.id}
              id={`booking-${b.id}`}
              className={`rounded-petflow border bg-card p-4 shadow-petflow-sm ${
                highlightId === b.id
                  ? "border-sage ring-2 ring-sage/30"
                  : "border-petflow-line"
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-brown">
                    {b.catName}{" "}
                    <span className="font-medium text-brown-soft">· {b.customerName}</span>
                  </p>
                  <p className="mt-1 text-xs text-brown-soft">
                    {b.service === "groom" ? m.groom : m.room} · {b.date}
                    {b.time ? ` · ${b.time}` : ""}
                  </p>
                  {b.groomProgram && (
                    <p className="mt-0.5 text-[11px] font-bold text-latte-deep">
                      🧴 {groomProgram(b.groomProgram)?.name || b.groomProgram}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    b.status === "confirmed"
                      ? "bg-sage/20 text-ok"
                      : b.status === "cancelled"
                        ? "bg-brown-soft/15 text-brown-soft"
                        : "bg-honey/25 text-wait"
                  }`}
                >
                  {b.status === "confirmed"
                    ? m.confirmed
                    : b.status === "cancelled"
                      ? m.cancelled
                      : m.pending}
                </span>
              </div>

              {/* นัดที่ลูกค้าจองเอง → รอร้านยืนยัน ลูกค้ายืนยันเองไม่ได้ (กัน "จองเอง ยืนยันเอง") */}
              {b.status === "pending" && b.selfBooked && (
                <p className="rounded-petflow-sm bg-honey/25 px-3 py-2.5 text-center text-xs font-bold text-wait">
                  ⏳{" "}
                  {locale === "th"
                    ? "รอร้านยืนยันคิว — จะแจ้งกลับทาง LINE ทันทีที่ยืนยันนะคะ"
                    : "Waiting for the shop to confirm — we'll notify you on LINE"}
                </p>
              )}
              {/* นัดที่ร้านสร้างให้ → ลูกค้ากดยืนยันเข้าร่วม (ตอบรับ) ได้ตามเดิม */}
              {b.status === "pending" && !b.selfBooked && (
                <>
                  {b.service === "room" && pickId === b.id && (
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
                    disabled={confirmingId === b.id}
                    onClick={() =>
                      b.service === "room" && pickId !== b.id
                        ? setPickId(b.id)
                        : confirm(b.id)
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-petflow-sm bg-gradient-to-r from-latte to-latte-deep py-3 text-sm font-extrabold text-white disabled:opacity-70"
                  >
                    {confirmingId === b.id ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        {locale === "th" ? "กำลังยืนยัน…" : "Confirming…"}
                      </>
                    ) : (
                      <>🐾 {m.confirm}</>
                    )}
                  </button>
                </>
              )}
              {b.checkinTime && (
                <p className="mt-2 text-xs font-semibold text-ok">
                  ✓ Check-in {b.checkinTime}
                </p>
              )}
            </li>
          ))}
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
