import { NextRequest, NextResponse } from "next/server";
import { acceptBookingConsent } from "@/lib/bookings-store";

/** ลูกค้ากด "ยอมรับข้อตกลง" ก่อนเข้าพัก */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const res = await acceptBookingConsent(bookingId, lineUserId);
  if (!res.ok && res.error === "not_found") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!res.ok && res.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({
    ok: res.ok,
    acceptedAt: res.ok ? res.acceptedAt : undefined,
    needSql: !res.ok && res.error === "need_sql",
  });
}
