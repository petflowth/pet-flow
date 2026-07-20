import { NextRequest, NextResponse } from "next/server";
import { verifyStaffCode } from "@/lib/staff-store";
import {
  SESSION_COOKIE,
  getBootstrapTenantId,
  getOwnerCode,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

/** ใครล็อกอินอยู่ตอนนี้ — ใช้ให้หน้าหลังบ้านรู้บทบาท/เมนูที่เข้าได้ */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    role: session.role,
    name: session.name,
    menus: session.menus,
    impersonating: session.impersonating || false,
  });
}

/**
 * ล็อกอินหลังบ้าน — ตรวจรหัสที่เซิร์ฟเวอร์ แล้ววางคุกกี้ httpOnly ที่เซ็นชื่อไว้
 * เบราว์เซอร์แก้เองไม่ได้ และ JS อ่านไม่ได้
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!code) {
    return NextResponse.json({ error: "กรอกรหัสผ่าน" }, { status: 400 });
  }

  const tenantId = getBootstrapTenantId();
  if (!tenantId) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า TENANT_ID — ดูขั้นตอนใน SETUP_NEW_SHOP.md" },
      { status: 500 }
    );
  }

  let payload:
    | { role: "owner" | "staff"; name: string; tenantId: string; menus?: string[] }
    | null = null;

  if (code === getOwnerCode()) {
    payload = { role: "owner", name: "เจ้าของร้าน", tenantId };
  } else {
    const staff = await verifyStaffCode(code);
    if (staff) {
      payload = {
        role: "staff",
        name: staff.name || "พนักงาน",
        tenantId,
        menus: staff.menus || [],
      };
    }
  }

  if (!payload) {
    return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, ...payload });
  res.cookies.set(SESSION_COOKIE, await signSession(payload), sessionCookieOptions());
  return res;
}

/** ออกจากระบบ */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
