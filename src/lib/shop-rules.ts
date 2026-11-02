import type { ShopRules } from "./config-types";
import { STAFF_NOTE_TAGS, type StaffNoteTag } from "./staff-note-tags";

/**
 * ค่าระบบที่ร้านปรับเองได้ในหน้าตั้งค่า (config.rules) + ค่าเริ่มต้นเมื่อร้านยังไม่ได้ตั้ง
 * ใช้ได้ทั้งฝั่งหน้าเว็บและเซิร์ฟเวอร์ (ไม่มี import ฝั่งเซิร์ฟเวอร์)
 */
type WithRules = { rules?: ShopRules } | null | undefined;

export const DEFAULT_DAY_CARE_PERCENT = 50;
export const DEFAULT_GROOM_DURATION_MIN = 90;
export const DEFAULT_CLASH_WINDOW_MIN = 60;
export const DEFAULT_GROOM_SIZE_KG = { smallMaxKg: 2, mediumMaxKg: 6 };
export const DEFAULT_ROOM_CLOSURE_REASONS = ["ซ่อมบำรุง", "ใช้งานไม่ได้", "ทำความสะอาดใหญ่", "สำรองไว้"];
/** ร้านแรก (แมว) — ห้องที่แถมทรายเฉพาะพักถึงขั้นต่ำ ใช้เมื่อร้านยังไม่ได้เลือกห้องเอง */
export const DEFAULT_LITTER_MIN_NIGHTS_ROOMS = ["mini-meow", "mid-cozy"];

const pos = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined);

export function dayCarePercent(cfg: WithRules): number {
  const p = cfg?.rules?.dayCarePercent;
  return typeof p === "number" && p >= 0 && p <= 500 ? p : DEFAULT_DAY_CARE_PERCENT;
}

export function groomDurationMin(cfg: WithRules): number {
  return pos(cfg?.rules?.groomDurationMin) ?? DEFAULT_GROOM_DURATION_MIN;
}

export function clashWindowMin(cfg: WithRules): number {
  return pos(cfg?.rules?.groomClashWindowMin) ?? DEFAULT_CLASH_WINDOW_MIN;
}

export function groomSizeKg(cfg: WithRules): { smallMaxKg: number; mediumMaxKg: number } {
  const s = pos(cfg?.rules?.groomSizeKg?.smallMaxKg) ?? DEFAULT_GROOM_SIZE_KG.smallMaxKg;
  const m = pos(cfg?.rules?.groomSizeKg?.mediumMaxKg) ?? DEFAULT_GROOM_SIZE_KG.mediumMaxKg;
  return { smallMaxKg: s, mediumMaxKg: Math.max(m, s) };
}

const cleanList = (v?: string[]) => (v || []).map((x) => String(x).trim()).filter(Boolean);

export function roomClosureReasons(cfg: WithRules): string[] {
  const own = cleanList(cfg?.rules?.roomClosureReasons);
  return own.length ? own : DEFAULT_ROOM_CLOSURE_REASONS;
}

/** แท็กเรื่องที่ช่างต้องรู้ของร้าน — ร้านที่ยังไม่ตั้ง ใช้ชุดเริ่มต้น */
export function staffNoteTags(cfg: WithRules): StaffNoteTag[] {
  const t = cfg?.rules?.staffNoteTags;
  if (!t || (t.medical === undefined && t.behavior === undefined)) return STAFF_NOTE_TAGS;
  return [
    ...cleanList(t.medical).map((label) => ({ id: `m:${label}`, label, category: "medical" as const })),
    ...cleanList(t.behavior).map((label) => ({ id: `b:${label}`, label, category: "behavior" as const })),
  ];
}

export function litterMinNightsRooms(cfg: WithRules): string[] {
  return cfg?.rules?.litterMinNightsRooms ?? DEFAULT_LITTER_MIN_NIGHTS_ROOMS;
}
