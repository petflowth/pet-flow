/**
 * คำภาษาอังกฤษของข้อความค่าเริ่มต้นที่ร้านอาจยังไม่ได้แก้ (ตัวเลือก/รายการที่ร้านแก้เองได้)
 * ลูกค้าเลือก EN → ถ้าข้อความตรงกับค่าเริ่มต้นของระบบ แสดงภาษาอังกฤษ · ร้านพิมพ์เองไม่ตรง = แสดงตามที่ร้านพิมพ์
 */
const EN: Record<string, string> = {
  // รู้จักร้านจากไหน (REFERRAL_OPTIONS)
  "Google / ค้นหา": "Google / search",
  "เพื่อนแนะนำ / ผ่านหน้าร้าน": "Friend / walked past the shop",
  // เรื่องที่ช่างต้องรู้ (STAFF_NOTE_TAGS)
  "โรคตับ": "Liver disease",
  "โรคไต": "Kidney disease",
  "โรคหัวใจ": "Heart disease",
  "เบาหวาน": "Diabetes",
  "ลมชัก": "Seizures",
  "ข้อสะโพก / ขาหลังอ่อนแรง": "Hip problems / weak hind legs",
  "หมอนรองกระดูก": "Spinal disc problems",
  "ตาเป็นต้อ / มองไม่ค่อยเห็น": "Cataracts / poor eyesight",
  "หูอักเสบ / หูไม่ได้ยิน": "Ear infection / hard of hearing",
  "หอบง่าย / หน้าสั้น": "Breathes heavily / flat-faced",
  "เพิ่งผ่าตัด / มีแผล": "Recent surgery / wound",
  "ตั้งท้อง / ให้นม": "Pregnant / nursing",
  "แพ้แชมพู / ผิวแพ้ง่าย": "Shampoo allergy / sensitive skin",
  "ผิวหนังอักเสบ / เชื้อรา": "Skin inflammation / fungal infection",
  "เห็บ หมัด ไรขี้เรื้อน": "Ticks, fleas, mange",
  "ขนพันกันง่าย": "Mats easily",
  "สูงวัย": "Senior",
  "ตื่นคนแปลกหน้า / เสียงดัง": "Nervous with strangers / loud noises",
  "กลัวเสียงไดร์": "Scared of the dryer",
  "ดุตอนตัดเล็บ": "Grumpy during nail trims",
  "ไม่ชอบอยู่กรง": "Dislikes cages",
  "กัด / ข่วน": "Bites / scratches",
};

export function enWord(text: string, locale: "th" | "en"): string {
  if (locale !== "en") return text;
  return EN[text.trim()] ?? text;
}

/** สายพันธุ์ "สก็อตติช โฟลด์ (Scottish Fold)" → ลูกค้า EN เห็น "Scottish Fold" (ค่าที่เก็บยังเป็นชื่อเต็มเดิม) */
export function breedLabel(breed: string, locale: "th" | "en"): string {
  if (locale !== "en") return breed;
  const m = breed.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].trim() : breed;
}
