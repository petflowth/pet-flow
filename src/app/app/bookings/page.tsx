"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { type Booking } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { LangSwitch } from "@/components/LangSwitch";

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
    const b = bookings.find((x) => x.id === id);
    if (!b) return;

    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        action: "confirm",
        checkinTime: b.service === "room" ? checkin : undefined,
      }),
    });

    if (res.ok) {
      await load();
      setPickId(null);
    } else {
      alert(locale === "th" ? "ยืนยันไม่สำเร็จ" : "Could not confirm");
    }
  };

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-catcha-chocolate">📅 {m.title}</h1>
        <LangSwitch />
      </div>

      {loading ? (
        <p className="text-center text-sm text-brown-soft py-8">{t(locale).common.loading}</p>
      ) : bookings.length === 0 ? (
        <p className="rounded-catcha bg-card p-6 text-center text-sm text-brown-soft shadow-catcha">
          {m.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li
              key={b.id}
              id={`booking-${b.id}`}
              className={`rounded-catcha border bg-card p-4 shadow-catcha-sm ${
                highlightId === b.id
                  ? "border-sage ring-2 ring-sage/30"
                  : "border-catcha-line"
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
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    b.status === "confirmed"
                      ? "bg-sage/20 text-ok"
                      : "bg-honey/25 text-wait"
                  }`}
                >
                  {b.status === "confirmed" ? m.confirmed : m.pending}
                </span>
              </div>

              {b.status === "pending" && (
                <>
                  {b.service === "room" && pickId === b.id && (
                    <div className="mb-3 rounded-catcha-sm bg-paper p-3">
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
                    onClick={() =>
                      b.service === "room" && pickId !== b.id
                        ? setPickId(b.id)
                        : confirm(b.id)
                    }
                    className="w-full rounded-catcha-sm bg-gradient-to-r from-latte to-latte-deep py-3 text-sm font-extrabold text-white"
                  >
                    🐾 {m.confirm}
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
