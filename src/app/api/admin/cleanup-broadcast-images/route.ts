import { NextRequest, NextResponse } from "next/server";
import { cleanupOldBroadcastImages } from "@/lib/broadcast-cleanup";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ปุ่มในหลังบ้าน — ล้างรูปโปร broadcast เก่าออกจากฐานข้อมูลทันที (กดซ้ำได้ปลอดภัย) */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, handlePost);
}

async function handlePost() {
  const result = await cleanupOldBroadcastImages();
  if (!result.ok) {
    const status = result.error === "no-supabase" ? 400 : 500;
    const message =
      result.error === "no-supabase"
        ? "ไม่มีการเชื่อม Supabase (โหมด dev/mem)"
        : result.error || "ทำไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json(result);
}
