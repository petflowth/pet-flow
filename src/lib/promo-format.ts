/**
 * ฟังก์ชันจัดรูปแบบล้วน ๆ ไม่แตะ DB/server — แยกออกมาจาก promos-store.ts
 * เพื่อให้ import จากฝั่ง client component ได้โดยไม่ลาก customers-store/tenant-context
 * (ที่ใช้ node:async_hooks) ติดเข้าไปใน bundle เบราว์เซอร์ด้วย
 */
export type PromoRewardType = "discount" | "points" | "both";

export function promoRewardLabel(p: {
  rewardType?: PromoRewardType;
  discountPercent?: number;
  discountAmount?: number;
  pointsBonus?: number;
  pointsMultiplier?: number;
}) {
  const parts: string[] = [];
  if (p.rewardType === "discount" || p.rewardType === "both") {
    if (p.discountPercent) parts.push(`${p.discountPercent}%`);
    if (p.discountAmount) parts.push(`-${p.discountAmount}฿`);
  }
  if (p.rewardType === "points" || p.rewardType === "both") {
    if (p.pointsBonus) parts.push(`+${p.pointsBonus} แต้ม`);
    if (p.pointsMultiplier && p.pointsMultiplier > 1) parts.push(`แต้ม x${p.pointsMultiplier}`);
  }
  return parts.join(" · ");
}
