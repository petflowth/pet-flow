/**
 * ตัวช่วยกู้หน้าเว็บเองเมื่อ "ค้าง/เอ๋อ" — ใช้ร่วมกันระหว่าง AppHealth กับหน้า error ของ Next
 */

/** ไฟล์โค้ดของหน้าโหลดไม่ขึ้น — มักเกิดเพราะระบบเพิ่งอัปเดต แล้วหน้าที่เปิดค้างไว้ยังเป็นรุ่นเก่า */
export function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null | undefined;
  const text = `${e?.name || ""} ${e?.message || (typeof err === "string" ? err : "")}`;
  return /ChunkLoadError|Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    text
  );
}

const RELOAD_KEY = "petflow-auto-reload-at";

/**
 * โหลดหน้าใหม่ แต่ไม่เกินครั้งละ 30 วินาที — กันวนโหลดไม่หยุดถ้าปัญหาไม่ได้หายเพราะการโหลดใหม่
 * คืนค่า false ถ้าเพิ่งโหลดไปแล้ว (ให้หน้าจอบอกผู้ใช้แทน)
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* sessionStorage ใช้ไม่ได้ (โหมดส่วนตัวบางเครื่อง) — โหลดเลย */
  }
  window.location.reload();
  return true;
}
