import { NextRequest, NextResponse } from "next/server";
import { claimCustomerPromo } from "@/lib/promos-store";

/** ลูกค้ากดใช้โปรจากหน้าแอป */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const promoId = String(body.promoId || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();

  if (!promoId || !lineUserId) {
    return NextResponse.json({ error: "promoId and lineUserId required" }, { status: 400 });
  }

  const result = await claimCustomerPromo(promoId, lineUserId, "app");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    claim: result.claim,
    promo: result.promo,
    couponCode: result.promo.couponCode,
  });
}
