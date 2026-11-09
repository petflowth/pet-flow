"use client";

import { useEffect } from "react";
import { Icon } from "@/components/Icon";
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/PageHeader";

export type ReviewRow = {
  label: string;
  /** ค่าว่าง / [] = ขึ้น "ไม่ได้ระบุ" สีจาง */
  value: string | string[] | null | undefined;
};
export type ReviewSection = { title: string; icon?: string; rows: ReviewRow[] };

/** "2020-05-01" → "1 พ.ค. 2563" (ว่าง = ว่าง) */
export function reviewDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

/** ทำค่าให้อ่านง่าย — อาเรย์ต่อด้วย "," ตัดช่องว่าง */
function show(v: ReviewRow["value"]): string {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean).join(", ");
  return String(v ?? "").trim();
}

/**
 * ป๊อปอัป "เช็คข้อมูลอีกครั้ง" — ลูกค้ากดส่งฟอร์มแล้วโชว์สรุปทุกข้อที่กรอก
 * กด "แก้ไข" กลับไปฟอร์มเดิม (ค่าที่กรอกยังอยู่) · กด "ยืนยัน" ค่อยบันทึกจริง
 */
export function ReviewSheet({
  open,
  title = "เช็คข้อมูลอีกครั้งนะคะ",
  subtitle = "ถ้าถูกต้องแล้วกดยืนยันได้เลย ถ้ามีจุดไหนผิดกดแก้ไขค่ะ",
  sections,
  confirmLabel = "ยืนยัน ส่งข้อมูล",
  saving = false,
  error,
  onEdit,
  onConfirm,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  sections: ReviewSection[];
  confirmLabel?: string;
  saving?: boolean;
  /** บันทึกไม่ผ่าน — โชว์ในป๊อปอัปเลย ไม่ต้องปิดไปหา */
  error?: string;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  // เปิดป๊อปอัปอยู่ — ล็อกหน้าข้างหลังไม่ให้เลื่อนตาม
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const list = sections.filter((s) => s.rows.length > 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-petflow-chocolate/40 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={() => !saving && onEdit()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="animate-pop flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-petflow bg-card shadow-petflow sm:rounded-petflow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-petflow-line px-5 pb-3 pt-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-honey/30 text-petflow-chocolate">
            <Icon name="eye" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-petflow-chocolate">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-brown-soft">{subtitle}</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          {list.map((s, i) => (
            <section key={i} className="rounded-petflow-sm border border-petflow-line bg-paper/60 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-extrabold text-petflow-chocolate">
                <Icon name={s.icon || "paw"} size={15} />
                {s.title}
              </p>
              <dl className="divide-y divide-petflow-line/70">
                {s.rows.map((r, j) => {
                  const v = show(r.value);
                  return (
                    <div key={j} className="py-2">
                      <dt className="text-[11px] leading-snug text-brown-soft">{r.label}</dt>
                      <dd
                        className={`mt-0.5 whitespace-pre-line break-words text-sm font-bold ${
                          v ? "text-petflow-chocolate" : "font-normal text-brown-faint"
                        }`}
                      >
                        {v || "ไม่ได้ระบุ"}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>

        <div className="space-y-2 border-t border-petflow-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {error && (
            <p className="flex gap-2 rounded-petflow-sm bg-wait/10 px-3 py-2 text-xs font-bold text-wait">
              <Icon name="alert" size={15} className="mt-px" />
              {error}
            </p>
          )}
          <button type="button" onClick={onConfirm} disabled={saving} className={BTN_PRIMARY}>
            {!saving && <Icon name="check" size={18} strokeWidth={2.4} />}
            {saving ? "กำลังบันทึก…" : confirmLabel}
          </button>
          <button type="button" onClick={onEdit} disabled={saving} className={BTN_SECONDARY}>
            <Icon name="edit" size={16} />
            แก้ไขข้อมูล
          </button>
        </div>
      </div>
    </div>
  );
}
