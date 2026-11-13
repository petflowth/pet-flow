"use client";

import { useEffect, useState } from "react";
import { isChunkLoadError, reloadOnce } from "@/lib/app-health";
import { useTr } from "@/components/LocaleProvider";

/**
 * หน้าที่แสดงแทนจอขาว "Application error" เวลาหน้าพัง — ถ้าเป็นเพราะระบบเพิ่งอัปเดต
 * (ไฟล์โค้ดรุ่นเก่าหาย) โหลดหน้าใหม่ให้เองเลย ไม่งั้นมีปุ่ม tr("ลองอีกครั้ง", "Try again") / "โหลดหน้าใหม่"
 */
export function ErrorScreen({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tr = useTr();
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
          {reloading ? tr("กำลังโหลดเวอร์ชันล่าสุด…", "Loading the latest version…") : tr("หน้านี้สะดุดนิดหน่อย", "Something went wrong on this page")}
        </p>
        {!reloading && (
          <>
            <p className="mt-1 text-sm text-[#7a6455]">{tr("ข้อมูลที่บันทึกไปแล้วไม่หาย กดลองอีกครั้งได้เลย", "Anything you saved is safe. Please try again.")}</p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-xl bg-[#b07a52] py-2.5 text-sm font-bold text-white"
              >
                {tr("ลองอีกครั้ง", "Try again")}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl border border-[#d9c6b5] py-2.5 text-sm font-bold text-[#4a3426]"
              >
                {tr("🔄 โหลดหน้าใหม่", "🔄 Reload page")}
              </button>
            </div>
            {error.digest && <p className="mt-3 text-[10px] text-[#a8968a]">{tr("รหัส", "Code")}: {error.digest}</p>}
          </>
        )}
      </div>
    </div>
  );
}
