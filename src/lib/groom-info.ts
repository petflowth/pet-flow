/** ป้ายกำกับคำตอบประวัติน้องก่อนอาบน้ำ — ใช้ร่วมกันทั้งฟอร์ม, Telegram brief, แอดมิน */
export const GROOM_TEMPERAMENT_LABELS: Record<string, string> = {
  gentle: "ใจดี ให้จับง่าย",
  fearful: "ขี้กลัว/ตกใจง่าย",
  aggressive: "ดุ/กัด/ข่วน",
};

export const GROOM_HEALTH_LABELS: Record<string, string> = {
  healthy: "แข็งแรงดี",
  heart: "โรคหัวใจ",
  skin: "โรคผิวหนัง",
  seizure: "ลมชัก/ชัก",
  senior: "สูงอายุ",
  other: "อื่นๆ",
};

export type GroomHealthInfo = {
  bathedBefore?: string;
  temperament?: string[];
  health?: string[];
  allergy?: string;
  note?: string;
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
    แพ้: info.allergy || "-",
    เพิ่มเติม: info.note || "-",
  };
}
