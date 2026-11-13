"use client";

import { useLocale } from "@/components/LocaleProvider";
import { EMERGENCY_RELATIONS, type EmergencyContact } from "@/lib/emergency-contact";

/** ค่าที่กำลังกรอก — relation เป็นข้อความ (ตัวเลือกที่กด หรือพิมพ์เอง) */
export type EmergencyForm = { phone: string; relation: string };

export const emptyEmergencyForm = (e?: EmergencyContact | null): EmergencyForm => ({
  phone: e?.phone || "",
  relation: e?.relation || "",
});

/** ส่งขึ้นเซิร์ฟเวอร์ — ไม่มีเบอร์ = ไม่ส่ง */
export function emergencyFromForm(f: EmergencyForm): EmergencyContact | undefined {
  const phone = f.phone.trim();
  if (!phone) return undefined;
  const relation = f.relation.trim();
  return relation ? { phone, relation } : { phone };
}

/** ยังกรอกไม่ครบ (ร้านตั้งบังคับ) — คืนข้อความเตือน */
export function emergencyProblem(f: EmergencyForm, required: boolean, locale: "th" | "en" = "th"): string {
  const digits = f.phone.replace(/\D/g, "");
  const en = locale === "en";
  if (!required && !f.phone.trim() && !f.relation.trim()) return "";
  if (digits.length < 9) return en ? "Please enter an emergency contact number" : "กรอกเบอร์ติดต่อฉุกเฉินด้วยนะคะ";
  if (!f.relation.trim())
    return en ? "Please choose how the emergency contact is related to you" : "เลือกว่าผู้ติดต่อฉุกเฉินเกี่ยวข้องเป็นอะไรกับคุณด้วยนะคะ";
  return "";
}

/**
 * ช่องเบอร์ติดต่อฉุกเฉิน + ความเกี่ยวข้อง (กดเลือก / พิมพ์เอง) — หน้าสมัครสมาชิก หน้าแก้ข้อมูลของฉัน
 * และหลังบ้าน (เพิ่มลูกค้าเอง / แก้ไขข้อมูลลูกค้า) — ลูกค้าที่ร้านเพิ่มให้ไม่ผ่านหน้าสมัคร จึงต้องกรอกที่หลังบ้าน
 */
export function EmergencyContactInput({
  value,
  onChange,
  label,
  required,
  showMissing,
  inputClass,
  relationLabel,
}: {
  value: EmergencyForm;
  onChange: (v: EmergencyForm) => void;
  label: string;
  required: boolean;
  /** กดบันทึกแล้ว — ข้อที่ยังว่างขึ้นสีเตือน */
  showMissing?: boolean;
  inputClass: string;
  /** หัวข้อช่องความเกี่ยวข้อง — หลังบ้านใช้ "เกี่ยวข้องเป็นอะไรกับลูกค้า" */
  relationLabel?: string;
}) {
  const { locale } = useLocale();
  const tr = (th: string, en: string) => (locale === "en" ? en : th);
  const relLabel = relationLabel ?? tr("เกี่ยวข้องเป็นอะไรกับคุณคะ", "How are they related to you?");
  const preset = EMERGENCY_RELATIONS.find((r) => r.label === value.relation.trim());
  const typed = preset ? "" : value.relation;
  const phoneMissing = showMissing && required && value.phone.replace(/\D/g, "").length < 9;
  const relationMissing = showMissing && (required || value.phone.trim()) && !value.relation.trim();
  return (
    <div className="space-y-2">
      <label className="block">
        <span className={`mb-1 block text-xs font-bold ${phoneMissing ? "text-wait" : "text-brown"}`}>
          {label}
          {!required && <span className="font-normal text-brown-faint"> {tr("(ไม่บังคับ)", "(optional)")}</span>}
        </span>
        <input
          type="tel"
          inputMode="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder={tr("เช่น 081-234-5678", "e.g. 081-234-5678")}
          className={inputClass}
        />
      </label>
      <div>
        <p className={`mb-1 text-xs font-bold ${relationMissing ? "text-wait" : "text-brown"}`}>
          {relLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          {EMERGENCY_RELATIONS.map((r) => {
            const active = preset?.key === r.key;
            return (
              <button
                key={r.key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...value, relation: active ? "" : r.label })}
                className={`min-h-[44px] rounded-full px-4 text-xs font-bold transition ${
                  active ? "bg-latte-deep text-card shadow-petflow-sm" : "bg-paper text-brown-soft"
                }`}
              >
                {r.emoji} {locale === "en" ? r.en : r.label}
              </button>
            );
          })}
        </div>
        <input
          value={typed}
          onChange={(e) => onChange({ ...value, relation: e.target.value })}
          placeholder={tr("อื่นๆ พิมพ์เองได้ (ถ้าไม่มีในตัวเลือก)", "Other — type your own")}
          className={`mt-2 ${inputClass}`}
        />
      </div>
    </div>
  );
}
