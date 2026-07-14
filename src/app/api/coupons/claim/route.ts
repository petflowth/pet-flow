import { NextRequest, NextResponse } from "next/server";
import { findCustomerByLine } from "@/lib/customers-store";
import { getOffer, claimOffer } from "@/lib/coupons-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** ข้อมูลแคมเปญคูปอง (สำหรับหน้ากดรับ) */
export async function GET(req: NextRequest) {
  const offerId = req.nextUrl.searchParams.get("offer")?.trim();
  if (!offerId) return NextResponse.json({ error: "offer required" }, { status: 400 });
  const offer = await getOffer(offerId);
  if (!offer) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    offer: {
      id: offer.id,
      title: offer.title,
      amount: offer.amount,
      reason: offer.reason,
      validDays: offer.validDays,
      active: offer.active,
    },
  });
}

/** ลูกค้ากดรับคูปอง */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const offerId = String(body.offerId || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();
  if (!offerId || !lineUserId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const cust = await findCustomerByLine(lineUserId);
  if (!cust) return NextResponse.json({ error: "no_customer" }, { status: 404 });

  const res = await claimOffer(offerId, cust.id);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, alreadyClaimed: res.error === "already_claimed" },
      { status: res.error === "already_claimed" ? 200 : 400 }
    );
  }
  const offer = await getOffer(offerId);
  await sendTelegram(
    formatBookingTelegram("🎟️ ลูกค้ากดรับคูปองแล้ว", {
      ลูกค้า: cust.name,
      แคมเปญ: offer?.title || offerId,
      มูลค่า: `${(res.coupon?.amount ?? offer?.amount ?? 0).toLocaleString()} บาท`,
      รหัสคูปอง: res.coupon?.id || "-",
    })
  );
  return NextResponse.json({ ok: true, coupon: res.coupon });
}
