/**
 * Day Care — ฝากเลี้ยงรายวัน ไม่ค้างคืน ใช้ห้องแบบเดียวกับห้องพัก คิดครึ่งราคาห้องต่อคืน (ร้านเปลี่ยน % ได้)
 * นัดเก็บเป็นห้องพักที่ "วันเข้า = วันออก" (ระบบจัดห้องนับเป็นใช้ห้อง 1 วันอยู่แล้ว)
 */
export const DAY_CARE_RATE = 0.5;

/** ราคาต่อวันของ Day Care จากราคาห้องต่อคืน — percent = ที่ร้านตั้ง (ตั้งค่า › ค่าระบบ) */
export function dayCarePrice(nightPrice: number, percent?: number): number {
  const rate = typeof percent === "number" && percent >= 0 ? percent / 100 : DAY_CARE_RATE;
  return Math.round((Number(nightPrice) || 0) * rate);
}

/** นัดห้องพักที่เข้า-ออกวันเดียวกัน = Day Care */
export function isDayCareStay(b: { service?: string; checkin?: string; checkout?: string }): boolean {
  if (b.service && b.service !== "room") return false;
  const ci = (b.checkin || "").slice(0, 10);
  return !!ci && (b.checkout || "").slice(0, 10) === ci;
}

/** ชื่อรายการในบิล เช่น "Day Care ห้อง MiNi Meow" */
export const dayCareLabel = (roomLabel: string) => `Day Care ${roomLabel}`;

export const isDayCareLabel = (label?: string) => /^Day Care\b/.test((label || "").trim());
