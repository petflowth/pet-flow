import { NextRequest, NextResponse } from "next/server";
import { getPlatformSessionFrom } from "@/lib/platform-auth";
import { getSupabase } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

async function requirePlatform(req: NextRequest) {
  return !!(await getPlatformSessionFrom(req));
}

/** รายชื่อร้านทั้งหมด — ข้ามการกรอง tenant_id โดยตั้งใจ (นี่คือมุมมองข้ามร้าน) */
export async function GET(req: NextRequest) {
  if (!(await requirePlatform(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ tenants: [] });

  const { data, error } = await sb
    .from("tenants")
    .select("id, slug, name, status, template, trial_ends_at, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    tenants: (data || []).map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      status: t.status,
      template: t.template,
      trialEndsAt: t.trial_ends_at,
      createdAt: t.created_at,
    })),
  });
}

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** สร้างร้านใหม่ — แค่ชื่อ + slug ตอนนี้ ค่าอื่นตั้งทีหลังได้ */
export async function POST(req: NextRequest) {
  if (!(await requirePlatform(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "กรอกชื่อร้าน" }, { status: 400 });
  }
  const slug = body.slug ? slugify(String(body.slug)) : slugify(name);
  if (!slug) {
    return NextResponse.json({ error: "ตั้ง slug ไม่ได้ — ลองใส่ชื่อเป็นภาษาอังกฤษ" }, { status: 400 });
  }

  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: "no_db" }, { status: 500 });

  const { data, error } = await sb
    .from("tenants")
    .insert({ name, slug, status: "trial" })
    .select("id, slug, name, status, created_at")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "slug นี้ถูกใช้แล้ว ลองชื่ออื่น" : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await logAudit({
    tenantId: data.id,
    actorType: "platform",
    actorId: "platform_owner",
    action: "create_tenant",
    resourceType: "tenant",
    resourceId: data.id,
    afterState: data,
  });

  return NextResponse.json({
    ok: true,
    tenant: {
      id: data.id,
      slug: data.slug,
      name: data.name,
      status: data.status,
      createdAt: data.created_at,
    },
  });
}
