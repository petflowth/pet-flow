"use client";

import { useEffect, useRef, useState } from "react";
import {
  TEXT_SIZE_KEY,
  TEXT_SIZES,
  applyTextSize,
  readTextSize,
} from "@/lib/text-size";

/**
 * ปุ่ม "ก" ปรับขนาดตัวอักษร — แตะแล้วมีให้เลือก เล็ก / ปกติ / ใหญ่ / ใหญ่มาก
 * จำไว้ในเครื่องนี้ (แต่ละเครื่อง/แต่ละคนตั้งเองได้)
 */
export function TextSizeSwitch({
  locale = "th",
  className = "",
}: {
  locale?: "th" | "en";
  className?: string;
}) {
  const [size, setSize] = useState(1);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSize(readTextSize());
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const choose = (v: number) => {
    setSize(v);
    applyTextSize(v);
    try {
      if (v === 1) localStorage.removeItem(TEXT_SIZE_KEY);
      else localStorage.setItem(TEXT_SIZE_KEY, String(v));
    } catch {}
    setOpen(false);
  };

  const th = locale === "th";
  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={th ? "ปรับขนาดตัวอักษร" : "Text size"}
        className="flex h-10 min-w-[44px] items-center justify-center gap-0.5 rounded-full border border-petflow-line bg-card px-2.5 font-extrabold text-petflow-chocolate shadow-petflow-sm transition active:scale-95"
      >
        <span className="text-[12px] leading-none">ก</span>
        <span className="text-[17px] leading-none">ก</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[70] mt-2 w-[236px] rounded-petflow border border-petflow-line bg-card p-2 shadow-petflow"
        >
          <p className="px-2 pb-1.5 pt-1 text-[12px] font-bold text-brown-soft">
            {th ? "ขนาดตัวอักษร" : "Text size"}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {TEXT_SIZES.map((s) => {
              const active = s.value === size;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => choose(s.value)}
                  className={`flex flex-col items-center justify-end gap-1 rounded-petflow-sm px-1 pb-1.5 pt-2 transition ${
                    active
                      ? "bg-petflow-chocolate text-card"
                      : "bg-paper text-petflow-chocolate hover:bg-honey/30"
                  }`}
                >
                  <span className="font-extrabold leading-none" style={{ fontSize: 15 * s.value + (s.value - 1) * 20 }}>
                    ก
                  </span>
                  <span className="whitespace-nowrap text-[10px] font-bold leading-none">{th ? s.th : s.en}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** ใส่ใน layout ของ /admin และ /app — ใช้ขนาดที่เลือกไว้ และคืนค่าปกติเมื่อออกไปหน้าอื่น (เช่นใบเสร็จ) */
export function TextSizeScope() {
  useEffect(() => {
    applyTextSize(readTextSize());
    return () => applyTextSize(1);
  }, []);
  return null;
}
