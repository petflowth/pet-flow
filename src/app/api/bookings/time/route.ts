import { NextRequest, NextResponse } from "next/server";
import { getBooking, setBookingTime } from "@/lib/bookings-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** ดึงข้อมูลนัดสำหรับหน้าเลือกเวลา */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const b = await getBooking(id);
  if (!b) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    booking: {
      id: b.id,
      catName: b.catName,
      service: b.service,
      checkin: b.checkin || b.date,
      checkout: b.checkout,
      arrivalTime: b.arrivalTime,
      pickupTime: b.pickupTime,
    },
  });
}

/** ลูกค้าเลือกเวลามาส่ง/รับน้อง */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId || "").trim();
  const type = body.type === "checkout" ? "checkout" : "checkin";
  const time = String(body.time || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();
  if (!bookingId || !time) {
    return NextResponse.json({ error: "bookingId + time required" }, { status: 400 });
  }

  const res = await setBookingTime(bookingId, type, time, lineUserId || undefined);
  if (!res.ok && res.error === "not_found") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!res.ok && res.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const b = res.booking;
  if (b) {
    await sendTelegram(
      formatBookingTelegram(
        type === "checkin" ? "🕒 ลูกค้าเลือกเวลาส่งน้อง" : "🕒 ลูกค้าเลือกเวลารับน้อง",
        {
          น้องแมว: b.catName,
          ลูกค้า: b.customerName,
          เวลา: time,
          วันที่: type === "checkin" ? b.checkin || b.date || "-" : b.checkout || "-",
        }
      )
    );
  }

  return NextResponse.json({ ok: res.ok, needSql: !res.ok && res.error === "need_sql" });
}
