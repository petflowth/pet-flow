import { NextRequest, NextResponse } from "next/server";
import { withResolvedTenant } from "@/lib/tenant-context";
import { acceptBookingConsent, getBooking } from "@/lib/bookings-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** ลูกค้ากด "ยอมรับข้อตกลง" ก่อนเข้าพัก */
async function postHandler(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();
  const careNote = String(body.careNote || "").trim();
  const signature = String(body.signature || "").trim();
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const res = await acceptBookingConsent(bookingId, lineUserId, careNote, signature);
  if (!res.ok && res.error === "not_found") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!res.ok && res.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (res.ok) {
    const b = await getBooking(bookingId);
    if (b) {
      await sendTelegram(
        formatBookingTelegram("✅ ลูกค้ายอมรับข้อตกลงก่อนเข้าพักแล้ว", {
          น้องแมว: b.catName,
          ลูกค้า: b.customerName,
          เข้าพัก: `${b.checkin || b.date || "-"}${b.checkout ? ` → ${b.checkout}` : ""}`,
          ลายเซ็น: signature ? "มี ✍️" : "ไม่ได้เซ็น",
          ...(careNote ? { "การดูแลเพิ่มเติม": careNote } : {}),
        })
      );
    }
  }

  return NextResponse.json({
    ok: res.ok,
    acceptedAt: res.ok ? res.acceptedAt : undefined,
    needSql: !res.ok && res.error === "need_sql",
  });
}

// R1/R3: resolve ร้านจาก request (header/cookie) ก่อนเข้า handler
export function POST(req: NextRequest) { return withResolvedTenant(req, () => postHandler(req)); }
