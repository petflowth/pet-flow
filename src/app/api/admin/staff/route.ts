import { NextRequest, NextResponse } from "next/server";
import {
  listStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  verifyStaffCode,
} from "@/lib/staff-store";

export const dynamic = "force-dynamic";

const OWNER_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || "catcha2026";

function isOwner(req: NextRequest) {
  return (req.headers.get("x-admin-code") || "") === OWNER_CODE;
}

/** รายชื่อพนักงาน — เฉพาะเจ้าของ (มีรหัสเข้าใช้ของแต่ละคนอยู่ในผลลัพธ์) */
export async function GET(req: NextRequest) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }
  return NextResponse.json({ staff: await listStaff() });
}

/**
 * POST:
 * - { action: "login", code } — พนักงาน/เจ้าของล็อกอิน (ไม่ต้องมีสิทธิ์)
 * - { action: "add", name, code, menus } — เจ้าของเพิ่มพนักงาน
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "login") {
    const code = String(body.code || "").trim();
    if (!code) return NextResponse.json({ ok: false }, { status: 400 });
    if (code === OWNER_CODE) {
      return NextResponse.json({ ok: true, role: "owner", name: "เจ้าของร้าน" });
    }
    const staff = await verifyStaffCode(code);
    if (!staff) return NextResponse.json({ ok: false }, { status: 401 });
    return NextResponse.json({
      ok: true,
      role: "staff",
      name: staff.name,
      menus: staff.menus,
    });
  }

  if (!isOwner(req)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }

  if (body.action === "add") {
    const res = await addStaff({
      name: String(body.name || ""),
      code: String(body.code || ""),
      menus: Array.isArray(body.menus) ? body.menus.map(String) : [],
    });
    if (!res.ok) {
      const messages: Record<string, string> = {
        missing_fields: "กรอกชื่อและรหัสให้ครบ",
        code_too_short: "รหัสต้องยาวอย่างน้อย 4 ตัว",
        code_in_use: "รหัสนี้ถูกใช้แล้ว — ตั้งรหัสอื่น",
        need_sql: "ต้องอัปเดตฐานข้อมูลก่อน (ตั้งค่า → ขั้นสูง → อัปเดตฐานข้อมูล)",
      };
      return NextResponse.json(
        { error: messages[res.error] || res.error },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, staff: res.staff });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const res = await updateStaff(id, {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.code !== undefined ? { code: String(body.code) } : {}),
    ...(Array.isArray(body.menus) ? { menus: body.menus.map(String) } : {}),
    ...(typeof body.active === "boolean" ? { active: body.active } : {}),
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: "owner_only" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteStaff(id);
  return NextResponse.json({ ok: true });
}
