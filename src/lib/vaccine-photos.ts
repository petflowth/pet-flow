/**
 * รูปสมุดวัคซีนแนบได้หลายรูป — เก็บในคอลัมน์ bookings.vaccine_photo_url เดิม
 * คั่นด้วยขึ้นบรรทัดใหม่ (ไม่ต้องเพิ่มคอลัมน์) ข้อมูลเก่าที่มีรูปเดียวอ่านได้เหมือนเดิม
 */
export const MAX_VACCINE_PHOTOS = 6;
/** รูปที่เก็บไว้ที่ตัวน้องได้รวมทั้งหมด — ร้านขอสมุดเล่มอัปเดตแล้ว รูปเดิมยังอยู่เป็นประวัติ (เกินแล้วรูปเก่าสุดหลุด) */
export const MAX_VACCINE_STORED = 12;

export function splitVaccinePhotos(value?: string | null): string[] {
  return (value || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinVaccinePhotos(urls: string[]): string {
  return urls.map((s) => s.trim()).filter(Boolean).join("\n");
}
