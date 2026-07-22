import { NextRequest, NextResponse } from "next/server";
import { listAllCoupons, listOffers } from "@/lib/coupons-store";
import { listPromos, listPromoClaims } from "@/lib/promos-store";
import { listInvoices } from "@/lib/invoices-store";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

/** สถิติคูปอง + โปรโมชั่น (หลังบ้าน) */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, handleGet);
}

async function handleGet() {
  const [coupons, offers, promos, claims, invoices] = await Promise.all([
    listAllCoupons(),
    listOffers(),
    listPromos(),
    listPromoClaims(),
    listInvoices(),
  ]);

  const sum = (arr: { amount: number }[]) => arr.reduce((s, c) => s + c.amount, 0);
  const used = coupons.filter((c) => c.status === "used");
  const active = coupons.filter((c) => c.status === "active");

  const couponSummary = {
    total: coupons.length,
    active: active.length,
    used: used.length,
    expired: coupons.filter((c) => c.status === "expired").length,
    cancelled: coupons.filter((c) => c.status === "cancelled").length,
    valueUsed: sum(used), // ส่วนลดที่ถูกใช้ไปแล้วจริง
    valueOutstanding: sum(active), // ภาระคูปองที่ยังไม่ถูกใช้
  };

  // ต่อแคมเปญ
  const perOffer = offers.map((o) => {
    const cs = coupons.filter((c) => c.offerId === o.id);
    const u = cs.filter((c) => c.status === "used");
    return {
      id: o.id,
      title: o.title,
      amount: o.amount,
      active: o.active,
      issued: cs.length,
      used: u.length,
      valueUsed: sum(u),
      rate: cs.length ? Math.round((u.length / cs.length) * 100) : 0,
    };
  });

  // คูปองชวนเพื่อน (ไม่มี offerId + เหตุผลเกี่ยวกับการชวน)
  const refCoupons = coupons.filter(
    (c) => !c.offerId && /ชวน|เพื่อนแนะนำ|referr/i.test(c.reason)
  );
  const referral = {
    issued: refCoupons.length,
    used: refCoupons.filter((c) => c.status === "used").length,
    valueUsed: sum(refCoupons.filter((c) => c.status === "used")),
  };

  // โปรโมชั่น: กดรับ (claims) + ใช้จริง (บิลที่จ่ายแล้ว) + ส่วนลดรวม
  const perPromo = promos.map((p) => {
    const cl = claims.filter((x) => x.promoId === p.id).length;
    const usedInv = invoices.filter((i) => i.promoId === p.id && i.status === "paid");
    return {
      id: p.id,
      title: p.title.th,
      active: p.active,
      claims: cl,
      uses: usedInv.length,
      discount: usedInv.reduce((s, i) => s + (i.discount || 0), 0),
    };
  });

  return NextResponse.json({
    couponSummary,
    perOffer,
    referral,
    perPromo,
  });
}
