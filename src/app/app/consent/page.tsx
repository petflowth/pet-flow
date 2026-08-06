"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import type { Booking } from "@/lib/business";

import { DEFAULT_MESSAGES } from "@/lib/messages";
import { LoadingScreen } from "@/components/LoadingScreen";

type StayBooking = Booking & {
  checkin?: string;
  room?: string;
  consentAcceptedAt?: string;
  careNote?: string;
};

function SignaturePad({
  onChange,
}: {
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const getCtx = () => canvasRef.current?.getContext("2d") || null;

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4E3E32";
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawn.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasDrawn.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={200}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-petflow-sm border border-petflow-line bg-white"
        style={{ height: 140 }}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-1.5 text-[11px] font-bold text-brown-soft underline"
      >
        ล้างลายเซ็น
      </button>
    </div>
  );
}

function ConsentContent() {
  const params = useSearchParams();
  const bookingIdParam = params.get("id") || "";
  const { profile, ready } = useLiff();
  const { config } = useConfig();
  const [booking, setBooking] = useState<StayBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [careNote, setCareNote] = useState("");
  const [signature, setSignature] = useState("");
  const [signError, setSignError] = useState(false);

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
        // ถ้ามี id ระบุมาชัดเจน (จากลิงก์ที่ส่งเจาะจงนัดนั้น) ใช้ตัวนั้นเป๊ะๆ —
        // แต่ละรอบเข้าพักต้องยอมรับแยกกันเสมอ ไม่ใช้ "นัดที่ใกล้ที่สุด" เดาแทน
        const stay = bookingIdParam
          ? list.find((b) => b.id === bookingIdParam) || null
          : list
              .filter((b) => b.service === "room" && b.status !== "cancelled")
              .sort((a, b) => (a.checkin || a.date).localeCompare(b.checkin || b.date))[0] || null;
        setBooking(stay);
        if (stay?.consentAcceptedAt) setAccepted(true);
        if (stay?.careNote) setCareNote(stay.careNote);
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [profile?.lineUserId, bookingIdParam]);

  const submit = async () => {
    if (!booking || !profile?.lineUserId) return;
    if (!signature) {
      setSignError(true);
      return;
    }
    setSignError(false);
    setSaving(true);
    try {
      const res = await fetch("/api/bookings/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          lineUserId: profile.lineUserId,
          careNote: careNote.trim(),
          signature,
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

      <h1 className="text-lg font-extrabold text-petflow-chocolate">
        📋 {consentTitle}
      </h1>
      <p className="mt-1 text-xs text-brown-soft">
        {config.business.name} — กรุณาอ่านและกดยอมรับก่อนวันเข้าพักของน้อง
      </p>

      {!ready || loading ? (
        <LoadingScreen />
      ) : (
        <>
          {booking && (
            <div className="mt-4 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
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
                className="flex gap-2 rounded-petflow-sm bg-paper/70 px-3 py-2 text-xs text-brown"
              >
                <span className="font-bold text-latte-deep">{i + 1}.</span>
                <span>{term}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5">
            <label className="text-xs font-bold text-petflow-chocolate">
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
              className="w-full rounded-petflow-sm border border-petflow-line bg-card px-3 py-2 text-xs text-brown disabled:bg-paper/60"
            />
          </div>

          {accepted ? (
            <div className="mt-4 rounded-petflow bg-sage/15 px-4 py-4 text-center">
              <p className="text-sm font-extrabold text-petflow-chocolate">
                ✅ รับทราบและยอมรับข้อตกลงแล้ว
              </p>
              <p className="mt-1 text-xs text-brown-soft">
                ขอบคุณค่ะ ทางเราพร้อมดูแลน้องอย่างดีที่สุด 🧡
              </p>
            </div>
          ) : (
            <>
              <div className="mt-5">
                <label className="text-xs font-bold text-petflow-chocolate">
                  ✍️ ลายเซ็นยืนยันตัวตน
                </label>
                <p className="mb-1.5 text-[11px] text-brown-faint">
                  เซ็นด้วยนิ้วในกรอบด้านล่าง — ไว้เป็นหลักฐานว่าเจ้าของน้องเป็นผู้ยอมรับข้อตกลงเอง
                </p>
                <SignaturePad
                  onChange={(v) => {
                    setSignature(v);
                    if (v) setSignError(false);
                  }}
                />
                {signError && (
                  <p className="mt-1 text-[11px] font-bold text-wait">
                    กรุณาเซ็นชื่อในกรอบก่อนกดยอมรับข้อตกลง
                  </p>
                )}
              </div>

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
                className="mt-4 w-full rounded-petflow-sm bg-latte-deep py-3 text-center text-sm font-extrabold text-card disabled:opacity-40"
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

export default function ConsentPage() {
  return (
    <Suspense
      fallback={<LoadingScreen />}
    >
      <ConsentContent />
    </Suspense>
  );
}
