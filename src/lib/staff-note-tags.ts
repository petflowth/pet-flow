/**
 * แท็กสำเร็จรูป "เรื่องที่ช่างต้องรู้" — ให้ลูกค้าแตะเลือกแทนพิมพ์เอง
 * ลดพิมพ์ผิด/ลืมบอก และช่างอ่านเป็นคำเดียวกันทุกบิล ค้นหาย้อนหลังก็ตรงกัน
 *
 * แบ่ง category ไว้เพื่อ map กลับเข้าฟิลด์เดิม 2 ช่องที่ระบบมีอยู่แล้ว:
 * medical (โรคประจำตัว/ยา) และ staffNote (นิสัย/พฤติกรรม) — โครงสร้างข้อมูล
 * ปลายทางไม่ต้องแก้ ของเดิมที่เคยพิมพ์เป็นข้อความอิสระไว้ก็ยังอ่านได้ปกติ
 * (แค่ไม่ติ๊กเป็นแท็กให้อัตโนมัติ จะไปโผล่ในช่อง "อื่นๆ" แทน)
 */
export type StaffNoteTag = {
  id: string;
  label: string;
  category: "medical" | "behavior";
};

export const STAFF_NOTE_TAGS: StaffNoteTag[] = [
  // สุขภาพ/โรคประจำตัว
  { id: "liver", label: "โรคตับ", category: "medical" },
  { id: "kidney", label: "โรคไต", category: "medical" },
  { id: "heart", label: "โรคหัวใจ", category: "medical" },
  { id: "diabetes", label: "เบาหวาน", category: "medical" },
  { id: "seizure", label: "ลมชัก", category: "medical" },
  { id: "hip", label: "ข้อสะโพก / ขาหลังอ่อนแรง", category: "medical" },
  { id: "disc", label: "หมอนรองกระดูก", category: "medical" },
  { id: "eye", label: "ตาเป็นต้อ / มองไม่ค่อยเห็น", category: "medical" },
  { id: "ear", label: "หูอักเสบ / หูไม่ได้ยิน", category: "medical" },
  { id: "brachy", label: "หอบง่าย / หน้าสั้น", category: "medical" },
  { id: "surgery", label: "เพิ่งผ่าตัด / มีแผล", category: "medical" },
  { id: "pregnant", label: "ตั้งท้อง / ให้นม", category: "medical" },
  { id: "shampoo-allergy", label: "แพ้แชมพู / ผิวแพ้ง่าย", category: "medical" },
  { id: "skin", label: "ผิวหนังอักเสบ / เชื้อรา", category: "medical" },
  { id: "flea", label: "เห็บ หมัด ไรขี้เรื้อน", category: "medical" },
  { id: "matted", label: "ขนพันกันง่าย", category: "medical" },
  { id: "senior", label: "สูงวัย", category: "medical" },

  // นิสัย/พฤติกรรม
  { id: "shy", label: "ตื่นคนแปลกหน้า / เสียงดัง", category: "behavior" },
  { id: "dryer-scared", label: "กลัวเสียงไดร์", category: "behavior" },
  { id: "nail-fussy", label: "ดุตอนตัดเล็บ", category: "behavior" },
  { id: "cage-fussy", label: "ไม่ชอบอยู่กรง", category: "behavior" },
  { id: "bite", label: "กัด / ข่วน", category: "behavior" },
];
