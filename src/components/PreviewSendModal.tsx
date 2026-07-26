"use client";

import { FlexPreviewStack } from "@/components/FlexPreview";

/** พรีวิวการ์ดก่อนส่งจริง — ใช้ร่วมกันทั้งปุ่มส่งเดี่ยวและส่งชุดการ์ด */
export function PreviewSendModal({
  messages,
  skipped,
  sending,
  onConfirm,
  onCancel,
}: {
  messages: Record<string, unknown>[];
  skipped?: string[];
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-petflow bg-paper p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-center text-sm font-extrabold text-petflow-chocolate">
          🔍 ตัวอย่างที่ลูกค้าจะได้เห็นใน LINE
        </p>

        <FlexPreviewStack messages={messages} />

        {skipped && skipped.length > 0 && (
          <p className="mt-3 rounded-petflow-sm bg-wait/10 px-3 py-2 text-[11px] font-bold text-wait">
            ⚠️ ข้ามให้: {skipped.join(", ")}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="flex-1 rounded-petflow-sm bg-latte/25 py-2.5 text-sm font-bold text-petflow-chocolate disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="flex-1 rounded-petflow-sm bg-[#06C755] py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {sending ? "กำลังส่ง…" : "✅ ยืนยันส่งจริง"}
          </button>
        </div>
      </div>
    </div>
  );
}
