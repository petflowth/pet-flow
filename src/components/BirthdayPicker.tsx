"use client";

import { useEffect, useState } from "react";

/**
 * เลือกวันเกิดแบบ dropdown 3 ช่อง (วัน / เดือน / ปี) — ง่ายกว่าปฏิทิน native
 * มาก โดยเฉพาะการเลือกปีย้อนหลัง
 * - เก็บ state ภายในของแต่ละช่อง เพื่อให้เลือก "ทีละช่อง" ได้ (ค่าค้างไว้)
 * - ส่งออก (onChange) เป็น ISO "YYYY-MM-DD" (ค.ศ.) เมื่อเลือกครบทั้ง 3 ช่อง
 *   ถ้ายังไม่ครบจะส่ง "" (ให้ระบบคำนวณอายุ/บันทึกฐานข้อมูลใช้ต่อได้เหมือนเดิม)
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
  const [d, setD] = useState(0);
  const [m, setM] = useState(0);
  const [y, setY] = useState(0);

  // ซิงค์จากค่าภายนอกเฉพาะตอนที่เป็นวันเกิดครบถ้วน (เช่น เติมค่าเดิม/แก้ไข)
  // ไม่รีเซ็ตเป็น 0 ตอน value ว่าง เพื่อไม่ลบสิ่งที่ผู้ใช้กำลังเลือกทีละช่อง
  useEffect(() => {
    if (!value) return;
    const [ys, ms, ds] = value.split("-");
    setY(Number(ys) || 0);
    setM(Number(ms) || 0);
    setD(Number(ds) || 0);
  }, [value]);

  const curYear = new Date().getFullYear();
  const years = Array.from({ length: yearsBack + 1 }, (_, i) => curYear - i);
  const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const commit = (ny: number, nm: number, nd: number) => {
    // ถ้าเปลี่ยนเดือน/ปีแล้ววันเกินจำนวนวันของเดือนนั้น → ปรับวันลงให้พอดี
    const maxDay = ny && nm ? new Date(ny, nm, 0).getDate() : 31;
    const day = nd > maxDay ? maxDay : nd;
    setY(ny);
    setM(nm);
    setD(day);
    if (ny && nm && day) {
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
        onChange={(e) => commit(y, m, Number(e.target.value))}
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
        onChange={(e) => commit(y, Number(e.target.value), d)}
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
        onChange={(e) => commit(Number(e.target.value), m, d)}
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
