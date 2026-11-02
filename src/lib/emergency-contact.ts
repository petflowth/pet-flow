/**
 * เบอร์ติดต่อฉุกเฉิน — ถามครั้งเดียวตอนสมัครสมาชิก เก็บที่ตัวลูกค้า (customers.emergency_contact)
 * ฟอร์มก่อนอาบน้ำ/เข้าพัก/ทำประวัติไม่ถามอีก (เจ้าของระบบ 2026-11-02)
 * คำตอบเก่าที่เคยตอบในฟอร์มทำประวัติ (cats.stay_info key emergencyContact/emergencyRelation) ยังอ่านได้ — ดู legacyEmergencyFromCats
 */

export type EmergencyContact = {
  /** เบอร์โทร */
  phone: string;
  /** เกี่ยวข้องเป็นอะไรกับลูกค้า เช่น "แม่" "เพื่อน" (ข้อความ ไม่ใช่ key) */
  relation?: string;
};

/** ตัวเลือกความเกี่ยวข้อง — กดเลือก ไม่ต้องพิมพ์ (ไม่มีในตัวเลือก พิมพ์เองได้) */
export const EMERGENCY_RELATIONS: { key: string; label: string; emoji: string }[] = [
  { key: "father", label: "พ่อ", emoji: "👨" },
  { key: "mother", label: "แม่", emoji: "👩" },
  { key: "spouse", label: "สามี/ภรรยา/แฟน", emoji: "💑" },
  { key: "sibling", label: "พี่น้อง", emoji: "👫" },
  { key: "child", label: "ลูก", emoji: "🧒" },
  { key: "relative", label: "ญาติ", emoji: "👪" },
  { key: "friend", label: "เพื่อน", emoji: "🤝" },
];

/** key ในฟอร์มทำประวัติเดิม — เก็บไว้ไม่ให้คำตอบเก่าหายตอนลูกค้าส่งฟอร์มใหม่ */
export const LEGACY_EMERGENCY_KEYS = ["emergencyContact", "emergencyRelation", "emergencyRelationOther"];

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** อ่านจาก body/แถว DB — ไม่มีเบอร์ = ไม่มีข้อมูล */
export function parseEmergencyContact(v: unknown): EmergencyContact | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  const phone = clip(o.phone, 40);
  if (!phone) return undefined;
  const relation = clip(o.relation, 60);
  return relation ? { phone, relation } : { phone };
}

/** ข้อความแสดงผล เช่น "081-234-5678 (แม่)" */
export function emergencyText(e?: EmergencyContact): string {
  if (!e) return "";
  return e.relation ? `${e.phone} (${e.relation})` : e.phone;
}

/** ความเกี่ยวข้องจากคำตอบฟอร์มทำประวัติเดิม (key ตัวเลือก หรือข้อความพิมพ์เอง) */
function legacyRelation(info: Record<string, unknown>): string {
  const other = clip(info.emergencyRelationOther, 60);
  if (other) return other;
  const key = clip(info.emergencyRelation, 60);
  return EMERGENCY_RELATIONS.find((r) => r.key === key)?.label || key;
}

/** ลูกค้าเก่าที่เคยตอบเบอร์ฉุกเฉินไว้ในฟอร์มทำประวัติของน้อง — ใช้แทนเมื่อยังไม่มีที่ตัวลูกค้า */
export function legacyEmergencyFromCats(cats: { stayInfo?: string }[]): EmergencyContact | undefined {
  for (const c of cats) {
    if (!c.stayInfo) continue;
    try {
      const info = JSON.parse(c.stayInfo) as Record<string, unknown>;
      const phone = clip(info.emergencyContact, 120);
      if (!phone) continue;
      const relation = legacyRelation(info);
      return relation ? { phone, relation } : { phone };
    } catch {
      /* ข้อมูลเสีย ข้ามไป */
    }
  }
  return undefined;
}

/** เบอร์ฉุกเฉินของลูกค้า — ที่ตัวลูกค้าก่อน ไม่มีค่อยดูคำตอบเก่าของน้อง */
export function emergencyOf(c: { emergencyContact?: EmergencyContact; cats?: { stayInfo?: string }[] }) {
  return c.emergencyContact ?? legacyEmergencyFromCats(c.cats ?? []);
}
