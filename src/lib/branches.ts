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
};

/** คุกกี้จำว่าหลังบ้านกำลังดูสาขาไหน (ค่า = id สาขา · ไม่มีคุกกี้ = ดูทุกสาขา) */
export const BRANCH_COOKIE = "pf_branch";

type WithBranches = { branches?: Branch[] | null };
type WithRooms = { rooms?: { id: string; name: string; branchId?: string }[] | null };

export function shopBranches(config: WithBranches | null | undefined): Branch[] {
  return (config?.branches || []).filter((b) => b && b.id && String(b.name || "").trim());
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
export function roomsInView<T extends { id: string; branchId?: string }>(config: WithBranches, rooms: T[]): T[] {
  return roomsOfBranch(config, rooms, knownBranchId(config, readBranchCookie()));
}
