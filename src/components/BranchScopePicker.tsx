"use client";

import { useConfig } from "@/components/ConfigProvider";
import { isMultiBranch, shopBranches } from "@/lib/branches";

/**
 * ร้านหลายสาขา: เลือกว่าคอร์ส / โปร / แพ็กเกจนี้ ใช้ได้ทุกสาขาหรือเฉพาะบางสาขา
 * value ว่าง = ทุกสาขา · ร้านสาขาเดียวไม่แสดงอะไรเลย
 */
export function BranchScopePicker({
  value,
  onChange,
  label = "ใช้ได้ที่สาขา",
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  label?: string;
}) {
  const { config } = useConfig();
  if (!isMultiBranch(config)) return null;
  const branches = shopBranches(config);
  const all = value.length === 0;
  const chip = (on: boolean) =>
    `inline-flex min-h-[40px] items-center rounded-full border px-3.5 text-xs font-bold transition ${
      on ? "border-petflow-chocolate bg-petflow-chocolate text-white" : "border-petflow-line bg-card text-brown"
    }`;
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    // ติ๊กครบทุกสาขา = ทุกสาขา
    onChange(next.length === branches.length ? [] : next);
  };
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold text-brown-soft">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={all} onClick={() => onChange([])} className={chip(all)}>
          ทุกสาขา
        </button>
        {branches.map((b) => (
          <button
            key={b.id}
            type="button"
            aria-pressed={value.includes(b.id)}
            onClick={() => toggle(b.id)}
            className={chip(value.includes(b.id))}
          >
            {b.name}
          </button>
        ))}
      </div>
    </div>
  );
}
