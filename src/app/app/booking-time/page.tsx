"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { formatThaiDateShort } from "@/lib/format-thai-date";

const SLOTS = Array.from({ length: 11 }, (_, i) => `${String(9 + i).padStart(2, "0")}:00`);

type Bk = {
  id: string;
  catName: string;
  service: string;
  checkin?: string;
  checkout?: string;
  arrivalTime?: string;
  pickupTime?: string;
};

function BookingTimeContent() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  const type = params.get("type") === "checkout" ? "checkout" : "checkin";
  const { profile } = useLiff();

  const [bk, setBk] = useState<Bk | null>(null);
  const [loading, setLoading] = useState(true);
  const [custom, setCustom] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const isCheckin = type === "checkin";

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/bookings/time?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.found) {
          setBk(d.booking);
          setSaved(type === "checkin" ? d.booking.arrivalTime : d.booking.pickupTime);
        }
      })
      .finally(() => setLoading(false));
  }, [id, type]);

  const pick = async (time: string) => {
    if (!time || !id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bookings/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: id,
          type,
          time,
          lineUserId: profile?.lineUserId,
        }),
      });
      if (res.ok) setSaved(time);
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient()) liff.closeWindow();
    } catch {
      /* ไม่ได้เปิดใน LINE — โชว์หน้าจอเสร็จสิ้นแทน */
    }
    setDone(true);
  };

  const dateLabel = isCheckin ? bk?.checkin : bk?.checkout;

  if (done) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="text-5xl">🧡</div>
        <h1 className="mt-4 text-lg font-extrabold text-petflow-chocolate">
          บันทึกเวลาเรียบร้อยแล้ว!
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brown-soft">
          {isCheckin
            ? `เราจะเตรียมห้องรอต้อนรับ${bk?.catName || "น้อง"}ตอน ${saved} นะคะ 🐱`
            : `เราจะเตรียม${bk?.catName || "น้อง"}ให้พร้อมก่อนกลับบ้านตอน ${saved} นะคะ 🐱`}
          <br />
          กลับไปที่แชท LINE ได้เลยค่ะ
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-5">
      <Link href="/app" className="mb-3 inline-block text-xs font-bold text-brown-soft">
        ← กลับหน้าแรก
      </Link>

      <h1 className="text-lg font-extrabold text-petflow-chocolate">
        🕒 {isCheckin ? "เลือกเวลาที่จะมาส่งน้อง" : "เลือกเวลาที่จะมารับน้อง"}
      </h1>

      {loading ? (
        <p className="mt-6 text-sm text-brown-soft">กำลังโหลด…</p>
      ) : !bk ? (
        <p className="mt-6 rounded-petflow-sm bg-paper px-4 py-3 text-sm text-brown-soft">
          ไม่พบข้อมูลการจอง
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
            <p className="text-sm font-bold text-brown">🐱 {bk.catName}</p>
            <p className="text-xs text-brown-soft">
              {isCheckin ? "วันเข้าพัก" : "วันรับน้อง"}:{" "}
              {dateLabel ? formatThaiDateShort(dateLabel) : "—"}
            </p>
          </div>

          {saved && (
            <div className="mt-4 rounded-petflow bg-sage/15 px-4 py-4 text-center">
              <p className="text-base font-extrabold text-petflow-chocolate">
                ✅ เลือกเวลา {saved} แล้ว
              </p>
              <p className="mt-1 text-xs text-brown-soft">
                ถ้าถูกต้องแล้ว กดปุ่มด้านล่างเพื่อยืนยันและกลับไปที่แชทได้เลยค่ะ 🧡
              </p>
              <button
                type="button"
                onClick={finish}
                className="mt-3 w-full rounded-petflow-sm bg-latte-deep py-3 text-sm font-extrabold text-card active:scale-[0.98]"
              >
                เสร็จแล้ว — กลับไปที่แชท 🧡
              </button>
            </div>
          )}

          <p className="mt-5 mb-2 text-xs font-bold text-brown-soft">
            {saved ? "เปลี่ยนเวลา (ถ้าต้องการ)" : "เลือกเวลา"}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={saving}
                onClick={() => pick(t)}
                className={`rounded-petflow-sm py-2.5 text-sm font-bold disabled:opacity-50 ${
                  saved === t
                    ? "bg-latte-deep text-card"
                    : "bg-paper text-brown-soft"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <p className="mt-4 mb-1 text-xs font-bold text-brown-soft">หรือกรอกเวลาเอง</p>
          <div className="flex gap-2">
            <input
              type="time"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="min-w-0 flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm"
            />
            <button
              type="button"
              disabled={!custom || saving}
              onClick={() => pick(custom)}
              className="shrink-0 rounded-petflow-sm bg-honey-deep/80 px-4 py-2.5 text-sm font-extrabold text-petflow-chocolate disabled:opacity-40"
            >
              บันทึก
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function BookingTimePage() {
  return (
    <Suspense
      fallback={<p className="px-4 py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>}
    >
      <BookingTimeContent />
    </Suspense>
  );
}
