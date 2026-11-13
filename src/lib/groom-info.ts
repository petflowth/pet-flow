import { answeredRecently } from "./groom-form";

/** ป้ายกำกับคำตอบประวัติน้องก่อนอาบน้ำ — ใช้ร่วมกันทั้งฟอร์ม, Telegram brief, แอดมิน */
export const GROOM_TEMPERAMENT_LABELS: Record<string, string> = {
  normal: "ปกติ",
  playful: "ขี้เล่น",
  clingy: "ขี้อ้อน",
  stressed: "เครียดง่าย",
  gentle: "ใจดี ให้จับง่าย",
  fearful: "ขี้กลัว/ตกใจง่าย",
  struggle: "ดิ้น",
  aggressive: "ดุ/กัด/ข่วน",
  strangerShy: "ไม่ชอบคนแปลกหน้า",
  other: "อื่นๆ",
};

export const GROOM_HEALTH_LABELS: Record<string, string> = {
  healthy: "แข็งแรงดี",
  heart: "โรคหัวใจ",
  skin: "โรคผิวหนัง",
  seizure: "ลมชัก/ชัก",
  senior: "สูงอายุ",
  other: "อื่นๆ",
};

export const GROOM_DRY_METHOD_LABELS: Record<string, string> = {
  dryer: "ไดร์เป่าขน",
  cabinet: "ตู้เป่าขน",
};

export const GROOM_HEART_LABELS: Record<string, string> = {
  yes: "เป็นโรคหัวใจ",
  no: "ไม่เป็น",
  unknown: "ไม่เคยตรวจ",
};

/**
 * ป้ายสำรองของทุกคำตอบที่ระบบเคยใช้ — กันคำตอบเก่าโชว์เป็นคีย์ดิบ
 * (เช่น "heart" ที่เมื่อก่อนอยู่ในข้อสุขภาพ ก่อนจะแยกออกมาเป็นข้อโรคหัวใจ)
 */
const LEGACY_LABELS: Record<string, string> = {
  ...GROOM_TEMPERAMENT_LABELS,
  ...GROOM_HEALTH_LABELS,
  ...GROOM_DRY_METHOD_LABELS,
  heart: "โรคหัวใจ",
};

/**
 * ข้อที่เคยเป็นปุ่มเลือก แล้วเปลี่ยนเป็นช่องพิมพ์ — คำตอบเก่ายังเป็นคีย์ (เช่น "1m") แปลงเป็นข้อความให้อ่านได้
 * fleaLast: เดิมเป็นปุ่ม 1m/3m/older/unknown เปลี่ยนเป็นพิมพ์เอง (PR #229, 2026-11-02)
 */
const LEGACY_TEXT_LABELS: Record<string, Record<string, string>> = {
  fleaLast: {
    "1m": "ภายใน 1 เดือน",
    "3m": "1–3 เดือน",
    older: "นานกว่า 3 เดือน",
    unknown: "จำไม่ได้",
  },
};

export type GroomHealthInfo = {
  bathedBefore?: string;
  temperament?: string[];
  health?: string[];
  allergy?: string;
  note?: string;
  /** ได้รับวัคซีนครบหรือยัง */
  vaccinated?: string;
  /** เป็นโรคหัวใจไหม — yes | no | unknown (ไม่เคยตรวจ) */
  heartDisease?: string;
  /** น้ำหนักตัว (โดยประมาณ) — ค่า "unknown" แปลว่าลูกค้าติ๊กไม่ทราบ */
  weight?: string;
  /** วิธีเป่าขนที่เคยใช้ — เลือกได้หลายวิธี (ข้อมูลเก่าอาจเป็น string เดี่ยว) */
  dryMethod?: string[] | string;
  /** ให้ไถขนก้นไหม — yes | no */
  shaveButt?: string;
  /** ให้ไถขนอุ้งเท้าไหม — yes | no */
  shavePaws?: string;
  submittedAt?: string;
};

export function parseGroomInfo(json?: string | null): GroomHealthInfo | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as GroomHealthInfo;
  } catch {
    return null;
  }
}

/**
 * สรุปประวัติน้องเป็น key→value (ใช้ส่ง Telegram brief ให้ร้าน / โชว์ในหน้าลูกค้า)
 * ส่ง fields (จาก resolveGroomForm) มาด้วยได้ — จะใช้หัวข้อ/ตัวเลือกที่ร้านตั้งเองแทนค่าเริ่มต้น
 */
export function groomInfoSummary(
  info: GroomHealthInfo | Record<string, unknown>,
  fields?: {
    key: string;
    type: string;
    label: string;
    options: { key: string; label: string }[];
    allowOther?: boolean;
    askEveryTime?: boolean;
  }[]
): Record<string, string> {
  const val = (k: string) => (info as Record<string, unknown>)[k];
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];

  // ร้านตั้งคำถามเอง → ใช้หัวข้อ + ป้ายตัวเลือกของร้าน
  if (fields?.length) {
    const out: Record<string, string> = {};
    for (const f of fields) {
      const raw = val(f.key);
      // ข้อที่ถามใหม่ทุกนัด (โรคติดต่อ/เชื้อรา) — คำตอบเก่าเกินสัปดาห์ไม่ใช่อาการตอนนี้ ขึ้นว่ายังไม่ได้ตอบ
      if (f.askEveryTime && !answeredRecently(val("submittedAt"))) {
        out[f.label] = "-";
        continue;
      }
      if (f.type === "multi" || f.type === "single") {
        const label = (k: string) =>
          f.options.find((o) => o.key === k)?.label || LEGACY_LABELS[k] || k;
        const typed = f.allowOther ? String(val(`${f.key}Other`) ?? "").trim() : "";
        const picked = asList(raw);
        const text = [...picked.map(label), ...(typed ? [typed] : [])].join(", ");
        // ตอบว่ามีโรค/อาการ (ไม่ใช่ "ไม่มี") — ให้ร้านเห็นชัดใน Telegram/สรุป
        const warn = f.askEveryTime && (typed || picked.some((k) => k !== "none"));
        out[f.label] = text ? (warn ? `⚠️ ${text}` : text) : "-";
      } else {
        const s = String(raw ?? "").trim();
        out[f.label] = LEGACY_TEXT_LABELS[f.key]?.[s] || (s === "unknown" ? "ไม่ทราบ" : s || "-");
      }
    }
    return out;
  }

  // ค่าเริ่มต้นของระบบ (ไม่ได้ส่ง fields มา)
  const g = info as GroomHealthInfo;
  return {
    เคยอาบน้ำที่อื่นมาก่อน:
      g.bathedBefore === "yes" ? "เคย" : g.bathedBefore === "no" ? "ครั้งแรก" : "-",
    นิสัย:
      (g.temperament || []).map((t) => GROOM_TEMPERAMENT_LABELS[t] || t).join(", ") ||
      "-",
    สุขภาพ:
      (g.health || []).map((h) => GROOM_HEALTH_LABELS[h] || h).join(", ") || "-",
    โรคหัวใจ: GROOM_HEART_LABELS[g.heartDisease || ""] || "-",
    ได้รับวัคซีนครบ:
      g.vaccinated === "yes" ? "ครบแล้ว" : g.vaccinated === "no" ? "ยังไม่ครบ" : "-",
    น้ำหนักตัว: g.weight === "unknown" ? "ไม่ทราบ" : g.weight || "-",
    วิธีอาบน้ำที่เคยใช้:
      asList(g.dryMethod)
        .map((d) => GROOM_DRY_METHOD_LABELS[d] || d)
        .join(", ") || "-",
    ไถขนก้น: g.shaveButt === "yes" ? "ไถให้" : g.shaveButt === "no" ? "ไม่ไถ" : "-",
    ไถขนอุ้งเท้า: g.shavePaws === "yes" ? "ไถให้" : g.shavePaws === "no" ? "ไม่ไถ" : "-",
    แพ้: g.allergy || "-",
    เพิ่มเติม: g.note || "-",
  };
}
