/**
 * คำนวณอายุน้องแมวปัจจุบัน
 * - ถ้ามีวันเกิด → คำนวณจากวันเกิด (แม่นสุด)
 * - ถ้าไม่มีวันเกิด แต่มีอายุ ณ วันที่บันทึก → บวกเวลาที่ผ่านไป
 *   เช่น บันทึกว่า 4 เดือน เมื่อ 6 เดือนก่อน → ตอนนี้ 10 เดือน
 */

export type CatAgeInput = {
  birthday?: string;
  ageValue?: number;
  ageUnit?: "year" | "month";
  ageAsOf?: string;
};

function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

/** อายุปัจจุบันเป็นจำนวนเดือน (null = ไม่ทราบ) */
export function catCurrentAgeMonths(
  cat: CatAgeInput,
  now: Date = new Date()
): number | null {
  if (cat.birthday) {
    const b = new Date(cat.birthday);
    if (!isNaN(b.getTime())) return monthsBetween(b, now);
  }
  if (cat.ageValue != null && !isNaN(cat.ageValue) && cat.ageAsOf) {
    const asOf = new Date(cat.ageAsOf);
    if (!isNaN(asOf.getTime())) {
      const base = cat.ageUnit === "year" ? cat.ageValue * 12 : cat.ageValue;
      return base + monthsBetween(asOf, now);
    }
  }
  return null;
}

/** แปลงจำนวนเดือนเป็นข้อความไทย เช่น "1 ปี 2 เดือน" / "8 เดือน" */
export function formatAgeMonths(months: number | null): string {
  if (months == null) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y <= 0) return `${m} เดือน`;
  if (m === 0) return `${y} ปี`;
  return `${y} ปี ${m} เดือน`;
}

/** อายุปัจจุบันเป็นข้อความไทยพร้อมใช้ */
export function catCurrentAgeLabel(cat: CatAgeInput, now?: Date): string {
  return formatAgeMonths(catCurrentAgeMonths(cat, now));
}
