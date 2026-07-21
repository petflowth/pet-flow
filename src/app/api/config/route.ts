import { NextRequest, NextResponse } from "next/server";
import { getSiteConfig, updateSiteConfig, replaceSiteConfig } from "@/lib/config-store";
import { getSessionFrom } from "@/lib/auth";
import { withResolvedTenant, withTenant } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

/**
 * GET เปิดสาธารณะ (แอปลูกค้าดึงมาแสดงหน้าเว็บ) ต้องรู้ร้านจาก slug/cookie เวลาไม่มี session
 * — ก่อนหน้านี้ route นี้ไม่เคยห่อด้วย withTenant/withResolvedTenant เลยสักครั้ง ทุกร้าน
 * (ทั้งอ่านและเขียน) เลยตกไปใช้ร้าน bootstrap เดียวกันหมด นี่คือสาเหตุที่แก้สีร้านหนึ่ง
 * แล้วกระทบร้านอื่นด้วย — bug นี้ร้ายแรงสุดในบรรดาที่เจอ เพราะกระทบ config ทั้งก้อน
 */
export async function GET(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (session) return withTenant(session.tenantId, handleGet);
  return withResolvedTenant(req, handleGet);
}

async function handleGet() {
  const config = await getSiteConfig();
  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePatch(req));
}

async function handlePatch(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "replace" && body.config) {
    const config = await replaceSiteConfig(body.config);
    return NextResponse.json({ ok: true, config });
  }

  const config = await updateSiteConfig(body.patch || body);
  return NextResponse.json({ ok: true, config });
}
