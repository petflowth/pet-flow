"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";

type CatForm = {
  id: string;
  catName: string;
  bathedBefore: string;
  temperament: string[];
  health: string[];
  allergy: string;
  note: string;
};

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
  const ids = (params.get("id") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { profile } = useLiff();

  const [forms, setForms] = useState<CatForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (ids.length === 0) {
      setLoading(false);
      return;
    }
    Promise.all(
      ids.map((id) =>
        fetch(`/api/bookings/groom-info?id=${id}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    )
      .then((results) => {
        const loaded: CatForm[] = [];
        results.forEach((d, i) => {
          if (!d?.found) return;
          loaded.push({
            id: ids[i],
            catName: d.booking?.catName || "น้อง",
            bathedBefore: d.info?.bathedBefore || "",
            temperament: d.info?.temperament || [],
            health: d.info?.health || [],
            allergy: d.info?.allergy || "",
            note: d.info?.note || "",
          });
        });
        setForms(loaded);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const patch = (idx: number, p: Partial<CatForm>) =>
    setForms((prev) => prev.map((f, i) => (i === idx ? { ...f, ...p } : f)));

  const toggle = (idx: number, field: "temperament" | "health", key: string) =>
    setForms((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const arr = f[field];
        return {
          ...f,
          [field]: arr.includes(key) ? arr.filter((x) => x !== key) : [...arr, key],
        };
      })
    );

  const isMissing = (f: CatForm) => ({
    bathedBefore: !f.bathedBefore,
    temperament: f.temperament.length === 0,
    health: f.health.length === 0,
  });

  const submit = async () => {
    if (forms.length === 0) return;
    setAttempted(true);
    const hasMissing = forms.some((f) => {
      const m = isMissing(f);
      return m.bathedBefore || m.temperament || m.health;
    });
    if (hasMissing) {
      setSaveError("กรุณาตอบให้ครบทุกข้อ (ช่องที่ติ๊กเลือก) ก่อนส่งข้อมูลนะคะ 🙏");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const results = await Promise.all(
        forms.map((f) =>
          fetch("/api/bookings/groom-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookingId: f.id,
              lineUserId: profile?.lineUserId,
              info: {
                bathedBefore: f.bathedBefore,
                temperament: f.temperament,
                health: f.health,
                allergy: f.allergy,
                note: f.note,
              },
            }),
          }).then((r) => r.ok)
        )
      );
      if (!results.every(Boolean)) {
        setSaveError("บันทึกไม่สำเร็จบางตัว — ลองใหม่อีกครั้ง หรือแจ้งพนักงานที่ร้านได้เลยค่ะ");
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
          เราจะดูแล{forms.map((f) => f.catName).join(", ") || "น้อง"}อย่างระมัดระวังที่สุด 🐱
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
      ) : forms.length === 0 ? (
        <p className="mt-6 rounded-catcha-sm bg-paper px-4 py-3 text-sm text-brown-soft">
          ไม่พบข้อมูลการนัด
        </p>
      ) : (
        <>
          {forms.length > 1 && (
            <p className="mt-2 text-xs font-bold text-latte-deep">
              🐾 มีน้อง {forms.length} ตัว — รบกวนกรอกให้ครบทุกตัวนะคะ
            </p>
          )}

          {forms.map((f, idx) => {
            const missing = isMissing(f);
            return (
            <div
              key={f.id}
              className="mt-4 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm"
            >
              <p className="text-sm font-extrabold text-brown">🐱 {f.catName}</p>
              {forms.length === 1 && (
                <p className="mt-1 text-xs text-brown-soft">
                  เพื่อความปลอดภัยของน้อง 🧡 รบกวนแจ้งข้อมูลสั้นๆ ให้เราเตรียมดูแลน้องได้ถูกวิธีนะคะ
                </p>
              )}

              <p
                className={`mt-3 mb-1.5 text-xs font-bold ${
                  attempted && missing.bathedBefore ? "text-wait" : "text-brown-soft"
                }`}
              >
                เคยอาบน้ำที่อื่นมาก่อนไหมคะ หรือว่าครั้งแรก *
                {attempted && missing.bathedBefore && " — กรุณาเลือก"}
              </p>
              <div className="flex gap-2">
                <Chip
                  active={f.bathedBefore === "yes"}
                  label="✅ เคยอาบที่อื่นแล้ว"
                  onClick={() => patch(idx, { bathedBefore: "yes" })}
                />
                <Chip
                  active={f.bathedBefore === "no"}
                  label="🆕 ครั้งแรก"
                  onClick={() => patch(idx, { bathedBefore: "no" })}
                />
              </div>

              <p
                className={`mt-3 mb-1.5 text-xs font-bold ${
                  attempted && missing.temperament ? "text-wait" : "text-brown-soft"
                }`}
              >
                นิสัยตอนถูกจับ/อาบน้ำ (เลือกได้หลายข้อ) *
                {attempted && missing.temperament && " — กรุณาเลือกอย่างน้อย 1 ข้อ"}
              </p>
              <div className="flex flex-wrap gap-2">
                {TEMPERAMENT.map((t) => (
                  <Chip
                    key={t.key}
                    active={f.temperament.includes(t.key)}
                    label={t.label}
                    onClick={() => toggle(idx, "temperament", t.key)}
                  />
                ))}
              </div>

              <p
                className={`mt-3 mb-1.5 text-xs font-bold ${
                  attempted && missing.health ? "text-wait" : "text-brown-soft"
                }`}
              >
                สุขภาพ (เลือกได้หลายข้อ) *
                {attempted && missing.health && " — กรุณาเลือกอย่างน้อย 1 ข้อ"}
              </p>
              <div className="flex flex-wrap gap-2">
                {HEALTH.map((h) => (
                  <Chip
                    key={h.key}
                    active={f.health.includes(h.key)}
                    label={h.label}
                    onClick={() => toggle(idx, "health", h.key)}
                  />
                ))}
              </div>

              <p className="mt-3 mb-1 text-xs font-bold text-brown-soft">
                แพ้อะไรไหมคะ (แชมพู/ยา) — ถ้าไม่มีเว้นว่างได้
              </p>
              <input
                value={f.allergy}
                onChange={(e) => patch(idx, { allergy: e.target.value })}
                placeholder="เช่น แพ้แชมพูบางชนิด"
                className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
              />

              <p className="mt-3 mb-1 text-xs font-bold text-brown-soft">
                อยากให้เราดูแล/ระวังเป็นพิเศษเรื่องอะไรไหมคะ
              </p>
              <textarea
                value={f.note}
                onChange={(e) => patch(idx, { note: e.target.value })}
                placeholder="เช่น ไม่ชอบเป่าขนแรง, กลัวเสียงดัง"
                rows={2}
                className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
              />
            </div>
            );
          })}

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
            {saving
              ? "กำลังบันทึก…"
              : forms.length > 1
                ? `💛 ส่งข้อมูลให้ร้าน (${forms.length} ตัว)`
                : "💛 ส่งข้อมูลให้ร้าน"}
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
