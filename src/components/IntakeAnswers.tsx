"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { BookingIntakeAnswers, IntakeSection } from "@/lib/intake-answers";

type Item = BookingIntakeAnswers & { bookingId: string };

const SECTION_ICON: Record<IntakeSection["form"], "bath" | "bed" | "alert"> = {
  groom: "bath",
  stay: "bed",
  signup: "alert",
};

function when(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", calendar: "gregory" });
}

/**
 * การ์ดนัดในหลังร้าน: กดดูคำตอบทุกข้อที่ลูกค้ากรอก (ก่อนอาบน้ำ / ก่อนเข้าพัก) ของทุกตัวในนัดนี้
 * ไม่ต้องไปย้อนหาในแชท Telegram ตอนลูกค้าตอบ · โหลดตอนกดเปิดเท่านั้น
 */
export function IntakeAnswers({ ids }: { ids: string[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || items) return;
    setError(false);
    try {
      const r = await fetch(`/api/bookings/intake-answers?ids=${encodeURIComponent(ids.join(","))}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "error");
      setItems(d.items || []);
    } catch {
      setError(true);
    }
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={toggle}
        className="flex min-h-[36px] w-full items-center gap-1.5 rounded-petflow-sm bg-paper px-2.5 text-left text-[11px] font-extrabold text-brown"
      >
        <Icon name="doc" size={14} className="text-brown-soft" />
        <span className="min-w-0 flex-1">คำตอบที่ลูกค้ากรอก (ก่อนอาบน้ำ / ก่อนเข้าพัก)</span>
        <Icon name="chevron" size={14} className={`text-brown-faint transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-2">
          {error && <p className="text-[11px] font-bold text-red-600">โหลดคำตอบไม่สำเร็จ ลองกดใหม่อีกครั้ง</p>}
          {!error && !items && <p className="text-[11px] text-brown-faint">กำลังโหลด…</p>}
          {items?.map((it) => (
            <div key={it.bookingId} className="space-y-1.5">
              {items.length > 1 && (
                <p className="flex items-center gap-1 text-[11px] font-extrabold text-brown-soft">
                  <Icon name="paw" size={12} />
                  {it.catName}
                </p>
              )}
              {it.sections.length === 0 && (
                <p className="text-[11px] text-brown-faint">ร้านปิดฟอร์มข้อมูลก่อนรับน้องไว้</p>
              )}
              {it.sections.map((s) => (
                <div
                  key={s.form}
                  className={`rounded-petflow-sm border px-3 py-2 ${
                    s.empty || s.fromRegister ? "border-wait/40 bg-wait/5" : "border-sage/40 bg-sage/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`flex items-center gap-1.5 text-[11px] font-extrabold ${
                        s.empty || s.fromRegister ? "text-wait" : "text-ok"
                      }`}
                    >
                      <Icon name={SECTION_ICON[s.form]} size={13} />
                      {s.title}
                      {s.empty ? " — ลูกค้ายังไม่ได้กรอก" : s.fromRegister ? " (จากหน้าสมัคร)" : ""}
                    </p>
                    {s.submittedAt && !s.fromRegister && (
                      <p className="shrink-0 text-[9px] text-brown-faint">{when(s.submittedAt)}</p>
                    )}
                  </div>
                  {s.rows.length > 0 && (
                    <dl className="mt-1 space-y-1 text-[11px] text-brown">
                      {s.rows.map((r) => (
                        <div key={r.label} className="flex gap-2">
                          <dt className="w-28 shrink-0 font-bold text-brown-soft">
                            {r.label}
                            {r.required && <span className="text-wait"> *</span>}
                          </dt>
                          <dd
                            className={`min-w-0 flex-1 break-words ${
                              r.answered ? "" : r.required ? "italic text-wait" : "italic text-brown-faint"
                            }`}
                          >
                            {r.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
