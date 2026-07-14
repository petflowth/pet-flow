"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";

type Bk = { id: string; catName: string; service: string; date?: string; time?: string };

const TEMPERAMENT = [
  { key: "gentle", label: "😌 ใจดี ให้จับง่าย" },
  { key: "fearful", label: "🙀 ขี้กลัว/ตกใจง่าย" },
  { key: "aggressive", label: "😾 ดุ/กัด/ข่วน" },
];
const HEALTH = [
  { key: "healthy", label: "💪 แข็งแรงดี" },
  { key: "heart", label: "❤️ โรคหัวใจ" },
  { key: "skin", label: "🩹 โรคผิวหนัง" },
  { key: "seizure", label: "⚡ ลมชัก/ชัก" },
  { key: "senior", label: "👵 สูงอายุ" },
  { key: "other", label: "➕ อื่นๆ" },
];

function GroomInfoContent() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  const { profile } = useLiff();

  const [bk, setBk] = useState<Bk | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [bathedBefore, setBathedBefore] = useState("");
  const [temperament, setTemperament] = useState<string[]>([]);
  const [health, setHealth] = useState<string[]>([]);
  const [allergy, setAllergy] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/bookings/groom-info?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.found) {
          setBk(d.booking);
          if (d.info) {
            setBathedBefore(d.info.bathedBefore || "");
            setTemperament(d.info.temperament || []);
            setHealth(d.info.health || []);
            setAllergy(d.info.allergy || "");
            setNote(d.info.note || "");
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggle = (arr: string[], set: (v: string[]) => void, key: string) =>
    set(arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key]);

  const submit = async () => {
    if (!id) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/bookings/groom-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: id,
          lineUserId: profile?.lineUserId,
          info: { bathedBefore, temperament, health, allergy, note },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setSaveError("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง หรือแจ้งพนักงานที่ร้านได้เลยค่ะ");
        return;
      }
      try {
        const liff = (await import("@line/liff")).default;
        if (liff.isInClient()) {
          liff.closeWindow();
          return;
        }
      } catch {
        /* เปิดนอก LINE — โชว์หน้าจอเสร็จแทน */
      }
      setDone(true);
    } catch {
      setSaveError("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง หรือแจ้งพนักงานที่ร้านได้เลยค่ะ");
    } finally {
      setSaving(false);
    }
  };

  const Chip = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-xs font-bold ${
        active ? "bg-latte-deep text-card" : "bg-paper text-brown-soft"
      }`}
    >
      {label}
    </button>
  );

  if (done) {
    return (
      <div className="px-6 py-16 text-center">
        <div className="text-5xl">🧡</div>
        <h1 className="mt-4 text-lg font-extrabold text-catcha-chocolate">
          ขอบคุณที่แจ้งประวัติน้องนะคะ!
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brown-soft">
          เราจะดูแล{bk?.catName || "น้อง"}อย่างระมัดระวังที่สุด 🐱
          <br />
          กลับไปที่แชท LINE ได้เลยค่ะ
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-10 pt-5">
      <Link href="/app" className="mb-3 inline-block text-xs font-bold text-brown-soft">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-lg font-extrabold text-catcha-chocolate">
        🩺 ประวัติน้องก่อนอาบน้ำ
      </h1>

      {loading ? (
        <p className="mt-6 text-sm text-brown-soft">กำลังโหลด…</p>
      ) : !bk ? (
        <p className="mt-6 rounded-catcha-sm bg-paper px-4 py-3 text-sm text-brown-soft">
          ไม่พบข้อมูลการนัด
        </p>
      ) : (
        <>
          <div className="mt-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
            <p className="text-sm font-bold text-brown">🐱 {bk.catName}</p>
            <p className="text-xs text-brown-soft">
              เพื่อความปลอดภัยของน้อง 🧡 รบกวนแจ้งข้อมูลสั้นๆ ให้เราเตรียมดูแลน้องได้ถูกวิธีนะคะ
            </p>
          </div>

          <p className="mt-5 mb-2 text-xs font-bold text-brown-soft">
            เคยอาบน้ำที่ร้านเรามาก่อนไหมคะ?
          </p>
          <div className="flex gap-2">
            <Chip active={bathedBefore === "yes"} label="✅ เคยมาแล้ว" onClick={() => setBathedBefore("yes")} />
            <Chip active={bathedBefore === "no"} label="🆕 มาครั้งแรก" onClick={() => setBathedBefore("no")} />
          </div>

          <p className="mt-5 mb-2 text-xs font-bold text-brown-soft">
            นิสัยของน้องตอนถูกจับ/อาบน้ำ (เลือกได้หลายข้อ)
          </p>
          <div className="flex flex-wrap gap-2">
            {TEMPERAMENT.map((t) => (
              <Chip
                key={t.key}
                active={temperament.includes(t.key)}
                label={t.label}
                onClick={() => toggle(temperament, setTemperament, t.key)}
              />
            ))}
          </div>

          <p className="mt-5 mb-2 text-xs font-bold text-brown-soft">
            สุขภาพของน้อง (เลือกได้หลายข้อ)
          </p>
          <div className="flex flex-wrap gap-2">
            {HEALTH.map((h) => (
              <Chip
                key={h.key}
                active={health.includes(h.key)}
                label={h.label}
                onClick={() => toggle(health, setHealth, h.key)}
              />
            ))}
          </div>

          <p className="mt-5 mb-1 text-xs font-bold text-brown-soft">
            น้องแพ้อะไรไหมคะ (แชมพู/ยา) — ถ้าไม่มีเว้นว่างได้
          </p>
          <input
            value={allergy}
            onChange={(e) => setAllergy(e.target.value)}
            placeholder="เช่น แพ้แชมพูบางชนิด"
            className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
          />

          <p className="mt-4 mb-1 text-xs font-bold text-brown-soft">
            อยากให้เราดูแล/ระวังเป็นพิเศษเรื่องอะไรไหมคะ
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ไม่ชอบเป่าขนแรง, กลัวเสียงดัง"
            rows={3}
            className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
          />

          {saveError && (
            <p className="mt-4 rounded-catcha-sm bg-wait/10 px-3 py-2 text-xs font-bold text-wait">
              😿 {saveError}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="mt-5 w-full rounded-catcha-sm bg-latte-deep py-3 text-sm font-extrabold text-card active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : "💛 ส่งข้อมูลให้ร้าน"}
          </button>
        </>
      )}
    </div>
  );
}

export default function GroomInfoPage() {
  return (
    <Suspense
      fallback={<p className="px-4 py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>}
    >
      <GroomInfoContent />
    </Suspense>
  );
}
