import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import { withResolvedTenant, withTenant } from "@/lib/tenant-context";
import {
  listPromos,
  getActivePromos,
  getCustomerPromos,
  addPromo,
  updatePromo,
  deletePromo,
  listPromoClaims,
  getBestPromoForCustomer,
  type PromoKind,
  type CustomerTier,
} from "@/lib/promos-store";

export async function GET(req: NextRequest) {
  const withClaims = req.nextUrl.searchParams.get("claims") === "1";
  if (withClaims) {
    // รายชื่อ+lineUserId ของลูกค้าทุกคนที่เคยกดรับโปร — ข้อมูลส่วนตัว หลังบ้านดูได้เท่านั้น
    const session = await getSessionFrom(req);
    if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const promoId = req.nextUrl.searchParams.get("promoId") || undefined;
    return withTenant(session.tenantId, async () =>
      NextResponse.json({ claims: await listPromoClaims(promoId) })
    );
  }

  // ที่เหลือ — แอปลูกค้าเปิดสาธารณะได้ (ดู PUBLIC_GET ใน middleware) จับร้านจาก slug/cookie
  return withResolvedTenant(req, () => handlePublicGet(req));
}

async function handlePublicGet(req: NextRequest) {
  const forCustomer = req.nextUrl.searchParams.get("forCustomer") === "1";
  const lineUserId = req.nextUrl.searchParams.get("lineUserId") || "";
  const active = req.nextUrl.searchParams.get("active") === "1";

  if (forCustomer && lineUserId) {
    return NextResponse.json({ promos: await getCustomerPromos(lineUserId) });
  }

  const autoFor = req.nextUrl.searchParams.get("autoFor");
  if (autoFor) {
    const subtotal = Number(req.nextUrl.searchParams.get("subtotal")) || 0;
    return NextResponse.json({
      promo: await getBestPromoForCustomer(autoFor, subtotal),
    });
  }

  if (active) {
    const kind = req.nextUrl.searchParams.get("kind") as PromoKind | null;
    return NextResponse.json({ promos: await getActivePromos(new Date(), kind || undefined) });
  }

  return NextResponse.json({ promos: await listPromos() });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const promo = await addPromo({
    title: body.title,
    body: body.body,
    discountPercent: body.discountPercent,
    discountAmount: body.discountAmount,
    imageUrl: body.imageUrl,
    startDate: body.startDate || new Date().toISOString().slice(0, 10),
    until: body.until,
    active: body.active !== false,
    kind: body.kind || "display",
    restriction: body.restriction || "none",
    validMonth: body.validMonth || undefined,
    tiers: (body.tiers as CustomerTier[]) || ["all"],
    couponCode: body.couponCode || undefined,
    rewardType: body.rewardType || "discount",
    pointsBonus: body.pointsBonus ? Number(body.pointsBonus) : undefined,
    pointsMultiplier: body.pointsMultiplier ? Number(body.pointsMultiplier) : undefined,
  });
  return NextResponse.json({ ok: true, promo });
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePatch(req));
}

async function handlePatch(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const promo = await updatePromo(body.id, body.patch || body);
  if (!promo) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, promo });
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handleDelete(req));
}

async function handleDelete(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deletePromo(id);
  return NextResponse.json({ ok: true });
}
