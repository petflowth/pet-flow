"use client";

import { useLiff } from "@/components/LiffProvider";

/** โผล่ทับทุกหน้าถ้าล็อกอิน LINE ค้างนานผิดปกติ — กันลูกค้าเห็นแอปว่างเปล่าไม่รู้ต้องทำอะไร */
export function LiffStuckBanner() {
  const { ready, error } = useLiff();
  if (ready || !error) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-lg p-3">
      <div className="rounded-catcha border-2 border-honey/60 bg-card p-4 text-center shadow-catcha">
        <p className="text-sm font-bold text-brown">😿 {error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 w-full rounded-catcha-sm bg-latte-deep py-2.5 text-sm font-extrabold text-white"
        >
          🔄 โหลดใหม่
        </button>
      </div>
    </div>
  );
}
