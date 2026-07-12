import { NextRequest, NextResponse } from "next/server";
import {
  createOffer,
  listOffers,
  getOffer,
  setOfferActive,
  cancelCoupon,
  listAllCoupons,
} from "@/lib/coupons-store";
import { getBroadcastAudience, listCustomers } from "@/lib/customers-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { multicastLineMessage, buildCouponOfferFlex } from "@/lib/line";
import { getLineCredentials } from "@/lib/line-config";
import { buildClaimCouponUrl } from "@/lib/liff-urls";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** หลังบ้าน: รายการแคมเปญ + คูปองทั้งหมด (พร้อมชื่อลูกค้า) */
export async function GET() {
  const [offers, coupons, customers] = await Promise.all([
    listOffers(),
    listAllCoupons(),
    listCustomers(),
  ]);
  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  return NextResponse.json({
    offers,
    coupons: coupons.map((c) => ({
      ...c,
      customerName: c.customerId ? nameById.get(c.customerId) || "-" : "-",
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const amount = Math.round(Number(body.amount) || 0);
  if (!title || amount <= 0) {
    return NextResponse.json({ error: "title + amount required" }, { status: 400 });
  }
  const offer = await createOffer({
    title,
    amount,
    reason: body.reason ? String(body.reason) : undefined,
    validDays: Number(body.validDays) || 60,
  });
  return NextResponse.json({ ok: true, offer });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "set_active") {
    await setOfferActive(String(body.offerId || ""), body.active !== false);
    return NextResponse.json({ ok: true });
  }

  if (action === "cancel_coupon") {
    await cancelCoupon(String(body.couponId || ""));
    return NextResponse.json({ ok: true });
  }

  if (action === "blast") {
    const offer = await getOffer(String(body.offerId || ""));
    if (!offer) return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
    const liffId = (await getLineCredentials())?.liffId;
    if (!liffId) {
      return NextResponse.json(
        { error: "ยังไม่ได้ตั้ง LIFF ID — ไป Admin → ติดตั้ง ก่อน" },
        { status: 400 }
      );
    }
    const tier = (body.tier || "all") as CustomerTier | "all";
    const breed = body.breed ? String(body.breed) : undefined;
    const { recipients, skippedNoLine, skippedNoConsent } = await getBroadcastAudience(
      tier,
      { breed }
    );
    const lineIds = recipients.map((c) => c.lineUserId).filter(Boolean) as string[];
    const flex = buildCouponOfferFlex({
      title: offer.title,
      amount: offer.amount,
      body: offer.reason && offer.reason !== offer.title ? offer.reason : undefined,
      url: buildClaimCouponUrl(liffId, offer.id),
      validDays: offer.validDays,
    });
    let sent = 0;
    if (lineIds.length) {
      const r = await multicastLineMessage(lineIds, [flex]);
      sent = r.sent;
    }
    await sendTelegram(
      formatBookingTelegram("🎟️ ยิงการ์ดคูปอง", {
        แคมเปญ: offer.title,
        มูลค่า: `${offer.amount} บาท`,
        ส่งสำเร็จ: String(sent),
        ข้ามไม่มีLINE: String(skippedNoLine),
        ข้ามไม่รับข่าว: String(skippedNoConsent),
      })
    );
    return NextResponse.json({ ok: true, sent, skippedNoLine, skippedNoConsent });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
