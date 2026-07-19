"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { resolveGroomForm, type GroomField } from "@/lib/groom-form";

type Answers = Record<string, string | string[]>;

type CatForm = {
  id: string;
  catName: string;
  answers: Answers;
  /** ติ๊ก "ไม่ทราบน้ำหนัก" */
  weightUnknown: boolean;
};

function emptyAnswers(fields: GroomField[]): Answers {
  const a: Answers = {};
  for (const f of fields) a[f.key] = f.type === "multi" ? [] : "";
  return a;
}

/** แปลงค่าที่เคยบันทึกไว้ให้ตรงชนิดของคำถาม (รองรับข้อมูลเก่าที่เป็น string เดี่ยว) */
function loadAnswers(fields: GroomField[], info: Record<string, unknown> | null): Answers {
  const a = emptyAnswers(fields);
  if (!info) return a;
  for (const f of fields) {
    const v = info[f.key];
    if (v == null) continue;
    if (f.type === "multi") {
      a[f.key] = Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
    } else {
      a[f.key] = Array.isArray(v) ? String(v[0] ?? "") : String(v);
    }
  }
  return a;
}

function GroomInfoContent() {
  const params = useSearchParams();
  const ids = (params.get("id") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { profile } = useLiff();
  const { config } = useConfig();

  // คำถามทั้งหมด — ตามที่ร้านตั้งไว้ในหลังบ้าน (ไม่ตั้ง = ค่าเริ่มต้นของระบบ)
  const fields = useMemo(
    () => resolveGroomForm(config.groomForm),
    [config.groomForm]
  );

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
          const info = d.info || null;
          loaded.push({
            id: ids[i],
            catName: d.booking?.catName || "น้อง",
            answers: loadAnswers(fields, info),
            weightUnknown: info?.weight === "unknown",
          });
        });
        setForms(loaded);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString(), fields]);

  const setAnswer = (idx: number, key: string, value: string | string[]) =>
    setForms((prev) =>
      prev.map((f, i) =>
        i === idx ? { ...f, answers: { ...f.answers, [key]: value } } : f
      )
    );

  const toggleOption = (idx: number, key: string, optKey: string) =>
    setForms((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const cur = (f.answers[key] as string[]) || [];
        return {
          ...f,
          answers: {
            ...f.answers,
            [key]: cur.includes(optKey)
              ? cur.filter((x) => x !== optKey)
              : [...cur, optKey],
          },
        };
      })
    );

  /** คำถามที่บังคับตอบแล้วยังว่างอยู่ */
  const missingKeys = (f: CatForm) =>
    fields
      .filter((fd) => {
        if (!fd.required) return false;
        if (fd.key === "weight" && f.weightUnknown) return false;
        const v = f.answers[fd.key];
        return Array.isArray(v) ? v.length === 0 : !String(v || "").trim();
      })
      .map((fd) => fd.key);

  const submit = async () => {
    if (forms.length === 0) return;
    setAttempted(true);
    if (forms.some((f) => missingKeys(f).length > 0)) {
      setSaveError("กรุณาตอบให้ครบทุกข้อที่มีเครื่องหมาย * ก่อนส่งข้อมูลนะคะ 🙏");
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
                ...f.answers,
                weight: f.weightUnknown ? "unknown" : f.answers.weight || "",
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

  const inputClass =
    "w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm";

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
            const missing = missingKeys(f);
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

                {fields.map((fd) => {
                  const isMissing = attempted && missing.includes(fd.key);
                  const value = f.answers[fd.key];
                  return (
                    <div key={fd.key}>
                      <p
                        className={`mt-3 mb-1.5 text-xs font-bold ${
                          isMissing ? "text-wait" : "text-brown-soft"
                        }`}
                      >
                        {fd.label}
                        {fd.required && " *"}
                        {isMissing &&
                          (fd.type === "multi"
                            ? " — กรุณาเลือกอย่างน้อย 1 ข้อ"
                            : fd.type === "single"
                              ? " — กรุณาเลือก"
                              : " — กรุณากรอก")}
                      </p>

                      {fd.type === "single" && (
                        <div className="flex flex-wrap gap-2">
                          {fd.options.map((o) => (
                            <Chip
                              key={o.key}
                              active={value === o.key}
                              label={o.label}
                              onClick={() => setAnswer(idx, fd.key, o.key)}
                            />
                          ))}
                        </div>
                      )}

                      {fd.type === "multi" && (
                        <div className="flex flex-wrap gap-2">
                          {fd.options.map((o) => (
                            <Chip
                              key={o.key}
                              active={((value as string[]) || []).includes(o.key)}
                              label={o.label}
                              onClick={() => toggleOption(idx, fd.key, o.key)}
                            />
                          ))}
                        </div>
                      )}

                      {fd.type === "text" && (
                        <>
                          <input
                            value={f.weightUnknown && fd.hasUnknownToggle ? "" : String(value || "")}
                            onChange={(e) => setAnswer(idx, fd.key, e.target.value)}
                            disabled={fd.hasUnknownToggle && f.weightUnknown}
                            placeholder={fd.placeholder}
                            inputMode={fd.key === "weight" ? "decimal" : undefined}
                            className={`${inputClass} disabled:bg-paper/50 disabled:text-brown-faint`}
                          />
                          {fd.hasUnknownToggle && (
                            <label className="mt-1.5 flex items-center gap-2 text-[11px] font-bold text-brown-soft">
                              <input
                                type="checkbox"
                                checked={f.weightUnknown}
                                onChange={(e) =>
                                  setForms((prev) =>
                                    prev.map((x, i) =>
                                      i === idx
                                        ? { ...x, weightUnknown: e.target.checked }
                                        : x
                                    )
                                  )
                                }
                                className="h-4 w-4 accent-[#4A7348]"
                              />
                              ไม่ทราบน้ำหนัก
                            </label>
                          )}
                        </>
                      )}

                      {fd.type === "textarea" && (
                        <textarea
                          value={String(value || "")}
                          onChange={(e) => setAnswer(idx, fd.key, e.target.value)}
                          placeholder={fd.placeholder}
                          rows={2}
                          className={inputClass}
                        />
                      )}
                    </div>
                  );
                })}
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
