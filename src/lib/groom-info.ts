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

export type GroomHealthInfo = {
  bathedBefore?: string;
  temperament?: string[];
  health?: string[];
  allergy?: string;
  note?: string;
  /** ได้รับวัคซีนแล้วหรือไม่ */
  vaccinated?: string;
  /** สี/ลักษณะเด่น */
  colorMarkings?: string;
  /** น้ำหนักตัว */
  weight?: string;
  /** วิธีการอาบน้ำที่เคยใช้ */
  dryMethod?: string;
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

/** สรุปประวัติน้องเป็น key→value (ใช้ส่ง Telegram brief ให้ร้านก่อนถึงวันนัด) */
export function groomInfoSummary(info: GroomHealthInfo): Record<string, string> {
  return {
    เคยอาบน้ำที่อื่นมาก่อน:
      info.bathedBefore === "yes"
        ? "เคย"
        : info.bathedBefore === "no"
          ? "ครั้งแรก"
          : "-",
    นิสัย:
      (info.temperament || []).map((t) => GROOM_TEMPERAMENT_LABELS[t] || t).join(", ") ||
      "-",
    สุขภาพ:
      (info.health || []).map((h) => GROOM_HEALTH_LABELS[h] || h).join(", ") || "-",
    ได้รับวัคซีนแล้ว:
      info.vaccinated === "yes" ? "ใช่" : info.vaccinated === "no" ? "ไม่" : "-",
    "สี/ลักษณะเด่น": info.colorMarkings || "-",
    น้ำหนักตัว: info.weight || "-",
    วิธีอาบน้ำที่เคยใช้: info.dryMethod ? GROOM_DRY_METHOD_LABELS[info.dryMethod] || info.dryMethod : "-",
    แพ้: info.allergy || "-",
    เพิ่มเติม: info.note || "-",
  };
}
