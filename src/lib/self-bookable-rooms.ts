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
