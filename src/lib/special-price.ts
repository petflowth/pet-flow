/**
 * ราคาพิเศษรายลูกค้า
 * ---------------------
 * ลูกค้าบางคนได้ราคาที่ตกลงกันไว้ ไม่ตรงกับราคากลางของร้าน แต่คนจำได้คือพนักงาน
 * ที่ตกลงด้วยเท่านั้น พอคนละกะมาออกบิลก็คิดราคาปกติ ลูกค้าต้องมาทวงเอง
 *
 * ที่นี่ไม่เก็บตารางราคาพิเศษแยกอีกชุด — อ่านย้อนจากบิลเก่าของลูกค้าคนนั้นแทน
 * บิลทุกใบเก็บ unitAmount (ราคาต่อหน่วยที่คิดจริง) ไว้อยู่แล้ว ราคาที่เคยให้ไป
 * จึงเป็นข้อมูลที่มีอยู่แล้ว ไม่ต้องเพิ่มคอลัมน์ ไม่ต้องให้ใครมานั่งกรอกซ้ำ และ
 * ไม่มีทางขัดกับบิลจริง เพราะมันคือบิลจริง
 */

export type PastInvoice = {
  customerId?: string;
  createdAt?: string;
  items?: {
    label: string;
    kind?: string;
    qty?: number;
    unitAmount?: number;
    amount: number;
  }[];
};

/**
 * ตัดส่วนที่เปลี่ยนไปทุกใบออกจากชื่อรายการ ให้เหลือ "สิ่งที่ซื้อ" ล้วนๆ
 * — ตัดชื่อน้องข้างหน้า (🐱 มะลิ · ) เพราะราคาพิเศษให้ทั้งบ้าน ไม่ได้ให้เป็นตัวๆ
 * — ตัดจำนวนท้ายชื่อ (× 3 / × 2 คืน) เพราะเทียบกันที่ราคาต่อหน่วย
 */
export function priceSignature(label: string): string {
  return label
    .replace(/^🐱[^·]*·\s*/u, "")
    .replace(/\s*×\s*\d+(\s*คืน)?\s*$/u, "")
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type SpecialPriceHit = {
  unitAmount: number;
  /** วันที่ของบิลใบที่ใช้ราคานี้ — ไว้บอกพนักงานว่า "เคยได้เมื่อไหร่" */
  when?: string;
};

/**
 * ราคาต่อหน่วยที่ลูกค้าคนนี้เคยจ่ายจริงสำหรับรายการเดียวกัน (เอาใบล่าสุด)
 * คืน null เมื่อไม่เคยซื้อรายการนี้ — ของแถมไม่นับ ราคา 0 ไม่ใช่ "ราคาพิเศษ"
 */
export function findLastPrice(
  invoices: PastInvoice[],
  customerId: string,
  signature: string
): SpecialPriceHit | null {
  if (!customerId || !signature) return null;

  const mine = invoices
    .filter((i) => i.customerId === customerId)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  for (const inv of mine) {
    for (const it of inv.items || []) {
      if (it.kind === "freebie") continue;
      if (priceSignature(it.label) !== signature) continue;
      // บิลเก่าบางใบยังไม่มี unitAmount — ถอยไปหารเอาจากยอดรวม เมื่อรู้จำนวน
      const unit =
        typeof it.unitAmount === "number"
          ? it.unitAmount
          : it.qty && it.qty > 0
            ? Math.round(it.amount / it.qty)
            : it.amount;
      if (!unit || unit <= 0) continue;
      return { unitAmount: unit, when: inv.createdAt };
    }
  }
  return null;
}
