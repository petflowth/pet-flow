"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import type { Booking } from "@/lib/business";

import { DEFAULT_MESSAGES } from "@/lib/messages";

type StayBooking = Booking & {
  checkin?: string;
  room?: string;
  consentAcceptedAt?: string;
  careNote?: string;
};

export default function ConsentPage() {
  const { profile, ready } = useLiff();
  const { config } = useConfig();
  const [booking, setBooking] = useState<StayBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [careNote, setCareNote] = useState("");

  const terms =
    config.messages?.consentTerms?.length
      ? config.messages.consentTerms
      : DEFAULT_MESSAGES.consentTerms;
  const consentTitle = config.messages?.consentTitle || DEFAULT_MESSAGES.consentTitle;

  useEffect(() => {
    if (!profile?.lineUserId) return;
    const q = new URLSearchParams({ lineUserId: profile.lineUserId });
    fetch(`/api/bookings?${q}`)
      .then((r) => r.json())
      .then((data) => {
        const list: StayBooking[] = data.bookings || [];
        // เอาการจองห้องพักที่ยังไม่ยกเลิก และใกล้ที่สุด
        const stay = list
          .filter((b) => b.service === "room" && b.status !== "cancelled")
          .sort((a, b) => (a.checkin || a.date).localeCompare(b.checkin || b.date))[0];
        setBooking(stay || null);
        if (stay?.consentAcceptedAt) setAccepted(true);
        if (stay?.careNote) setCareNote(stay.careNote);
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [profile?.lineUserId]);

  const submit = async () => {
    if (!booking || !profile?.lineUserId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bookings/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          lineUserId: profile.lineUserId,
          careNote: careNote.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.needSql) {
        alert(
          "ระบบยังตั้งค่าไม่เสร็จ (แอดมินต้องรัน SQL ก่อน) — แต่รับทราบข้อตกลงของคุณแล้วค่ะ"
        );
      }
      setAccepted(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pb-8 pt-5">
      <Link href="/app" className="mb-3 inline-block text-xs font-bold text-brown-soft">
        ← กลับหน้าแรก
      </Link>

      <h1 className="text-lg font-extrabold text-catcha-chocolate">
        📋 {consentTitle}
      </h1>
      <p className="mt-1 text-xs text-brown-soft">
        {config.business.name} — กรุณาอ่านและกดยอมรับก่อนวันเข้าพักของน้อง
      </p>

      {!ready || loading ? (
        <p className="mt-6 rounded-catcha-sm bg-paper px-4 py-3 text-sm text-brown-soft">
          กำลังโหลด…
        </p>
      ) : (
        <>
          {booking && (
            <div className="mt-4 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
              <p className="text-sm font-bold text-brown">
                🐱 {booking.catName}
              </p>
              <p className="text-xs text-brown-soft">
                เข้าพัก: {booking.checkin || booking.date}
                {booking.checkout ? ` → ${booking.checkout}` : ""}
                {booking.room ? ` · ห้อง ${booking.room}` : ""}
              </p>
            </div>
          )}

          <ul className="mt-4 space-y-2">
            {terms.map((term, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-catcha-sm bg-paper/70 px-3 py-2 text-xs text-brown"
              >
                <span className="font-bold text-latte-deep">{i + 1}.</span>
                <span>{term}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <label className="text-xs font-bold text-catcha-chocolate">
              📝 แจ้งการดูแลเพิ่มเติม (ไม่บังคับ)
            </label>
            <p className="mb-1.5 text-[11px] text-brown-faint">
              เช่น อาหารที่กินประจำ/ปริมาณ · ยาที่ต้องให้ · นิสัย/สิ่งที่กลัว · โรคประจำตัว
            </p>
            <textarea
              value={careNote}
              onChange={(e) => setCareNote(e.target.value)}
              disabled={accepted}
              rows={4}
              placeholder="พิมพ์รายละเอียดการดูแลน้องที่อยากให้ทางร้านทราบ…"
              className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-xs text-brown disabled:bg-paper/60"
            />
          </div>

          {accepted ? (
            <div className="mt-4 rounded-catcha bg-sage/15 px-4 py-4 text-center">
              <p className="text-sm font-extrabold text-catcha-chocolate">
                ✅ รับทราบและยอมรับข้อตกลงแล้ว
              </p>
              <p className="mt-1 text-xs text-brown-soft">
                ขอบคุณค่ะ ทางเราพร้อมดูแลน้องอย่างดีที่สุด 🧡
              </p>
            </div>
          ) : (
            <>
              <label className="mt-4 flex items-start gap-2 text-xs text-brown">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  ข้าพเจ้าได้อ่านและยอมรับข้อตกลงข้างต้น
                  และให้ข้อมูลน้องแมวตามความเป็นจริง
                </span>
              </label>
              <button
                type="button"
                disabled={!checked || saving || !booking}
                onClick={submit}
                className="mt-4 w-full rounded-catcha-sm bg-latte-deep py-3 text-center text-sm font-extrabold text-card disabled:opacity-40"
              >
                {saving ? "กำลังบันทึก…" : "ยอมรับข้อตกลง"}
              </button>
              {!booking && (
                <p className="mt-3 text-center text-[11px] text-brown-faint">
                  ยังไม่พบการจองห้องพักของคุณ
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
