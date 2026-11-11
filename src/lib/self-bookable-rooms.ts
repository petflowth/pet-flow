/**
 * ห้องที่ลูกค้าจองเองได้ (มีจำนวนยูนิตนับได้ชัดเจนใน roomInventory)
 * ห้องเชื่อม (duo/tower) กินยูนิตห้องเดี่ยวร่วมกัน คำนวณความว่างอัตโนมัติไม่ได้ในเวอร์ชันนี้
 *
 * ไฟล์นี้ไม่ import อะไรเลย (ปลอดภัยทั้งฝั่ง client และ server) — ใช้เป็นจุดเดียว
 * ที่ทั้ง availability.ts (server) และ book/page.tsx (client) อ้างอิง กันข้อมูลสองฝั่งไม่ตรงกัน
 */
export const SELF_BOOKABLE_ROOM_INVENTORY_KEY: Record<string, "miniMeow" | "midCozy" | "catflix"> = {
  "mini-meow": "miniMeow",
  "mid-cozy": "midCozy",
  catflix: "catflix",
};

export const SELF_BOOKABLE_ROOM_IDS = Object.keys(SELF_BOOKABLE_ROOM_INVENTORY_KEY);

/**
 * ห้องนี้ลูกค้าจองเองได้ไหม — ห้องเดี่ยวที่ร้านตั้ง "จำนวนห้องจริง" ไว้ (รวมห้องที่ร้านเพิ่มเอง
 * เช่นห้องของสาขาที่ 2) · ห้องเชื่อมยังจองเองไม่ได้ เพราะกินยูนิตของห้องเดี่ยวร่วมกัน
 */
export function isSelfBookableRoom(room: { id: string; count?: number; composedOf?: unknown[] } | undefined): boolean {
  if (!room) return false;
  if (room.composedOf?.length) return false;
  return room.id in SELF_BOOKABLE_ROOM_INVENTORY_KEY || Number(room.count) > 0;
}
