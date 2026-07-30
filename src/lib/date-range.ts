/** ช่วงวันที่สำเร็จรูปที่ใช้ร่วมกันทั้งแดชบอร์ด บัญชี และหน้าสรุปข้อมูล */
export type RangeId =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "lastMonth"
  | "year"
  | "all"
  | "custom";

export type DateRange = { from: string; to: string; label: string };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

const shift = (base: string, days: number) => {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return iso(d);
};

export const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: "today", label: "วันนี้" },
  { id: "yesterday", label: "เมื่อวาน" },
  { id: "week", label: "สัปดาห์นี้" },
  { id: "month", label: "เดือนนี้" },
  { id: "lastMonth", label: "เดือนที่แล้ว" },
  { id: "year", label: "ปีนี้" },
  { id: "all", label: "ทั้งหมด" },
  { id: "custom", label: "เลือกวัน" },
];

/**
 * แปลงตัวเลือกช่วงเวลาเป็นวันที่เริ่ม-สิ้นสุด (รวมปลายทั้งสองข้าง)
 * @param today วันนี้แบบ YYYY-MM-DD — รับเข้ามาเพื่อให้เทสต์กำหนดวันเองได้
 * @param custom วันที่ที่เลือกเอง (ใช้เมื่อ id === "custom")
 */
export function resolveRange(id: RangeId, today: string, custom?: { from?: string; to?: string }): DateRange {
  const [y, m] = today.split("-").map(Number);
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const lastDayOf = (yy: number, mm: number) => iso(new Date(yy, mm, 0));

  switch (id) {
    case "yesterday": {
      const d = shift(today, -1);
      return { from: d, to: d, label: "เมื่อวาน" };
    }
    case "week": {
      // สัปดาห์เริ่มวันจันทร์ — ตรงกับที่ร้านคิดรอบงานกัน
      const dow = new Date(`${today}T12:00:00`).getDay(); // 0=อา
      const back = dow === 0 ? 6 : dow - 1;
      return { from: shift(today, -back), to: today, label: "สัปดาห์นี้" };
    }
    case "month":
      return { from: monthStart, to: lastDayOf(y, m), label: "เดือนนี้" };
    case "lastMonth": {
      const pm = m === 1 ? 12 : m - 1;
      const py = m === 1 ? y - 1 : y;
      return {
        from: `${py}-${String(pm).padStart(2, "0")}-01`,
        to: lastDayOf(py, pm),
        label: "เดือนที่แล้ว",
      };
    }
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31`, label: "ปีนี้" };
    case "all":
      return { from: "0000-01-01", to: "9999-12-31", label: "ทั้งหมด" };
    case "custom": {
      const from = custom?.from || today;
      const to = custom?.to || from;
      // เลือกกลับด้าน (สิ้นสุดก่อนเริ่ม) ให้สลับให้เอง ดีกว่าคืนช่วงว่างเปล่า
      const [a, b] = from <= to ? [from, to] : [to, from];
      return { from: a, to: b, label: a === b ? a : `${a} → ${b}` };
    }
    default:
      return { from: today, to: today, label: "วันนี้" };
  }
}

/** อยู่ในช่วงไหม — ใช้กับวันที่แบบ YYYY-MM-DD (หรือ ISO ที่ตัดเอา 10 ตัวแรก) */
export function inRange(date: string | undefined, r: DateRange): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= r.from && d <= r.to;
}
