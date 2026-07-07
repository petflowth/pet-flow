import { NextRequest, NextResponse } from "next/server";
import { createCalendarEvent } from "@/lib/calendar";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage, buildReminderFlex } from "@/lib/line";

// ชั่วคราว — ต่อ Supabase ในรอบถัดไป
const store: Array<Record<string, unknown>> = [];

export async function GET() {
  return NextResponse.json({ bookings: store });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = `B${Date.now()}`;
  const booking = {
    id,
    ...body,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const cal = await createCalendarEvent({
    summary: `🐱 ${body.catName} (${body.customerName})`,
    description: JSON.stringify(booking),
    start: body.date || body.checkin,
    end: body.checkout || body.date,
    allDay: body.service === "room",
  });

  booking.calendarEventId = cal.eventId;

  store.push(booking);

  await sendTelegram(
    formatBookingTelegram("📌 จองใหม่", {
      ลูกค้า: body.customerName,
      น้องแมว: body.catName,
      บริการ: body.service === "room" ? "ห้องพัก" : "อาบน้ำ",
      วันที่: body.date || body.checkin,
    })
  );

  return NextResponse.json({ ok: true, booking, calendar: cal });
}

export async function PATCH(req: NextRequest) {
  const { id, action, lineUserId } = await req.json();
  const b = store.find((x) => x.id === id);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "confirm") {
    b.status = "confirmed";
    await sendTelegram(
      formatBookingTelegram("✅ ลูกค้ายืนยันแล้ว", {
        ลูกค้า: String(b.customerName),
        น้องแมว: String(b.catName),
      })
    );
    return NextResponse.json({ ok: true, booking: b });
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
