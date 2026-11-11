/**
 * หลายสาขาในร้านเดียว (ใช้ LINE OA / ลิงก์ / ลูกค้าชุดเดียวกัน)
 *
 * ใช้ร่วมกันทุกสาขา: ลูกค้า น้อง เครดิต แต้ม คอร์ส คูปอง ราคา และการตั้งค่าอื่น ๆ
 * แยกตามสาขา: ห้องพัก นัด (คิวอาบน้ำ/ห้องพัก) บิล ขายหน้าร้าน รายรับรายจ่าย
 *
 * ร้านที่ยังไม่ตั้งสาขา หรือมีสาขาเดียว = ทำงานเหมือนเดิมทุกอย่าง (ไม่มีปุ่มเลือกสาขาให้เห็น)
 * ข้อมูลที่ยังไม่มีสาขา (ของเก่าทั้งหมด) หรือชี้ไปสาขาที่ถูกลบแล้ว = นับเป็นสาขาแรกเสมอ
 *
 * ไฟล์นี้ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์ — ห้าม import ของฝั่งเซิร์ฟเวอร์
 */

export type Branch = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  /** ลิงก์ Google Maps ของสาขา */
  mapsUrl?: string;
  /**
   * ค่าที่สาขานี้ตั้งเองต่างจากค่ากลางของร้าน (เฉพาะหัวข้อใน BRANCH_OVERRIDE_KEYS)
   * หัวข้อไหนไม่ได้ตั้ง = ใช้ค่ากลางของร้าน
   */
  overrides?: Record<string, unknown>;
};

/** หัวข้อตั้งค่าที่แต่ละสาขาตั้งต่างกันได้: รอบคิว จำนวนรับ วันหยุด และราคาอาบน้ำ/นวด */
export const BRANCH_OVERRIDE_KEYS = [
  "groomSlots",
  "groomSlotCapacity",
  "groomSlotDefaultCapacity",
  "groomDuration",
  "massageSlots",
  "massageSlotCapacity",
  "closedWeekdays",
  "closedDates",
  "groomPricePrograms",
] as const;
export type BranchOverrideKey = (typeof BRANCH_OVERRIDE_KEYS)[number];

/** คุกกี้จำว่าหลังบ้านกำลังดูสาขาไหน (ค่า = id สาขา · ไม่มีคุกกี้ = ดูทุกสาขา) */
export const BRANCH_COOKIE = "pf_branch";

type WithBranches = { branches?: Branch[] | null; branchLimit?: number | null };
type WithRooms = { rooms?: { id: string; name: string; branchId?: string }[] | null };

export function shopBranches(config: WithBranches | null | undefined): Branch[] {
  const list = (config?.branches || []).filter((b) => b && b.id && String(b.name || "").trim());
  // หลายสาขาเป็นฟังก์ชันจ่ายเพิ่ม — แพ็กเกจให้กี่สาขาก็ใช้ได้เท่านั้น (สาขาที่เกินยังเก็บไว้ ไม่ลบ จ่ายแล้วกลับมาเอง)
  const limit = config?.branchLimit;
  return typeof limit === "number" && limit > 0 ? list.slice(0, limit) : list;
}

/** จำนวนสาขาที่แพ็กเกจของร้านใช้ได้ (ไม่รู้ = ไม่จำกัด) */
export function branchLimitOf(config: WithBranches | null | undefined): number {
  const limit = config?.branchLimit;
  return typeof limit === "number" && limit > 0 ? limit : Infinity;
}

/** มีตั้งแต่ 2 สาขาขึ้นไป — ถึงจะโชว์ปุ่มเลือกสาขา/ช่องเลือกสาขาต่าง ๆ */
export function isMultiBranch(config: WithBranches | null | undefined): boolean {
  return shopBranches(config).length >= 2;
}

export function mainBranchId(config: WithBranches | null | undefined): string {
  return shopBranches(config)[0]?.id || "";
}

/** id สาขาที่มีอยู่จริงในร้าน — ไม่มี/ถูกลบแล้ว = undefined */
export function knownBranchId(config: WithBranches | null | undefined, id?: string | null): string | undefined {
  if (!id) return undefined;
  return shopBranches(config).some((b) => b.id === id) ? id : undefined;
}

export function branchById(config: WithBranches | null | undefined, id?: string | null): Branch | undefined {
  return shopBranches(config).find((b) => b.id === id);
}

/** ห้อง (id หรือชื่อห้องที่เก็บไว้ในนัด) อยู่สาขาไหน — ห้องที่ยังไม่เลือกสาขา = สาขาแรก */
export function roomBranchId(config: WithBranches & WithRooms, room?: string | null): string | undefined {
  const key = String(room || "").trim();
  if (!key || !isMultiBranch(config)) return undefined;
  const r = (config.rooms || []).find((x) => x.id === key || x.name === key);
  if (!r) return undefined;
  return knownBranchId(config, r.branchId) || mainBranchId(config);
}

/**
 * นัดนี้เป็นของสาขาไหน
 * ห้องพัก: ยึดสาขาของห้องเป็นหลัก (ย้ายห้องไปสาขาอื่นในตั้งค่า นัดของห้องนั้นตามไปด้วย)
 * อาบน้ำ/นวด: ตามสาขาที่บันทึกไว้ตอนจอง
 */
export function bookingBranchId(
  config: WithBranches & WithRooms,
  b: { branchId?: string | null; room?: string | null; service?: string | null }
): string {
  const fromRoom = b.service === "room" ? roomBranchId(config, b.room) : undefined;
  return fromRoom || knownBranchId(config, b.branchId) || mainBranchId(config);
}

/** สาขาของบิล/รายการเงิน/บิลขาย: ตามที่บันทึกไว้ ไม่มี = สาขาแรก */
export function recordBranchId(config: WithBranches, branchId?: string | null): string {
  return knownBranchId(config, branchId) || mainBranchId(config);
}

/** ห้องของสาขานี้ (branchId ว่าง = ทุกสาขา) */
export function roomsOfBranch<T extends { id: string; branchId?: string }>(
  config: WithBranches,
  rooms: T[],
  branchId: string | null | undefined
): T[] {
  if (!branchId || !isMultiBranch(config)) return rooms;
  const main = mainBranchId(config);
  return rooms.filter((r) => (knownBranchId(config, r.branchId) || main) === branchId);
}

/**
 * ค่าตั้งร้านในมุมของสาขานี้ — เอาค่าที่สาขาตั้งเองทับค่ากลาง
 * ไม่ระบุสาขา / ร้านสาขาเดียว / สาขาไม่ได้ตั้งอะไรเอง = ได้ค่ากลางเหมือนเดิม
 */
export function configForBranch<T extends WithBranches>(config: T, branchId?: string | null): T {
  if (!branchId || !isMultiBranch(config)) return config;
  const o = branchById(config, branchId)?.overrides;
  if (!o) return config;
  const out = { ...config } as Record<string, unknown>;
  for (const k of BRANCH_OVERRIDE_KEYS) if (o[k] !== undefined && o[k] !== null) out[k] = o[k];
  return out as T;
}

/** สาขานี้ตั้งค่าหัวข้อเหล่านี้เองอยู่ไหม */
export function branchHasOverride(
  config: WithBranches,
  branchId: string | null | undefined,
  keys: readonly BranchOverrideKey[] = BRANCH_OVERRIDE_KEYS
): boolean {
  const o = branchById(config, branchId)?.overrides;
  return !!o && keys.some((k) => o[k] !== undefined && o[k] !== null);
}

/**
 * แปลงค่าที่จะบันทึก ให้ลงเป็น "ค่าของสาขานี้" — หัวข้อที่แยกสาขาได้ไปเก็บในสาขา ที่เหลือบันทึกเป็นค่ากลางตามเดิม
 * ไม่ระบุสาขา = บันทึกเป็นค่ากลางทั้งหมด
 */
export function patchForBranch<P extends Record<string, unknown>>(
  config: WithBranches,
  branchId: string | null | undefined,
  patch: P
): Record<string, unknown> {
  if (!branchId || !branchById(config, branchId)) return patch;
  const own: Record<string, unknown> = {};
  const shared: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if ((BRANCH_OVERRIDE_KEYS as readonly string[]).includes(k)) own[k] = v;
    else shared[k] = v;
  }
  if (Object.keys(own).length === 0) return shared;
  return {
    ...shared,
    branches: (config.branches || []).map((b) =>
      b.id === branchId ? { ...b, overrides: { ...(b.overrides || {}), ...own } } : b
    ),
  };
}

/** ล้างค่าที่สาขาตั้งเอง (กลับไปใช้ค่ากลาง) เฉพาะหัวข้อที่ระบุ */
export function clearBranchOverrides(
  config: WithBranches,
  branchId: string,
  keys: readonly BranchOverrideKey[]
): { branches: Branch[] } {
  return {
    branches: (config.branches || []).map((b) => {
      if (b.id !== branchId || !b.overrides) return b;
      const o = { ...b.overrides };
      for (const k of keys) delete o[k];
      return { ...b, overrides: Object.keys(o).length ? o : undefined };
    }),
  };
}

export function newBranchId(): string {
  return `br-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** ฝั่งเบราว์เซอร์: สาขาที่หลังบ้านกำลังดูอยู่ (ไม่มี = ทุกสาขา) */
export function readBranchCookie(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${BRANCH_COOKIE}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** ฝั่งเบราว์เซอร์: เลือกสาขาที่จะดูในหลังบ้าน ("" = ทุกสาขา) */
export function writeBranchCookie(id: string) {
  if (typeof document === "undefined") return;
  document.cookie = id
    ? `${BRANCH_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    : `${BRANCH_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * ฝั่งเบราว์เซอร์ (หลังบ้าน): ห้องของสาขาที่กำลังเลือกดูอยู่ — ใช้กับผังห้อง/ฟอร์มจอง/เช็คลิสต์
 * หน้าที่ต้องเห็นห้องครบทุกสาขา (ตั้งค่า ประวัติลูกค้า บิล) ไม่ต้องเรียกตัวนี้
 */
/**
 * สาขาที่พนักงานคนนี้เห็นได้ — คืน null = ไม่จำกัด (เห็นทุกสาขา)
 * ไม่ตั้ง / สาขาที่ตั้งไว้ถูกลบหมดแล้ว / ติ๊กครบทุกสาขา = ไม่จำกัด
 */
export function staffBranchIds(config: WithBranches | null | undefined, branches?: string[] | null): string[] | null {
  if (!isMultiBranch(config)) return null;
  const all = shopBranches(config).map((b) => b.id);
  const mine = all.filter((id) => (branches || []).includes(id));
  return mine.length === 0 || mine.length === all.length ? null : mine;
}

/** ที่เก็บในเบราว์เซอร์: สาขาที่พนักงานคนที่ล็อกอินอยู่เห็นได้ (หลังบ้านตั้งให้ตอนเช็คล็อกอิน) */
export const STAFF_BRANCHES_KEY = "petflow-branches";

/** ฝั่งเบราว์เซอร์ (หลังบ้าน): สาขาที่คนที่ล็อกอินอยู่เลือกได้ — เจ้าของ/ไม่จำกัด = ทุกสาขา */
export function branchesForUser(config: WithBranches | null | undefined): Branch[] {
  const all = shopBranches(config);
  if (typeof window === "undefined") return all;
  let mine: string[] = [];
  try {
    mine = JSON.parse(sessionStorage.getItem(STAFF_BRANCHES_KEY) || "[]");
  } catch {
    /* ค่าเสีย = ไม่จำกัด */
  }
  const allowed = staffBranchIds(config, Array.isArray(mine) ? mine : []);
  return allowed ? all.filter((b) => allowed.includes(b.id)) : all;
}

/** ฝั่งเบราว์เซอร์ (หลังบ้าน): ค่าตั้งร้านของสาขาที่กำลังเลือกดูอยู่ (ดูทุกสาขา = ค่ากลาง) */
export function configInView<T extends WithBranches>(config: T): T {
  return configForBranch(config, knownBranchId(config, readBranchCookie()));
}

export function roomsInView<T extends { id: string; branchId?: string }>(config: WithBranches, rooms: T[]): T[] {
  return roomsOfBranch(config, rooms, knownBranchId(config, readBranchCookie()));
}
