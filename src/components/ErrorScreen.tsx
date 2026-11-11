"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, reloadOnce } from "@/lib/app-health";

/**
 * หน้าที่แสดงแทนจอขาว "Application error" เวลาหน้าพัง — ถ้าเป็นเพราะระบบเพิ่งอัปเดต
 * (ไฟล์โค้ดรุ่นเก่าหาย) โหลดหน้าใหม่ให้เองเลย ไม่งั้นมีปุ่ม "ลองอีกครั้ง" / "โหลดหน้าใหม่"
 */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    console.error(error);
    if (isChunkLoadError(error) && reloadOnce()) setReloading(true);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-lg">
        <p className="text-3xl">🐾</p>
        <p className="mt-2 text-base font-bold text-[#4a3426]">
          {reloading ? "กำลังโหลดเวอร์ชันล่าสุด…" : "หน้านี้สะดุดนิดหน่อย"}
        </p>
        {!reloading && (
          <>
            <p className="mt-1 text-sm text-[#7a6455]">ข้อมูลที่บันทึกไปแล้วไม่หาย กดลองอีกครั้งได้เลย</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-xl bg-[#b07a52] py-2.5 text-sm font-bold text-white"
              >
                ลองอีกครั้ง
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-[#d9c6b5] py-2.5 text-sm font-bold text-[#4a3426]"
              >
                🔄 โหลดหน้าใหม่
              </button>
            </div>
            {error.digest && <p className="mt-3 text-[10px] text-[#a8968a]">รหัส: {error.digest}</p>}
          </>
        )}
      </div>
    </div>
  );
}
