/**
 * ขนาดตัวอักษรของแอป (ปรับเองได้ต่อเครื่อง) — เจ้าของร้าน/ลูกค้าหลายคนอายุเยอะ อยากได้ตัวใหญ่
 *
 * ทั้งแอปใช้ขนาดเป็น px (text-[13px] ฯลฯ) เยอะมาก การเปลี่ยน root font-size จึงไม่พอ
 * เลยใช้ CSS zoom ที่ <html> แทน — ขยายทุกอย่างพร้อมกัน (ตัวอักษร ไอคอน ปุ่ม) แล้วจัดหน้าใหม่ให้พอดีจอ
 * เหมือนกดซูมในเบราว์เซอร์ แต่จำค่าไว้ในเครื่อง (localStorage) ไม่ต้องตั้งใหม่ทุกครั้ง
 *
 * ใช้เฉพาะหน้าหลังบ้าน (/admin) และแอปลูกค้า (/app) — หน้าเอกสาร/ใบเสร็จ/หน้าเว็บขายของไม่โดน
 */
export const TEXT_SIZE_KEY = "pf_text_size";

export const TEXT_SIZES = [
  { value: 0.9, th: "เล็ก", en: "Small" },
  { value: 1, th: "ปกติ", en: "Normal" },
  { value: 1.15, th: "ใหญ่", en: "Large" },
  { value: 1.3, th: "ใหญ่มาก", en: "Extra large" },
] as const;

/** path ที่ใช้ขนาดตัวอักษรที่เลือก (รองรับ /s/<slug>/ ข้างหน้า) */
export const TEXT_SIZE_PATH_RE = /^(\/s\/[^/]+)?\/(admin|app|salon)(\/|$)/;

export function readTextSize(): number {
  try {
    const v = Number(localStorage.getItem(TEXT_SIZE_KEY));
    return TEXT_SIZES.some((s) => s.value === v) ? v : 1;
  } catch {
    return 1;
  }
}

export function applyTextSize(v: number) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  if (v === 1) el.style.removeProperty("--pf-zoom");
  else el.style.setProperty("--pf-zoom", String(v));
}

/** สคริปต์สั้น ๆ ใส่ใน <head> ให้ขยายก่อนหน้าแสดง ไม่กระพริบจากเล็กเป็นใหญ่ */
export const TEXT_SIZE_BOOT_SCRIPT = `try{if(${TEXT_SIZE_PATH_RE}.test(location.pathname)){var z=Number(localStorage.getItem(${JSON.stringify(
  TEXT_SIZE_KEY,
)}));if([${TEXT_SIZES.map((s) => s.value).join(",")}].indexOf(z)>-1&&z!==1)document.documentElement.style.setProperty("--pf-zoom",String(z))}}catch(e){}`;
