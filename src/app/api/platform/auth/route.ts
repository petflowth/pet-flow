import { NextRequest, NextResponse } from "next/server";
import {
  PLATFORM_SESSION_COOKIE,
  getPlatformCode,
  getPlatformSessionFrom,
  platformSessionCookieOptions,
  signPlatformSession,
} from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

/** ใครล็อกอินอยู่ตอนนี้ — ใช้ให้หน้า /platform รู้ว่ายังล็อกอินอยู่ไหม */
export async function GET(req: NextRequest) {
  const session = await getPlatformSessionFrom(req);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}

/** ล็อกอินผู้ดูแลระบบ */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  const platformCode = getPlatformCode();

  if (!platformCode) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า PLATFORM_ADMIN_CODE ใน Vercel" },
      { status: 500 }
    );
  }
  if (!code || code !== platformCode) {
    return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    PLATFORM_SESSION_COOKIE,
    await signPlatformSession(),
    platformSessionCookieOptions()
  );
  return res;
}

/** ออกจากระบบ */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PLATFORM_SESSION_COOKIE, "", {
    ...platformSessionCookieOptions(),
    maxAge: 0,
  });
  return res;
}
