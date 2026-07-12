"use client";

/**
 * เลือกวันเกิดแบบ dropdown 3 ช่อง (วัน / เดือน / ปี) — ง่ายกว่าปฏิทิน native
 * มาก โดยเฉพาะการเลือกปีย้อนหลัง
 * - แสดงปีเป็น พ.ศ. แต่ค่าที่ส่งออก (onChange) เป็น ISO "YYYY-MM-DD" (ค.ศ.)
 *   เพื่อให้ระบบคำนวณอายุ/บันทึกฐานข้อมูลใช้ต่อได้เหมือนเดิม
 */

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function BirthdayPicker({
  value,
  onChange,
  yearsBack = 30,
  required = false,
  selectClass,
}: {
  value: string;
  onChange: (iso: string) => void;
  yearsBack?: number;
  required?: boolean;
  selectClass?: string;
}) {
  const [ys, ms, ds] = value ? value.split("-") : ["", "", ""];
  const y = Number(ys) || 0;
  const m = Number(ms) || 0;
  const d = Number(ds) || 0;

  const curYear = new Date().getFullYear();
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => curYear - i);
  const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const emit = (ny: number, nm: number, nd: number) => {
    if (ny && nm && nd) {
      const maxDay = new Date(ny, nm, 0).getDate();
      const day = Math.min(nd, maxDay);
      onChange(`${ny}-${pad(nm)}-${pad(day)}`);
    } else {
      onChange("");
    }
  };

  const cls =
    selectClass ||
    "min-w-0 flex-1 rounded-lg border border-catcha-line bg-paper px-2 py-2 text-sm";

  return (
    <div className="flex gap-2">
      <select
        required={required}
        value={d || ""}
        onChange={(e) => emit(y, m, Number(e.target.value))}
        className={cls}
        aria-label="วันเกิด — วันที่"
      >
        <option value="">วัน</option>
        {days.map((dd) => (
          <option key={dd} value={dd}>
            {dd}
          </option>
        ))}
      </select>
      <select
        required={required}
        value={m || ""}
        onChange={(e) => emit(y, Number(e.target.value), d)}
        className={`${cls} flex-[2]`}
        aria-label="วันเกิด — เดือน"
      >
        <option value="">เดือน</option>
        {THAI_MONTHS.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        required={required}
        value={y || ""}
        onChange={(e) => emit(Number(e.target.value), m, d)}
        className={cls}
        aria-label="วันเกิด — ปี พ.ศ."
      >
        <option value="">ปี พ.ศ.</option>
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy + 543}
          </option>
        ))}
      </select>
    </div>
  );
}
