import type { BookingStatus } from "./business";

type StatusBooking = {
  id: string;
  status: BookingStatus | string;
  date?: string;
  checkin?: string;
  checkout?: string;
};

/** วันสุดท้ายที่นัดนี้เกี่ยวข้อง — เข้าพักใช้วันเช็คเอาท์, อาบน้ำใช้วันนัด */
export function bookingLastDate(b: StatusBooking): string {
  return b.checkout || b.date || b.checkin || "";
}

/**
 * นัดนี้ยัง "รอลูกค้ายืนยัน" อยู่จริงไหม
 *
 * สถานะที่เก็บไว้เป็น pending แค่บอกว่าไม่มีใครกดยืนยันในระบบ ซึ่งไม่ได้แปลว่า
 * งานยังค้าง — ลูกค้าที่มาแล้วและออกบิลไปแล้วก็ยังเป็น pending อยู่ ทำให้คิว
 * "รอยืนยัน" บวมด้วยนัดที่จบไปนานแล้ว จนตัวเลขนั้นเชื่อถือไม่ได้
 *
 * ถือว่าไม่ต้องยืนยันแล้วเมื่อ: วันนัดผ่านไปแล้ว (มาแล้ว) หรือมีบิลผูกอยู่ (คิดเงินแล้ว)
 */
export function isAwaitingConfirmation(
  b: StatusBooking,
  today: string,
  billedBookingIds?: Set<string>
): boolean {
  if (b.status !== "pending") return false;
  if (billedBookingIds?.has(b.id)) return false;
  const last = bookingLastDate(b);
  if (last && last < today) return false;
  return true;
}

/**
 * สถานะที่ควรโชว์ให้พนักงานเห็น — pending ที่ผ่านมาแล้ว/ออกบิลแล้ว ให้นับเป็น confirmed
 * ไม่ได้แก้ข้อมูลในฐานข้อมูล แค่ตีความตอนแสดงผล
 */
export function effectiveBookingStatus(
  b: StatusBooking,
  today: string,
  billedBookingIds?: Set<string>
): BookingStatus {
  if (b.status === "pending" && !isAwaitingConfirmation(b, today, billedBookingIds)) {
    return "confirmed";
  }
  return b.status as BookingStatus;
}
