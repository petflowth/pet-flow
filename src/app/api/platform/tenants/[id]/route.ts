import { NextRequest, NextResponse } from "next/server";
import { getPlatformSessionFrom } from "@/lib/platform-auth";
import { getSupabase } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function requirePlatform(req: NextRequest) {
  return !!(await getPlatformSessionFrom(req));
}

/** เปลี่ยนสถานะร้าน (suspend/activate) หรือ "เข้าดูแทน" (impersonate) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requirePlatform(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "no_db" }, { status: 500 });

  const { data: tenant } = await sb
    .from("tenants")
    .select("id, slug, name, status")
    .eq("id", id)
    .maybeSingle();
  if (!tenant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "set_status") {
    const status = String(body.status || "");
    if (!["trial", "active", "suspended", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    await sb.from("tenants").update({ status }).eq("id", id);
    await logAudit({
      tenantId: id,
      actorType: "platform",
      actorId: "platform_owner",
      action: "set_tenant_status",
      resourceType: "tenant",
      resourceId: id,
      beforeState: { status: tenant.status },
      afterState: { status },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "impersonate") {
    // วาง session ของหลังบ้านร้านนั้นให้เลย (role owner) + ทำเครื่องหมายว่ากำลังเข้าดูแทน
    await logAudit({
      tenantId: id,
      actorType: "platform",
      actorId: "platform_owner",
      action: "impersonate",
      resourceType: "tenant",
      resourceId: id,
    });
    const token = await signSession({
      role: "owner",
      name: `${tenant.name} (เข้าดูแทน)`,
      tenantId: id,
      impersonating: true,
    });
    const res = NextResponse.json({ ok: true, redirect: "/admin" });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(1));
    return res;
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
