import { NextRequest, NextResponse } from "next/server";
import { listStaff, addStaff, updateStaff, deleteStaff } from "@/lib/staff-store";
import { getSessionFrom } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

/** จัดการบัญชีพนักงานได้เฉพาะ "เจ้าของร้าน" เท่านั้น พนักงานตั้งสิทธิ์ให้ตัวเองไม่ได้ */
async function requireOwnerSession(req: NextRequest) {
  const session = await getSessionFrom(req);
  return session?.role === "owner" ? session : null;
}

/** รายชื่อพนักงาน — เฉพาะเจ้าของ */
export async function GET(req: NextRequest) {
  const session = await requireOwnerSession(req);
  if (!session) return NextResponse.json({ error: "owner_only" }, { status: 403 });
  return withTenant(session.tenantId, async () =>
    NextResponse.json({ staff: await listStaff() })
  );
}

/** POST: { action: "add", name, username, password, menus } — เจ้าของเพิ่มพนักงาน */
export async function POST(req: NextRequest) {
  const session = await requireOwnerSession(req);
  if (!session) return NextResponse.json({ error: "owner_only" }, { status: 403 });
  return withTenant(session.tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "add") {
    const res = await addStaff({
      name: String(body.name || ""),
      username: String(body.username || ""),
      password: String(body.password || ""),
      menus: Array.isArray(body.menus) ? body.menus.map(String) : [],
    });
    if (!res.ok) {
      const messages: Record<string, string> = {
        missing_fields: "กรอกชื่อ, username และ password ให้ครบ",
        username_too_short: "username ต้องยาวอย่างน้อย 3 ตัว",
        password_too_short: "password ต้องยาวอย่างน้อย 6 ตัว",
        username_in_use: "username นี้ถูกใช้แล้ว — ตั้งชื่ออื่น",
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
  const session = await requireOwnerSession(req);
  if (!session) return NextResponse.json({ error: "owner_only" }, { status: 403 });
  return withTenant(session.tenantId, () => handlePatch(req));
}

async function handlePatch(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const res = await updateStaff(id, {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.username !== undefined ? { username: String(body.username) } : {}),
    ...(body.password !== undefined ? { password: String(body.password) } : {}),
    ...(Array.isArray(body.menus) ? { menus: body.menus.map(String) } : {}),
    ...(typeof body.active === "boolean" ? { active: body.active } : {}),
  });
  if (!res.ok) {
    const messages: Record<string, string> = {
      username_too_short: "username ต้องยาวอย่างน้อย 3 ตัว",
      password_too_short: "password ต้องยาวอย่างน้อย 6 ตัว",
      username_in_use: "username นี้ถูกใช้แล้ว — ตั้งชื่ออื่น",
    };
    return NextResponse.json(
      { error: messages[res.error] || res.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireOwnerSession(req);
  if (!session) return NextResponse.json({ error: "owner_only" }, { status: 403 });
  return withTenant(session.tenantId, () => handleDelete(req));
}

async function handleDelete(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteStaff(id);
  return NextResponse.json({ ok: true });
}
