import { NextRequest, NextResponse } from "next/server";
import { verifyStaffLogin } from "@/lib/staff-store";
import {
  SESSION_COOKIE,
  getBootstrapTenantId,
  getOwnerCode,
  hashOwnerCode,
  sessionCookieOptions,
  signSession,
  verifySession,
} from "@/lib/auth";
import { findTenantByOwnerCodeHash } from "@/lib/tenant-directory";

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
  // พนักงานล็อกอินด้วย username (ใส่ในช่อง code เดิม) + password —
  // เจ้าของร้านเว้นช่องนี้ว่างแล้วใส่แค่รหัสร้านช่องเดียวเหมือนเดิม
  const password = String(body.password || "");
  if (!code) {
    return NextResponse.json({ error: "กรอกรหัสผ่าน" }, { status: 400 });
  }

  let payload:
    | { role: "owner" | "staff"; name: string; tenantId: string; menus?: string[] }
    | null = null;

  if (password) {
    // พนักงาน — username + password ค้นข้ามทุกร้าน (username unique ทั้งแพลตฟอร์ม)
    const staff = await verifyStaffLogin(code, password);
    if (staff) {
      payload = {
        role: "staff",
        name: staff.name || "พนักงาน",
        tenantId: staff.tenantId,
        menus: staff.menus || [],
      };
    }
  } else {
    // 1) รหัสร้าน — ค้นข้ามทุกร้านด้วยแฮช (ร้านที่สร้างผ่าน /platform ตั้งรหัสของตัวเองได้)
    const ownerHash = await hashOwnerCode(code);
    const tenantByCode = await findTenantByOwnerCodeHash(ownerHash);
    if (tenantByCode) {
      payload = { role: "owner", name: "เจ้าของร้าน", tenantId: tenantByCode.id };
    }

    // 2) ร้าน bootstrap เดิม (ตั้งค่าผ่าน env ADMIN_CODE/TENANT_ID) — คงไว้ให้ร้านที่ตั้งไว้ก่อน T5 ยังใช้ได้
    if (!payload) {
      const bootstrapTenantId = getBootstrapTenantId();
      if (bootstrapTenantId && code === getOwnerCode()) {
        payload = { role: "owner", name: "เจ้าของร้าน", tenantId: bootstrapTenantId };
      }
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
