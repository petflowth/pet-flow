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

/** นัดนี้ปิดข้อความอัตโนมัติหัวข้อนี้ไว้ไหม */
export function autoMuted(b: { autoOff?: string[] }, topic: string) {
  return (b.autoOff || []).includes(topic);
}
