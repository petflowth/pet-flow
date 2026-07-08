import { NextRequest, NextResponse } from "next/server";
import {
  createCalendarEvent,
  updateCalendarEventConfirmed,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/calendar";
import {
  addBooking,
  cancelBooking,
  getBooking,
  listBookings,
  toBooking,
  updateBooking,
  type StoredBooking,
} from "@/lib/bookings-store";
import { upsertCustomerFromBooking } from "@/lib/customers-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage, buildReminderFlex } from "@/lib/line";

export const dynamic = "force-dynamic";

function bookingCalendarPayload(b: StoredBooking) {
  return {
    summary: `${b.service === "room" ? "🏠" : "🛁"} ${b.catName} (${b.customerName})`,
    description: `${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · ${b.notes || ""}`,
    start: b.date || b.checkin || "",
    end: b.checkout || b.date || b.checkin || "",
    time: b.time,
    allDay: b.service === "room" && !b.time,
    service: b.service === "room" ? ("room" as const) : ("groom" as const),
    eventId: b.id,
  };
}

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId") || undefined;
  const items = (await listBookings(lineUserId)).map((b) => ({
    ...toBooking(b),
    lineUserId: b.lineUserId,
    service: b.service,
    room: b.room,
    checkin: b.checkin,
    checkout: b.checkout,
    notes: b.notes,
  }));
  return NextResponse.json({ bookings: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customer = await upsertCustomerFromBooking({
    customerName: body.customerName,
    catName: body.catName,
    lineUserId: body.lineUserId,
    phone: body.phone,
    staffNote: body.notes,
  });

  const booking = await addBooking({
    customerName: body.customerName,
    catName: body.catName,
    service: body.service,
    date: body.date || body.checkin || "",
    time: body.time,
    checkout: body.checkout,
    checkin: body.checkin,
    room: body.room,
    lineUserId: body.lineUserId || customer.lineUserId,
    notes: body.notes,
  });

  const cal = await createCalendarEvent({
    summary: `${body.service === "room" ? "🏠" : "🛁"} ${body.catName} (${body.customerName})`,
    description: `${body.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · ${body.notes || ""}`,
    start: body.date || body.checkin,
    end: body.checkout || body.date || body.checkin,
    time: body.time,
    allDay: body.service === "room" && !body.time,
    service: body.service === "room" ? "room" : "groom",
    eventId: booking.id,
  });

  await updateBooking(booking.id, { calendarEventId: cal.eventId });

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const icsUrl = `${base}/api/calendar/${booking.id}`;

  await sendTelegram(
    formatBookingTelegram("📌 จองใหม่", {
      ลูกค้า: body.customerName,
      น้องแมว: body.catName,
      บริการ: body.service === "room" ? "ห้องพัก" : "อาบน้ำ",
      วันที่: `${body.date || body.checkin}${body.time ? ` ${body.time}` : ""}`,
      ปฏิทิน: cal.googleUrl || icsUrl,
    })
  );

  return NextResponse.json({
    ok: true,
    booking: toBooking(booking),
    customerId: customer.id,
    calendar: { ...cal, icsUrl },
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, action, lineUserId, checkinTime } = body;
  const b = await getBooking(id);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "confirm") {
    await updateBooking(id, { status: "confirmed", checkinTime });
    if (b.calendarEventId) {
      await updateCalendarEventConfirmed(b.calendarEventId, {
        summary: `${b.service === "room" ? "🏠" : "🛁"} ${b.catName} (${b.customerName})`,
        description: `${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · ${b.notes || ""}`,
        start: b.date || b.checkin || "",
        end: b.checkout || b.date || b.checkin || "",
        time: b.time,
        allDay: b.service === "room" && !b.time,
        service: b.service === "room" ? "room" : "groom",
        checkinTime,
      });
    }
    await sendTelegram(
      formatBookingTelegram("✅ ลูกค้ายืนยันแล้ว", {
        ลูกค้า: String(b.customerName),
        น้องแมว: String(b.catName),
        วันที่: String(b.date || b.checkin),
      })
    );
    const updated = await getBooking(id);
    return NextResponse.json({ ok: true, booking: toBooking(updated!) });
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

  if (action === "update") {
    const patch: Parameters<typeof updateBooking>[1] = {};
    if (body.customerName != null) patch.customerName = String(body.customerName);
    if (body.catName != null) patch.catName = String(body.catName);
    if (body.service != null) patch.service = body.service;
    if (body.date != null) patch.date = String(body.date);
    if (body.time != null) patch.time = String(body.time) || undefined;
    if (body.checkin != null) patch.checkin = String(body.checkin) || undefined;
    if (body.checkout != null) patch.checkout = String(body.checkout) || undefined;
    if (body.room != null) patch.room = String(body.room) || undefined;
    if (body.notes != null) patch.notes = String(body.notes) || undefined;
    if (body.status != null) patch.status = body.status;

    const updated = await updateBooking(id, patch);
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (updated.calendarEventId && updated.status !== "cancelled") {
      await updateCalendarEvent(updated.calendarEventId, bookingCalendarPayload(updated));
    }

    await sendTelegram(
      formatBookingTelegram("✏️ แก้ไขนัด", {
        ลูกค้า: String(updated.customerName),
        น้องแมว: String(updated.catName),
        วันที่: String(updated.date || updated.checkin),
        เวลา: String(updated.time || "-"),
      })
    );

    return NextResponse.json({ ok: true, booking: toBooking(updated) });
  }

  if (action === "cancel") {
    const updated = await cancelBooking(id);
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (b.calendarEventId) {
      const del = await deleteCalendarEvent(b.calendarEventId);
      if (!del.ok) {
        await updateCalendarEvent(b.calendarEventId, bookingCalendarPayload(b), {
          cancelled: true,
        });
      }
    }

    await sendTelegram(
      formatBookingTelegram("❌ ยกเลิกนัด", {
        ลูกค้า: String(b.customerName),
        น้องแมว: String(b.catName),
        วันที่: String(b.date || b.checkin),
      })
    );

    return NextResponse.json({ ok: true, booking: toBooking(updated) });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
