/**
 * หัวข้อข้อความอัตโนมัติที่ปิดได้ "เป็นรายนัด"
 *
 * แยกไฟล์ไว้ต่างหากเพราะทั้งหน้าหลังบ้าน (ฝั่งเบราว์เซอร์) และ cron (ฝั่งเซิร์ฟเวอร์)
 * ต้องใช้ร่วมกัน — ถ้าไปวางไว้ใน bookings-store จะลากโค้ดฝั่งเซิร์ฟเวอร์ (Supabase)
 * ติดไปกับ bundle ของเบราว์เซอร์ด้วย
 *
 * คนละเรื่องกับสวิตช์ในหน้าตั้งค่า ซึ่งเปิด/ปิดทั้งร้าน
 */
export const AUTO_MESSAGE_TOPICS: { id: string; label: string }[] = [
  { id: "confirm", label: "📅 การ์ดยืนยันนัด" },
  { id: "groomInfo", label: "🩺 ขอประวัติก่อนอาบน้ำ" },
  { id: "prestay", label: "🏠 แจ้งเตรียมตัวก่อนเข้าพัก" },
  { id: "deposit", label: "💰 เตือนยอดคงเหลือ/มัดจำ" },
  { id: "checkin", label: "🕒 ให้เลือกเวลาเช็คอิน" },
  { id: "checkout", label: "🕒 ให้เลือกเวลาเช็คเอาท์" },
  { id: "review", label: "⭐ ขอรีวิวหลังใช้บริการ" },
];

/** หัวข้อที่ใช้ได้จริงกับนัดอาบน้ำล้วนๆ — ไม่มีเรื่องเข้าพักปนมาให้เลือกโดยไม่จำเป็น */
const GROOM_ONLY_TOPICS = new Set(["confirm", "groomInfo", "deposit", "review"]);
/** หัวข้อที่ใช้ได้จริงกับนัดเข้าพักล้วนๆ — ไม่มีเรื่องอาบน้ำปนมา */
const ROOM_ONLY_TOPICS = new Set(["confirm", "prestay", "deposit", "checkin", "checkout", "review"]);

/**
 * กรองให้เหลือแต่หัวข้อที่เกี่ยวกับนัดนี้จริงๆ — นัดอาบน้ำล้วนไม่ควรมีตัวเลือก
 * "แจ้งเตรียมตัวก่อนเข้าพัก/เลือกเวลาเช็คอิน-เอาท์" มาให้เลือกโดยไม่มีผล และกลับกัน
 * นัดที่มีทั้งอาบน้ำและเข้าพัก (เช่น เข้าพักแล้วอาบน้ำด้วย) ถึงจะเห็นครบทุกหัวข้อ
 */
export function relevantAutoMessageTopics(
  service?: "room" | "groom" | "both"
): { id: string; label: string }[] {
  if (service === "groom") {
    return AUTO_MESSAGE_TOPICS.filter((t) => GROOM_ONLY_TOPICS.has(t.id));
  }
  if (service === "room") {
    return AUTO_MESSAGE_TOPICS.filter((t) => ROOM_ONLY_TOPICS.has(t.id));
  }
  // ไม่รู้ประเภท หรือมีทั้งคู่ — โชว์ครบไว้ก่อน ให้ร้านเลือกเอง
  return AUTO_MESSAGE_TOPICS;
}

/** นัดนี้ปิดข้อความอัตโนมัติหัวข้อนี้ไว้ไหม */
export function autoMuted(b: { autoOff?: string[] }, topic: string) {
  return (b.autoOff || []).includes(topic);
}
