import { NextRequest, NextResponse } from "next/server";
import {
  findCustomerByLine,
  getCustomer,
  referralCodeFor,
} from "@/lib/customers-store";
import {
  listCustomerCoupons,
  activeCustomerCoupons,
  issueCoupon,
} from "@/lib/coupons-store";
import { getLineCredentials } from "@/lib/line-config";
import { buildLiffUrl } from "@/lib/liff-urls";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** กระเป๋าคูปองของลูกค้า + รหัสชวนเพื่อน (เรียกจากแอปด้วย lineUserId, หรือหลังบ้านด้วย customerId) */
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")?.trim();
  const customerId = req.nextUrl.searchParams.get("customerId")?.trim();
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";

  const cust = customerId
    ? await getCustomer(customerId)
    : lineUserId
      ? await findCustomerByLine(lineUserId)
      : undefined;
  if (!cust) return NextResponse.json({ found: false, coupons: [] });

  const coupons = activeOnly
    ? await activeCustomerCoupons(cust.id)
    : await listCustomerCoupons(cust.id);
  const referralCode = referralCodeFor(cust.id);
  const liffId = (await getLineCredentials())?.liffId;
  const referralUrl = liffId
    ? buildLiffUrl(liffId, { path: "register", ref: referralCode })
    : "";
  return NextResponse.json({
    found: true,
    customerId: cust.id,
    referralCode,
    referralUrl,
    coupons,
  });
}

/** ออกคูปองด้วยมือจากหลังบ้าน (แจกลูกค้าพิเศษ / โปร) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const customerId = String(body.customerId || "").trim();
  const amount = Math.round(Number(body.amount) || 0);
  const reason = String(body.reason || "").trim() || "คูปองส่วนลดจากร้าน";
  const expiresInDays = Number(body.expiresInDays) || 60;
  if (!customerId || amount <= 0) {
    return NextResponse.json({ error: "customerId + amount required" }, { status: 400 });
  }
  const cust = await getCustomer(customerId);
  if (!cust) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const coupon = await issueCoupon({ customerId, amount, reason, expiresInDays });
  await sendTelegram(
    formatBookingTelegram("🎁 ออกคูปองให้ลูกค้า (มือ)", {
      ลูกค้า: cust.name,
      มูลค่า: `${amount} บาท`,
      เหตุผล: reason,
    })
  );
  return NextResponse.json({ ok: true, coupon });
}
