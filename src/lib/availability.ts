import { getSiteConfig } from "./config-store";
import { listBookings } from "./bookings-store";
import { ROOM_INVENTORY } from "./business";

/**
 * ประเภทห้องที่คำนวณความว่างอัตโนมัติได้ (มีจำนวนยูนิตชัดเจนใน ROOM_INVENTORY)
 * ห้องเชื่อม (mini-duo/cozy-duo/cat-tower) กินยูนิตห้องเดี่ยวร่วมกัน คำนวณอัตโนมัติไม่ได้ในเวอร์ชันนี้
 * — ให้ลูกค้าติดต่อร้านแทน (getRoomAvailability คืนค่า null)
 */
const SELF_BOOKABLE_ROOMS: Record<string, keyof typeof ROOM_INVENTORY> = {
  "mini-meow": "miniMeow",
  "mid-cozy": "midCozy",
  catflix: "catflix",
};

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
export async function getGroomAvailability(date: string): Promise<GroomSlotAvailability[]> {
  const config = await getSiteConfig();
  const slots = config.groomSlots || [];
  const defaultCap = config.groomSlotDefaultCapacity ?? 1;

  const all = await listBookings();
  const bookedByTime = new Map<string, number>();
  for (const b of all) {
    if (b.service !== "groom" || b.date !== date || b.status === "cancelled" || !b.time) continue;
    bookedByTime.set(b.time, (bookedByTime.get(b.time) || 0) + 1);
  }

  return slots.map((time) => {
    const capacity = config.groomSlotCapacity?.[time] ?? defaultCap;
    const booked = bookedByTime.get(time) || 0;
    return { time, capacity, booked, remaining: Math.max(0, capacity - booked) };
  });
}

export type RoomAvailability = { capacity: number; booked: number; remaining: number };

/**
 * ความว่างของห้องประเภทหนึ่งในช่วงวันที่ที่ขอ (checkout ไม่นับเป็นคืนที่พัก)
 * คืน null ถ้าเป็นห้องเชื่อม/ประเภทที่ยังคำนวณอัตโนมัติไม่ได้
 */
export async function getRoomAvailability(
  roomTypeId: string,
  checkin: string,
  checkout: string
): Promise<RoomAvailability | null> {
  const invKey = SELF_BOOKABLE_ROOMS[roomTypeId];
  if (!invKey) return null;
  const capacity = ROOM_INVENTORY[invKey];

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
  return { capacity, booked, remaining: Math.max(0, capacity - booked) };
}
