import type { PointsRewardConfig } from "./config-types";

/** อ่านจำนวนเงินส่วนลดจากชื่อรางวัล เช่น "คูปองส่วนลด 50 บาท" → 50 (ไม่เจอ = 0) */
export function parseDiscountBaht(label: string): number {
  const m = (label || "").replace(/,/g, "").match(/(\d+)\s*บาท/);
  return m ? Number(m[1]) : 0;
}

/**
 * มูลค่าส่วนลด (บาท) ของรางวัลแลกแต้ม — ใช้ช่อง "มูลค่าส่วนลด" ที่ตั้งไว้ก่อน
 * ถ้าไม่ได้ตั้ง ลองอ่านเลข "X บาท" จากชื่อรางวัล · 0 = รางวัลนี้ไม่ใช่ส่วนลดเงิน
 * (ใช้ได้ทั้งฝั่งเซิร์ฟเวอร์และหน้าเว็บ — ไฟล์นี้ไม่ดึงอะไรฝั่งเซิร์ฟเวอร์)
 */
export function rewardDiscountBaht(tier: Pick<PointsRewardConfig, "discount" | "reward">): number {
  return tier.discount && tier.discount > 0 ? tier.discount : parseDiscountBaht(tier.reward?.th || "");
}
