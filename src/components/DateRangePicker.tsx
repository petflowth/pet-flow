"use client";

import { RANGE_OPTIONS, type RangeId } from "@/lib/date-range";

/** แถบเลือกช่วงเวลา — ใช้ร่วมกันทั้งแดชบอร์ด บัญชี และหน้าสรุปข้อมูล */
export function DateRangePicker({
  value,
  onChange,
  custom,
  onCustomChange,
  className = "",
}: {
  value: RangeId;
  onChange: (id: RangeId) => void;
  custom: { from: string; to: string };
  onCustomChange: (next: { from: string; to: string }) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {RANGE_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
              value === o.id
                ? "bg-latte-deep text-white"
                : "bg-paper text-brown-soft hover:bg-honey/20"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={custom.from}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
            className="rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-1.5 text-xs"
          />
          <span className="text-xs text-brown-faint">ถึง</span>
          <input
            type="date"
            value={custom.to}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
            className="rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-1.5 text-xs"
          />
        </div>
      )}
    </div>
  );
}
