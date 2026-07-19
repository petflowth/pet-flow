/**
 * ระบบยืนยันตัวตนหลังบ้าน — คุกกี้เซ็นชื่อ (HMAC) ที่เบราว์เซอร์แก้เองไม่ได้
 *
 * ของเดิมเช็ครหัสในเบราว์เซอร์อย่างเดียว (sessionStorage) ส่วน API เปิดโล่ง
 * ใครก็ยิง /api/customers ดึงข้อมูลลูกค้าทั้งร้านได้ ไฟล์นี้คือฐานของการปิดรูนั้น
 *
 * ใช้ Web Crypto ล้วน ๆ เพื่อให้รันได้ทั้งใน middleware (edge) และใน route (node)
 */

export type SessionRole = "owner" | "staff";

export type SessionPayload = {
  role: SessionRole;
  name: string;
  /** เมนูที่พนักงานคนนี้เปิดดูได้ — undefined = เข้าได้ทุกเมนู (เจ้าของร้าน) */
  menus?: string[];
  /** หมดอายุ (epoch ms) */
  exp: number;
};

export const SESSION_COOKIE = "catcha_session";
const SESSION_DAYS = 7;

/**
 * รหัสเจ้าของร้าน — อ่านฝั่งเซิร์ฟเวอร์เท่านั้น
 *
 * ยอมรับ NEXT_PUBLIC_ADMIN_CODE ต่อไปเพื่อไม่ให้ร้านที่ตั้งค่าไว้แล้วหลุดออกจากระบบ
 * แต่ควรย้ายไปใช้ ADMIN_CODE เพราะตัวที่ขึ้นต้น NEXT_PUBLIC_ จะถูกฝังไปในไฟล์ JS ฝั่งเบราว์เซอร์
 */
export function getOwnerCode(): string {
  return (
    process.env.ADMIN_CODE ||
    process.env.NEXT_PUBLIC_ADMIN_CODE ||
    "catcha2026"
  );
}

function secretKey(): string {
  return process.env.SESSION_SECRET || `catcha-session::${getOwnerCode()}`;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secretKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

/** สร้างโทเคนสำหรับใส่คุกกี้ */
export async function signSession(
  payload: Omit<SessionPayload, "exp">
): Promise<string> {
  const full: SessionPayload = {
    ...payload,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64url(enc.encode(JSON.stringify(full)));
  return `${body}.${await hmac(body)}`;
}

/** ตรวจโทเคน — คืน null ถ้าลายเซ็นไม่ตรง หรือหมดอายุ */
export async function verifySession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * ตรวจสิทธิ์ในตัว route (ป้องกันซ้อนอีกชั้นจาก middleware)
 * ส่ง requireOwner: true ถ้างานนั้นพนักงานทำไม่ได้ เช่น จัดการบัญชีพนักงาน
 */
export async function getSessionFrom(
  req: { cookies: { get(name: string): { value: string } | undefined } }
): Promise<SessionPayload | null> {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(maxAgeDays = SESSION_DAYS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeDays * 24 * 60 * 60,
  };
}
