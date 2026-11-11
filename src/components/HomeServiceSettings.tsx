"use client";

import { useState } from "react";
import type { HomeServiceConfig, HomeServiceZone, SiteConfig } from "@/lib/config-types";
import { Icon } from "@/components/Icon";
import { NumInput } from "@/components/NumInput";
import { isFeatureOn } from "@/lib/features";
import {
  HOME_FEE_DEFAULT_LABEL,
  HOME_SERVICE_DEFAULT_LABEL,
  newHomeZoneId,
} from "@/lib/home-service";

const box = "rounded-petflow border border-petflow-line bg-card p-4";
const input =
  "min-w-0 w-full rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2 text-xs font-bold text-brown";

/**
 * ตั้งค่า › บริการนอกสถานที่ — ร้านตั้งเองทุกอย่าง: ชื่อบริการ เงื่อนไข โซน+ค่าเดินทาง รอบเวลา จำนวนทีม
 * (ร้านหลายสาขา: หน้านี้อยู่ใต้แถบเลือกสาขา บันทึกตอนเลือกสาขา = ค่าของสาขานั้น)
 */
export function HomeServiceSettings({
  config,
  saving,
  onSave,
  onOpenFeatures,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (patch: Partial<SiteConfig>) => void;
  onOpenFeatures?: () => void;
}) {
  const hs: HomeServiceConfig = config.homeService || {};
  const [label, setLabel] = useState(hs.label || "");
  const [note, setNote] = useState(hs.note || "");
  const [feeLabel, setFeeLabel] = useState(hs.feeLabel || "");
  const [fee, setFee] = useState<number | string>(hs.fee ?? "");
  const [zones, setZones] = useState<HomeServiceZone[]>(hs.zones || []);
  const [slots, setSlots] = useState((hs.slots || []).join(", "));
  const [capacity, setCapacity] = useState<number | string>(hs.capacity ?? 1);
  const [massage, setMassage] = useState(hs.massage !== false);
  const on = isFeatureOn(config, "homeService");
  const massageOn = isFeatureOn(config, "massage");

  const setZone = (i: number, patch: Partial<HomeServiceZone>) =>
    setZones((cur) => cur.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));

  const save = () =>
    onSave({
      homeService: {
        label: label.trim(),
        note: note.trim(),
        feeLabel: feeLabel.trim(),
        fee: Math.max(0, Math.round(Number(fee) || 0)),
        zones: zones
          .map((z) => ({ id: z.id, name: z.name.trim(), fee: Math.max(0, Math.round(Number(z.fee) || 0)) }))
          .filter((z) => z.name),
        slots: [
          ...new Set(
            slots
              .split(/[,\s]+/)
              .map((t) => t.trim())
              .filter((t) => /^\d{1,2}:\d{2}$/.test(t))
              .map((t) => t.padStart(5, "0"))
          ),
        ].sort(),
        capacity: Math.max(1, Math.round(Number(capacity) || 1)),
        massage,
      },
    });

  return (
    <div className="space-y-4">
      <p className="text-xs text-brown-soft">
        ร้านที่มีช่างออกไปอาบน้ำ/นวดให้ที่บ้านลูกค้า — ลูกค้าเลือก “ที่บ้าน” ตอนจองในแอป กรอกที่อยู่และเลือกโซน
        คิวแยกจากหน้าร้าน (นับเป็นบ้านต่อรอบ) ออกบิลแล้วเติมค่าเดินทางให้เอง
      </p>
      {!on && (
        <div className="rounded-petflow-sm bg-wait/10 px-3 py-2.5 text-xs font-bold text-wait">
          ยังปิดอยู่ — ลูกค้ายังไม่เห็นตัวเลือกนี้ · เปิดที่ เปิด/ปิดฟีเจอร์ › บริการนอกสถานที่
          {onOpenFeatures && (
            <button type="button" onClick={onOpenFeatures} className="ml-2 underline">
              ไปเปิด
            </button>
          )}
        </div>
      )}

      <div className={box}>
        <p className="text-xs font-extrabold text-petflow-chocolate">🏠 ชื่อบริการและเงื่อนไข</p>
        <label className="mt-2 block text-[10px] font-bold text-brown-soft">
          ชื่อที่ลูกค้าเห็น
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={HOME_SERVICE_DEFAULT_LABEL} className={`mt-1 ${input}`} />
        </label>
        <label className="mt-2 block text-[10px] font-bold text-brown-soft">
          เงื่อนไข / พื้นที่ให้บริการ (ลูกค้าเห็นตอนเลือก “ที่บ้าน”)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="เช่น ให้บริการในเขตอำเภอเมือง · ต้องมีก๊อกน้ำและปลั๊กไฟ · ช่างไปถึงก่อนเวลานัด 10 นาที"
            className={`mt-1 ${input}`}
          />
        </label>
      </div>

      <div className={box}>
        <p className="text-xs font-extrabold text-petflow-chocolate">🚗 ค่าเดินทาง</p>
        <p className="mb-2 mt-0.5 text-[10px] text-brown-faint">
          คิดต่อบ้านต่อครั้ง (ไม่ใช่ต่อตัว) · แยกโซนตามระยะทางได้ ลูกค้าเลือกโซนเอง · ไม่แยกโซน = ใช้ราคาเดียว
        </p>
        <label className="block text-[10px] font-bold text-brown-soft">
          ชื่อรายการในบิล
          <input value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} placeholder={HOME_FEE_DEFAULT_LABEL} className={`mt-1 ${input}`} />
        </label>
        {zones.length === 0 && (
          <label className="mt-2 block text-[10px] font-bold text-brown-soft">
            ค่าเดินทาง (บาท)
            <NumInput min={0} value={fee} onChange={(e) => setFee(e.target.value)} className={`mt-1 ${input}`} />
          </label>
        )}
        <div className="mt-3 space-y-2">
          {zones.map((z, i) => (
            <div key={z.id} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
              <input
                value={z.name}
                onChange={(e) => setZone(i, { name: e.target.value })}
                placeholder="ชื่อโซน เช่น ในเมือง (ไม่เกิน 5 กม.)"
                className={input}
              />
              <NumInput
                min={0}
                value={z.fee}
                onChange={(e) => setZone(i, { fee: Number(e.target.value) || 0 })}
                placeholder="บาท"
                className={input}
              />
              <button
                type="button"
                aria-label="ลบโซน"
                onClick={() => setZones((cur) => cur.filter((_, idx) => idx !== i))}
                className="flex h-9 w-9 items-center justify-center rounded-full text-wait ring-1 ring-petflow-line"
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setZones((cur) => [...cur, { id: newHomeZoneId(), name: "", fee: 0 }])}
            className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-brown ring-1 ring-petflow-line"
          >
            <Icon name="plus" size={13} />
            เพิ่มโซน
          </button>
        </div>
      </div>

      <div className={box}>
        <p className="text-xs font-extrabold text-petflow-chocolate">🕒 รอบเวลาและจำนวนทีม</p>
        <p className="mb-2 mt-0.5 text-[10px] text-brown-faint">
          คิวแยกจากหน้าร้าน · ใส่เวลาคั่นด้วยจุลภาค เช่น 09:00, 13:00, 16:00 · เว้นว่าง = ใช้รอบเดียวกับอาบน้ำหน้าร้าน
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
          <input
            value={slots}
            onChange={(e) => setSlots(e.target.value)}
            placeholder={(config.groomSlots || []).join(", ")}
            className={input}
          />
          <label className="text-[10px] font-bold text-brown-soft">
            ออกได้พร้อมกันต่อรอบ (บ้าน)
            <NumInput min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className={`mt-1 ${input}`} />
          </label>
        </div>
        {massageOn && (
          <label className="mt-3 flex items-center gap-2 text-xs font-bold text-brown">
            <input type="checkbox" checked={massage} onChange={(e) => setMassage(e.target.checked)} />
            ให้จองนวดที่บ้านได้ด้วย
          </label>
        )}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={save}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-petflow-chocolate text-sm font-extrabold text-card shadow-petflow-sm disabled:opacity-50"
      >
        <Icon name="check" size={18} strokeWidth={2.2} />
        {saving ? "กำลังบันทึก…" : "บันทึกบริการนอกสถานที่"}
      </button>
    </div>
  );
}
