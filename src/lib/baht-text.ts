/**
 * แปลงจำนวนเงินเป็นตัวอักษรไทย เช่น 1,045 → "หนึ่งพันสี่สิบห้าบาทถ้วน"
 * ใช้บนเอกสารทางการ (ใบสำคัญจ่าย/ใบเสร็จ) — กันแก้ตัวเลขภายหลัง
 */
const NUM = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function readInteger(n: number): string {
  if (n === 0) return "";
  // ตัดเป็นหลักล้าน แล้ววนอ่านทีละกลุ่ม (รองรับเลขใหญ่กว่า 7 หลัก)
  if (n >= 1_000_000) {
    return readInteger(Math.floor(n / 1_000_000)) + "ล้าน" + readInteger(n % 1_000_000);
  }
  let result = "";
  const digits = String(n).split("").map(Number);
  const len = digits.length;
  digits.forEach((d, i) => {
    const pos = len - i - 1; // ตำแหน่งหลัก (หน่วย=0)
    if (d === 0) return;
    if (pos === 0 && d === 1 && len > 1) {
      result += "เอ็ด";
    } else if (pos === 1 && d === 2) {
      result += "ยี่" + POS[1];
    } else if (pos === 1 && d === 1) {
      result += POS[1];
    } else {
      result += NUM[d] + POS[pos];
    }
  });
  return result;
}

export function bahtText(amount: number): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  if (baht === 0 && satang === 0) return "ศูนย์บาทถ้วน";

  let text = "";
  if (baht > 0) text += readInteger(baht) + "บาท";
  if (satang > 0) {
    text += readInteger(satang) + "สตางค์";
  } else if (baht > 0) {
    text += "ถ้วน";
  }
  return text;
}
