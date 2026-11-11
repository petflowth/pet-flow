"use client";

import { useConfig } from "@/components/ConfigProvider";
import { asksSpecies, speciesListOf, type PetSpecies } from "@/lib/pet-kind";

/**
 * ปุ่มเลือกชนิดของน้องแต่ละตัว (หมา / แมว / กระต่าย ...) — รายการมาจากชนิดที่ร้านตั้งไว้ (ตั้งค่า › รายการ)
 * โชว์เฉพาะร้านที่รับมากกว่าหนึ่งชนิด (ร้านรับชนิดเดียวไม่ต้องถาม) · สไตล์เดียวกับปุ่มเลือกเพศในหน้าสมัคร
 * ชนิดเยอะ (เกิน 3) ปุ่มขึ้นบรรทัดใหม่ได้ ไม่ล้นจอมือถือ
 */
export function SpeciesPicker({
  value,
  onChange,
  className = "",
}: {
  value?: PetSpecies | "";
  onChange: (v: PetSpecies) => void;
  className?: string;
}) {
  const { config } = useConfig();
  if (!asksSpecies(config)) return null;
  const list = speciesListOf(config);
  const many = list.length > 3;
  return (
    <div
      className={`flex gap-1 bg-paper p-1 ${many ? "flex-wrap rounded-petflow-sm" : "rounded-full"} ${className}`}
      role="radiogroup"
      aria-label="ชนิดของน้อง"
    >
      {list.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          onClick={() => onChange(s.id)}
          className={`min-h-[40px] rounded-full px-3 text-sm font-bold transition ${many ? "grow basis-[30%]" : "flex-1"} ${
            value === s.id ? "bg-card text-petflow-chocolate shadow-petflow-sm" : "text-brown-soft"
          }`}
        >
          {s.emoji} {s.name}
        </button>
      ))}
    </div>
  );
}
