"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isChunkLoadError, reloadOnce } from "@/lib/app-health";

/**
 * ร้านแจ้งว่า "บางทีระบบเอ๋อ ๆ ต้องรีเฟรช" — สาเหตุที่เจอบ่อยและตัวนี้แก้ให้เอง:
 *
 * 1) คำขอไป /api ค้างไม่จบ (ฐานข้อมูล/Google/เน็ตมือถือค้าง) → ปุ่มหมุนค้างตลอดไป
 *    ตัดเวลาให้: อ่าน 30 วิ, บันทึก/อัปโหลด 2 นาที แล้วหน้าจอแสดง error ให้กดใหม่ได้
 * 2) ระบบอัปเดตระหว่างที่เปิดหน้าค้างไว้ (อัปเดตวันละหลายรอบ) → หน้ารุ่นเก่าโหลดไฟล์ไม่ขึ้น/ทำงานแปลก
 *    เช็ครุ่นกับ /api/version แล้ว: กดลิงก์เมนูถัดไปเป็นการโหลดหน้าใหม่ทั้งหน้า
 *    และกลับมาที่แอปหลังออกไป 1 นาทีขึ้นไป → โหลดหน้าใหม่ให้เอง
 * 3) เปิดแอปค้างไว้นาน (สลับไปแอปอื่น/ล็อกจอ) แล้วกลับมา ข้อมูลเก่า → ออกไปเกิน 20 นาที โหลดใหม่ให้เอง
 * 4) ไฟล์โค้ดของหน้าโหลดไม่ขึ้น (ChunkLoadError) → โหลดหน้าใหม่ให้เองหนึ่งครั้ง
 *
 * ข้อ 2–3 ไม่โหลดใหม่ถ้ามีการพิมพ์/เลือกอะไรในหน้านั้นไว้ (ข้อมูลที่กรอกค้างจะได้ไม่หาย)
 */

const BUILD = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
const AWAY_RELOAD_MS = 20 * 60_000;
const STALE_AWAY_RELOAD_MS = 60_000;
const VERSION_POLL_MS = 5 * 60_000;

/** /api/... หรือ /s/<slug>/api/... ของเว็บเดียวกัน */
function isOwnApi(url: URL) {
  return url.origin === window.location.origin && /^(\/s\/[^/]+)?\/api\//.test(url.pathname);
}

function installFetchTimeout() {
  const w = window as Window & { __petflowFetchPatched?: boolean };
  if (w.__petflowFetchPatched) return;
  w.__petflowFetchPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    // Request object / มี signal ของตัวเองอยู่แล้ว (เช่น adminJson) — ไม่ยุ่ง
    if (input instanceof Request || init?.signal) return original(input, init);
    let url: URL;
    try {
      url = new URL(String(input), window.location.href);
    } catch {
      return original(input, init);
    }
    if (!isOwnApi(url) || url.pathname.endsWith("/api/version")) return original(input, init);
    const method = (init?.method || "GET").toUpperCase();
    const ms = method === "GET" || method === "HEAD" ? 30_000 : 120_000;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    return original(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  };
}

/** เปลี่ยนหน้าแล้ว = ฟอร์มของหน้าก่อนหายไปแล้ว นับใหม่ว่ายังไม่ได้พิมพ์อะไร */
let dirty = false;

export function AppHealth() {
  const pathname = usePathname();
  useEffect(() => {
    dirty = false;
  }, [pathname]);

  useEffect(() => {
    installFetchTimeout();

    let stale = false;
    let pickingFile = false;
    let hiddenAt = 0;
    let lastCheck = 0;

    const checkVersion = async (force = false) => {
      if (BUILD === "dev" || stale) return stale;
      if (!force && Date.now() - lastCheck < 60_000) return stale;
      lastCheck = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();
        if (data?.version && data.version !== "dev" && data.version !== BUILD) stale = true;
      } catch {
        /* เน็ตหลุดชั่วคราว — ไว้เช็ครอบหน้า */
      }
      return stale;
    };

    const onInput = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.matches?.("input, textarea, select, [contenteditable='true']")) dirty = true;
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("input[type='file'], label")) pickingFile = true;
      // มีรุ่นใหม่แล้ว — กดลิงก์ในเว็บ = โหลดหน้าใหม่ทั้งหน้า (ได้โค้ดรุ่นล่าสุด ไม่ค้าง)
      if (!stale || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = t.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      e.preventDefault();
      e.stopPropagation();
      window.location.assign(url.href);
    };
    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = 0;
      // เพิ่งกลับมาจากเลือกรูป/ถ่ายรูป — ห้ามโหลดใหม่ ไม่งั้นรูปที่เลือกหาย
      const fromPicker = pickingFile;
      pickingFile = false;
      if (dirty || fromPicker) return;
      const isStale = await checkVersion(true);
      if (away >= AWAY_RELOAD_MS || (isStale && away >= STALE_AWAY_RELOAD_MS)) reloadOnce();
    };
    const onError = (e: ErrorEvent) => {
      if (isChunkLoadError(e.error || e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkLoadError(e.reason)) reloadOnce();
    };

    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkVersion();
    }, VERSION_POLL_MS);

    return () => {
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearInterval(poll);
    };
  }, []);

  return null;
}
