import { getSiteConfig } from "./config-store";
import type { SiteConfig } from "./config-types";
import { listBookings } from "./bookings-store";
import { SELF_BOOKABLE_ROOM_INVENTORY_KEY } from "./self-bookable-rooms";

/**
 * ร้านปิดในวันที่ระบุไหม (วันหยุดประจำสัปดาห์ หรือวันหยุดเฉพาะวันที่ตั้งไว้ในหลังบ้าน)
 * ใช้เช็คก่อนให้ลูกค้าจองคิว/ห้องพักเอง — ห้องพักที่เข้าพักอยู่แล้วไม่กระทบ (แค่ปิดรับจอง/เช็คอินใหม่วันนั้น)
 */
export function isShopClosedOn(config: SiteConfig, dateISO: string): boolean {
  const weekday = new Date(`${dateISO}T00:00:00`).getDay();
  if (config.closedWeekdays?.includes(weekday)) return true;
  return Boolean(config.closedDates?.some((d) => d.date === dateISO));
}

export type GroomSlotAvailability = {
  time: string;
  capacity: number;
  booked: number;
  remaining: number;
};

/**
 * ความว่างของแต่ละสล็อตอาบน้ำในวันที่กำหนด
 * ใช้ listBookings() แทนการยิง query เอง — ให้เดินทางเดียวกับที่อื่นในระบบ (ทำงานได้ทั้งโหมด
 * Supabase จริงและโหมด in-memory ตอน dev โดยไม่ต้องเขียน fallback ซ้ำสองที่)
 */
export async function getGroomAvailability(
  date: string
): Promise<{ closed: boolean; slots: GroomSlotAvailability[] }> {
  const config = await getSiteConfig();
  const slots = config.groomSlots || [];
  const defaultCap = config.groomSlotDefaultCapacity ?? 1;
  const closed = isShopClosedOn(config, date);

  const all = await listBookings();
  const bookedByTime = new Map<string, number>();
  for (const b of all) {
    if (b.service !== "groom" || b.date !== date || b.status === "cancelled" || !b.time) continue;
    bookedByTime.set(b.time, (bookedByTime.get(b.time) || 0) + 1);
  }

  // รอบที่เลยเวลามาแล้วของ "วันนี้" ต้องจองไม่ได้ (เทียบเวลาไทย — server รันเป็น UTC)
  const nowBkk = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
  const todayBkk = nowBkk.slice(0, 10);
  const timeNowBkk = nowBkk.slice(11, 16);

  return {
    closed,
    slots: slots.map((time) => {
      const capacity = config.groomSlotCapacity?.[time] ?? defaultCap;
      const booked = bookedByTime.get(time) || 0;
      const past = date === todayBkk && time <= timeNowBkk;
      // วันปิด/รอบที่ผ่านไปแล้ว = จองไม่ได้เลย ไม่ว่าจะเหลือคิวตามตัวเลขจริงเท่าไหร่
      return {
        time,
        capacity,
        booked,
        remaining: closed || past ? 0 : Math.max(0, capacity - booked),
      };
    }),
  };
}

export type RoomAvailability = {
  capacity: number;
  booked: number;
  remaining: number;
  closed: boolean;
};

/**
 * ความว่างของห้องประเภทหนึ่งในช่วงวันที่ที่ขอ (checkout ไม่นับเป็นคืนที่พัก)
 * คืน null ถ้าเป็นห้องเชื่อม/ประเภทที่ยังคำนวณอัตโนมัติไม่ได้
 */
export async function getRoomAvailability(
  roomTypeId: string,
  checkin: string,
  checkout: string
): Promise<RoomAvailability | null> {
  const invKey = SELF_BOOKABLE_ROOM_INVENTORY_KEY[roomTypeId];
  if (!invKey) return null;
  const config = await getSiteConfig();
  // ใช้จำนวนห้องจริงของร้านนี้ (ตั้งได้ในหลังบ้าน) ไม่ใช่ค่าเริ่มต้นของ CatCha —
  // ไม่งั้นร้านที่มีจำนวนห้องต่างจากค่าเริ่มต้นจะเช็คความว่างผิด เสี่ยง overbook หรือปิดขายทั้งที่ห้องว่าง
  const capacity = config.roomInventory?.[invKey] ?? 0;
  // แมวที่เข้าพักอยู่แล้วไม่กระทบวันปิด — แค่ปิดรับเช็คอิน/เช็คเอาท์ใหม่ในวันนั้น
  // (พนักงานยังดูแลน้องตามปกติ แค่ไม่มีใครอยู่หน้าร้านรับ-ส่งของใหม่)
  const closed = isShopClosedOn(config, checkin) || isShopClosedOn(config, checkout);

  const all = await listBookings();
  const booked = all.filter(
    (b) =>
      b.service === "room" &&
      b.room === roomTypeId &&
      b.status !== "cancelled" &&
      b.checkin &&
      b.checkout &&
      b.checkin < checkout &&
      b.checkout > checkin
  ).length;
  return {
    capacity,
    booked,
    remaining: closed ? 0 : Math.max(0, capacity - booked),
    closed,
  };
}
