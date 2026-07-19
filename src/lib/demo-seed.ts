/**
 * ข้อมูลตัวอย่างสำหรับตอนพัฒนา (ไม่มี Supabase) — ปิดสนิทตอนขึ้นจริง/ตอนทำ demo ให้ลูกค้า
 *
 * เมื่อก่อนหน่วยความจำสำรองมีลูกค้า "คุณมาย" + แมว "น้องส้ม" + นัดวันที่ตายตัว + โปร 3 รายการ
 * ติดมาเสมอ ถ้า deploy โดยยังไม่ได้ต่อฐานข้อมูล ลูกค้าที่มาลองระบบจะเห็นข้อมูลปลอมพวกนี้
 * แล้วงงว่าเป็นข้อมูลของใคร
 *
 * ตั้ง SEED_DEMO_DATA=1 ถ้าอยากได้ข้อมูลตัวอย่างกลับมา (เช่น ตอนเดโมสด)
 */
export function seedEnabled(): boolean {
  if (process.env.SEED_DEMO_DATA === "1") return true;
  if (process.env.SEED_DEMO_DATA === "0") return false;
  return process.env.NODE_ENV === "development";
}
