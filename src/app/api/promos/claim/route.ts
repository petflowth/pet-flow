import { NextRequest, NextResponse } from "next/server";
import { claimCustomerPromo } from "@/lib/promos-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** ลูกค้ากดใช้โปรจากหน้าแอป */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const promoId = String(body.promoId || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();

  if (!promoId || !lineUserId) {
    return NextResponse.json({ error: "promoId and lineUserId required" }, { status: 400 });
  }

  const result = await claimCustomerPromo(promoId, lineUserId, "app");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await sendTelegram(
    formatBookingTelegram("🎁 ลูกค้ากดใช้โปรโมชั่นแล้ว", {
      ลูกค้า: result.claim.customerName,
      โปรโมชั่น: result.claim.promoTitle,
      ...(result.pointsAwarded > 0 ? { แต้มที่ได้: `${result.pointsAwarded} แต้ม` } : {}),
      ...(result.promo.couponCode ? { คูปอง: result.promo.couponCode } : {}),
    })
  );

  return NextResponse.json({
    ok: true,
    claim: result.claim,
    promo: result.promo,
    couponCode: result.promo.couponCode,
    pointsAwarded: result.pointsAwarded,
    newPoints: result.newPoints,
  });
}
