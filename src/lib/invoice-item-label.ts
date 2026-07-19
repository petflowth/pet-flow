/**
 * ย่อรายการในบิลให้อ่านง่าย — ใช้ร่วมกันทุกที่ที่เอารายการบิลไปโชว์เป็นสรุปสั้นๆ
 * (ประวัติเครดิต Member, รายการรายรับ-รายจ่าย ฯลฯ)
 *
 * ตั้งแต่เพิ่มชื่อน้อง/จำนวนต่อรายการเข้าไปใน label ของแต่ละไอเทม บิลที่มีหลายตัว/
 * หลายรายการจะได้ label ยาวมาก เอาไปต่อกันตรงๆ อ่านไม่ไหว (เช่น ขึ้นซ้ำกันทั้งหัวเรื่อง
 * และบรรทัดหมวดหมู่) ฟังก์ชันนี้ตัดชื่อน้อง/พันธุ์/ไซส์/ตัวคูณที่ห้อยท้ายออก เหลือแค่ชื่อรายการ
 */
export function shortItemLabel(label: string): string {
  return label
    .replace(/^🐱 .+? · /, "")
    .replace(/^🎁 /, "")
    .split(" · ")[0]
    .replace(/ × \d+$/, "")
    .trim();
}

/**
 * สรุปรายการในบิลเป็นข้อความสั้นๆ ไม่ซ้ำ เช่น "Catcha Premium, ขนมแมวเลีย และอีก 1 รายการ"
 * ไม่มีรายการเลยคืน "บริการ" ไว้เป็นค่าเริ่มต้น
 */
export function summarizeInvoiceItems(items: { label: string }[]): string {
  const names = Array.from(new Set(items.map((it) => shortItemLabel(it.label)))).filter(
    Boolean
  );
  if (!names.length) return "บริการ";
  return names.length > 2
    ? `${names.slice(0, 2).join(", ")} และอีก ${names.length - 2} รายการ`
    : names.join(", ");
}
