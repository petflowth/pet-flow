"use client";

import { useLiff } from "@/components/LiffProvider";

/**
 * โผล่ทับทุกหน้าถ้า LIFF มีปัญหา — ครอบคลุม 2 เคส:
 * 1) ล็อกอิน LINE ค้างนานผิดปกติ (!ready) — กันลูกค้าเห็นแอปว่างเปล่าไม่รู้ต้องทำอะไร
 * 2) LIFF init เสร็จแล้ว (ready) แต่ดึงโปรไฟล์ไม่สำเร็จ (เช่น ลืมติ๊ก Scope "profile" ตอนสร้าง
 *    LIFF app) — จุดนี้เคยไม่โผล่แบนเนอร์เลย เพราะโค้ดเดิมเช็คแค่ !ready ทำให้ทุกหน้าที่ต้องใช้
 *    profile.lineUserId (จองคิวเอง, ผูกบัญชี, แต้มสะสม ฯลฯ) พังเงียบๆ โดยไม่มีคำอธิบาย
 */
export function LiffStuckBanner() {
  const { ready, profile, error } = useLiff();
  if (!error) return null;
  if (ready && profile?.lineUserId) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-lg p-3">
      <div className="rounded-petflow border-2 border-honey/60 bg-card p-4 text-center shadow-petflow">
        <p className="text-sm font-bold text-brown">😿 {error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 w-full rounded-petflow-sm bg-latte-deep py-2.5 text-sm font-extrabold text-white"
        >
          🔄 โหลดใหม่
        </button>
      </div>
    </div>
  );
}
