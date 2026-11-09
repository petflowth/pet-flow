/**
 * วันที่ปัจจุบันตามเวลาไทย (YYYY-MM-DD)
 *
 * ห้ามใช้ new Date().toISOString().slice(0, 10) กับวันที่ที่ลงบัญชี — นั่นคือวันที่ UTC
 * ซึ่งช้ากว่าไทย 7 ชั่วโมง กดรับเงินก่อน 7 โมงเช้าจะถูกลงเป็นวันของเมื่อวาน
 * (และวันที่ 1 ตอนเช้ามืดจะหลุดไปอยู่เดือนก่อน)
 */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** เวลาปัจจุบันตามเวลาไทย (HH:MM) — ใช้เทียบกับเวลานัดที่เก็บเป็น "HH:MM" */
export function bangkokNowTime(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

/** วันที่ (YYYY-MM-DD) ตามเวลาไทยของเวลา ISO — ใช้หา "วันออกบิล" ของบิลเก่าที่เก็บเวลาแบบ UTC */
export function bangkokDateOf(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return (iso || "").slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * เวลา ISO ของ "วันที่เลือก" (YYYY-MM-DD) + เวลาปัจจุบัน — ใช้เป็นวันออกบิล/วันรับเงิน
 *
 * ต้องได้ทั้งสองอย่าง: .slice(0, 10) = วันที่เลือก (หลายที่ตัดแบบนี้ไปลงบัญชี)
 * และพอแปลงเป็นเวลาไทยแล้วยังเป็นวันเดียวกัน (เอกสารโชว์ตามเวลาไทย)
 * เลยใช้เวลาไทยตอนนี้ลบ 7 ชม. ถ้ากดก่อน 7 โมงเช้า (ติดลบ) ใช้ 00:xx แทน
 */
export function dateStamp(date: string): string {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : bangkokToday();
  const now = new Date();
  const [h, m, s] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .format(now)
    .split(":")
    .map(Number);
  const hh = Math.max(0, h - 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day}T${pad(hh)}:${pad(m)}:${pad(s)}.${String(now.getMilliseconds()).padStart(3, "0")}Z`;
}

/** YYYY-MM-DD ที่ใช้ได้จริง (ไม่ใช่ 2026-02-31) */
export function isValidDay(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
