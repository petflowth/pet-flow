import { NextRequest, NextResponse } from "next/server";
import { createCalendarEvent } from "@/lib/calendar";
import {
  addBooking,
  getBooking,
  listBookings,
  toBooking,
  updateBooking,
} from "@/lib/bookings-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage, buildReminderFlex } from "@/lib/line";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId") || undefined;
  const items = listBookings(lineUserId).map((b) => ({
    ...toBooking(b),
    lineUserId: b.lineUserId,
  }));
  return NextResponse.json({ bookings: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const booking = addBooking({
    customerName: body.customerName,
    catName: body.catName,
    service: body.service,
    date: body.date || body.checkin || "",
    time: body.time,
    checkout: body.checkout,
    checkin: body.checkin,
    room: body.room,
    lineUserId: body.lineUserId,
    notes: body.notes,
  });

  const cal = await createCalendarEvent({
    summary: `🐱 ${body.catName} (${body.customerName})`,
    description: JSON.stringify(booking),
    start: body.date || body.checkin,
    end: body.checkout || body.date,
    allDay: body.service === "room",
  });

  booking.calendarEventId = cal.eventId;

  await sendTelegram(
    formatBookingTelegram("📌 จองใหม่", {
      ลูกค้า: body.customerName,
      น้องแมว: body.catName,
      บริการ: body.service === "room" ? "ห้องพัก" : "อาบน้ำ",
      วันที่: body.date || body.checkin,
    })
  );

  return NextResponse.json({ ok: true, booking: toBooking(booking), calendar: cal });
}

export async function PATCH(req: NextRequest) {
  const { id, action, lineUserId, checkinTime } = await req.json();
  const b = getBooking(id);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "confirm") {
    updateBooking(id, { status: "confirmed", checkinTime });
    await sendTelegram(
      formatBookingTelegram("✅ ลูกค้ายืนยันแล้ว", {
        ลูกค้า: String(b.customerName),
        น้องแมว: String(b.catName),
        วันที่: String(b.date || b.checkin),
      })
    );
    return NextResponse.json({ ok: true, booking: toBooking(getBooking(id)!) });
  }

  if (action === "send_reminder" && lineUserId) {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const base = process.env.NEXT_PUBLIC_APP_URL || "";
    const confirmUrl = liffId
      ? `https://liff.line.me/${liffId}?id=${id}`
      : `${base}/app/bookings`;

    await pushLineMessage(lineUserId, [
      buildReminderFlex({
        id,
        catName: String(b.catName),
        customerName: String(b.customerName),
        service: String(b.service),
        when: String(b.date || b.checkin),
        confirmUrl,
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
