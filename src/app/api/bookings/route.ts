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
import { bookingMatchesCustomer } from "@/lib/booking-customer-match";
import { listCustomers, resolveCustomerForBooking } from "@/lib/customers-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage } from "@/lib/line";
import { buildBookingConfirmFlex } from "@/lib/booking-line-card";
import {
  findCustomerForBooking,
  recalculateCustomerTier,
} from "@/lib/customers-store";
import { getSiteConfig } from "@/lib/config-store";
import { listInvoices } from "@/lib/invoices-store";
import {
  buildDepositReminderText,
  buildPrestayReminderText,
  buildConsentInviteText,
  getConsentUrl,
} from "@/lib/booking-reminders";

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

/** หา LINE User ID ปลายทางของนัด (จากตัวนัด หรือจับคู่ลูกค้าในระบบ) */
async function resolveRecipient(
  b: StoredBooking,
  lineUserId?: string
): Promise<string> {
  const direct = String(lineUserId || b.lineUserId || "").trim();
  if (direct) return direct;
  const matched = await findCustomerForBooking(b);
  return matched?.lineUserId || "";
}

const NO_LINE_ERROR =
  "ยังไม่มี LINE User ID — ให้ลูกค้าเปิดแอปจาก LINE หรือผูกในโปรไฟล์ลูกค้า";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId") || undefined;
  const allCustomers = lineUserId ? [] : await listCustomers();
  const items = (await listBookings(lineUserId)).map((b) => {
    const customer = allCustomers.find((c) => bookingMatchesCustomer(b, c));
    return {
      ...toBooking(b),
      lineUserId: b.lineUserId,
      service: b.service,
      room: b.room,
      checkin: b.checkin,
      checkout: b.checkout,
      notes: b.notes,
      consentAcceptedAt: b.consentAcceptedAt,
      customerId: customer?.id,
    };
  });
  return NextResponse.json({ bookings: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customer = await resolveCustomerForBooking({
    customerName: body.customerName,
    catName: body.catName,
    lineUserId: body.lineUserId,
    customerId: body.customerId,
    phone: body.phone,
    staffNote: body.notes,
  });
  if (!customer) {
    return NextResponse.json({ error: "cat_name_required" }, { status: 400 });
  }

  const booking = await addBooking({
    customerName: customer.name,
    catName: body.catName,
    service: body.service,
    date: body.date || body.checkin || "",
    time: body.time,
    checkout: body.checkout,
    checkin: body.checkin,
    room: body.room,
    lineUserId: customer.lineUserId,
    notes: body.notes,
  });

  const cal = await createCalendarEvent({
    summary: `${body.service === "room" ? "🏠" : "🛁"} ${body.catName} (${customer.name})`,
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
      ลูกค้า: customer.name,
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
    const matched = await findCustomerForBooking(b);
    if (matched) await recalculateCustomerTier(matched.id);
    const updated = await getBooking(id);
    return NextResponse.json({ ok: true, booking: toBooking(updated!) });
  }

  if (action === "send_reminder") {
    let to = String(lineUserId || b.lineUserId || "").trim();
    if (!to) {
      const matched = await findCustomerForBooking(b);
      to = matched?.lineUserId || "";
    }
    if (!to) {
      return NextResponse.json(
        { error: "ยังไม่มี LINE User ID — ให้ลูกค้าเปิดแอปจาก LINE หรือผูกในโปรไฟล์ลูกค้า" },
        { status: 400 }
      );
    }

    try {
      const flex = await buildBookingConfirmFlex({
        id,
        catName: String(b.catName),
        customerName: String(b.customerName),
        service: String(b.service),
        date: b.date,
        time: b.time,
        checkin: b.checkin,
        checkout: b.checkout,
        room: b.room,
        notes: b.notes,
      });

      await pushLineMessage(to, [flex]);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── ส่งข้อความเตือน (กดเอง) — ใช้ข้อความชุดเดียวกับ cron อัตโนมัติ ──
  if (
    action === "send_prestay" ||
    action === "send_consent" ||
    action === "send_deposit_reminder"
  ) {
    const to = await resolveRecipient(b, lineUserId);
    if (!to) {
      return NextResponse.json({ error: NO_LINE_ERROR }, { status: 400 });
    }
    const cfg = await getSiteConfig();
    let text: string | null = null;

    if (action === "send_consent") {
      const url = await getConsentUrl();
      if (!url) {
        return NextResponse.json(
          { error: "ยังไม่ได้ตั้ง LIFF ID — ไป Admin → ติดตั้ง เพื่อตั้งค่าก่อน" },
          { status: 400 }
        );
      }
      text = buildConsentInviteText(b, cfg, url);
    } else if (action === "send_prestay") {
      text = buildPrestayReminderText(b, cfg, await getConsentUrl());
    } else {
      // send_deposit_reminder — หาใบแจ้งหนี้ที่มีมัดจำและยังค้างยอด
      const invoices = await listInvoices();
      const inv = invoices.find(
        (i) => i.bookingId === b.id && i.status === "pending" && (i.deposit || 0) > 0
      );
      if (!inv) {
        return NextResponse.json(
          { error: "ยังไม่มีบิลที่มีมัดจำค้างยอดของนัดนี้ — สร้างบิล + รับมัดจำก่อน" },
          { status: 400 }
        );
      }
      text = buildDepositReminderText(b, inv, cfg);
      if (!text) {
        return NextResponse.json(
          { error: "ไม่มียอดคงเหลือที่ต้องโอนแล้ว" },
          { status: 400 }
        );
      }
    }

    try {
      await pushLineMessage(to, [{ type: "text", text }]);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
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
