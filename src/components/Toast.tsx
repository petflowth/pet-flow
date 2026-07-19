"use client";

import { useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; msg: string; kind: ToastKind };

let nextId = 1;
const listeners = new Set<(t: ToastItem) => void>();

/** เรียกจากที่ไหนก็ได้ — แจ้งเตือนมุมจอ ไม่ต้องกดปิด */
export function toast(msg: string, kind: ToastKind = "success") {
  const item = { id: nextId++, msg, kind };
  listeners.forEach((l) => l(item));
}

const STYLE: Record<ToastKind, string> = {
  success: "bg-sage/95 text-white",
  error: "bg-wait/95 text-white",
  info: "bg-petflow-chocolate/95 text-white",
};
const ICON: Record<ToastKind, string> = { success: "✅", error: "⚠️", info: "💬" };

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 3200);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto max-w-md rounded-petflow-sm px-4 py-2.5 text-sm font-bold shadow-petflow ${STYLE[t.kind]}`}
          onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
        >
          {ICON[t.kind]} {t.msg}
        </div>
      ))}
    </div>
  );
}
