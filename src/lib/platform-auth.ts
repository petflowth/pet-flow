/**
 * ระบบยืนยันตัวตนของ "ผู้ดูแลระบบ" (platform) — คนละชั้นกับเจ้าของร้าน/พนักงานที่ล็อกอินเข้า /admin
 *
 * ตอนนี้มีแค่คุณคนเดียวที่ดูแลทั้งแพลตฟอร์ม จึงใช้รหัสเดียว (PLATFORM_ADMIN_CODE) ไปก่อน
 * แบบเดียวกับที่ /admin เคยใช้รหัสร้านเดี่ยวๆ — ค่อยขยายเป็นระบบอีเมล/รหัสผ่านทีหลังเมื่อมีทีมงานจริง
 */

export type PlatformSessionPayload = {
  role: "platform_owner";
  /** หมดอายุ (epoch ms) */
  exp: number;
};

export const PLATFORM_SESSION_COOKIE = "petflow_platform_session";
const SESSION_DAYS = 1;

export function getPlatformCode(): string {
  return process.env.PLATFORM_ADMIN_CODE || "";
}

function secretKey(): string {
  return process.env.PLATFORM_SESSION_SECRET || `petflow-platform::${getPlatformCode()}`;
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

export async function signPlatformSession(): Promise<string> {
  const full: PlatformSessionPayload = {
    role: "platform_owner",
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64url(enc.encode(JSON.stringify(full)));
  return `${body}.${await hmac(body)}`;
}

export async function verifyPlatformSession(
  token: string | undefined | null
): Promise<PlatformSessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if ((await hmac(body)) !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as PlatformSessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getPlatformSessionFrom(req: {
  cookies: { get(name: string): { value: string } | undefined };
}): Promise<PlatformSessionPayload | null> {
  return verifyPlatformSession(req.cookies.get(PLATFORM_SESSION_COOKIE)?.value);
}

export function platformSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}
