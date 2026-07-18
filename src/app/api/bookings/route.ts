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
import {
  pushLineMessage,
  buildConsentFlex,
  buildPrestayFlex,
  buildTimePickerFlex,
  buildGroomInfoFlex,
  buildDepositRequestFlex,
  buildBillSummaryFlex,
} from "@/lib/line";
import { buildBookingConfirmFlex } from "@/lib/booking-line-card";
import {
  findCustomerForBooking,
  recalculateCustomerTier,
  adjustDepositCredit,
} from "@/lib/customers-store";
import { getSiteConfig } from "@/lib/config-store";
import { DEFAULT_MESSAGES, renderTemplate } from "@/lib/messages";
import { listInvoices, updateInvoice } from "@/lib/invoices-store";
import { getPaymentConfig } from "@/lib/payment-config";
import {
  buildDepositReminderText,
  buildPrestayFlexData,
  buildCheckinBodyText,
  buildCheckoutBodyText,
  buildGroomInfoBody,
  getBookingTimeUrl,
  getGroomInfoUrl,
  getConsentUrl,
  bookingScheduleText,
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
      consentSignature: b.consentSignature,
      careNote: b.careNote,
      arrivalTime: b.arrivalTime,
      pickupTime: b.pickupTime,
      groomHealthInfo: b.groomHealthInfo,
      customerId: customer?.id,
    };
  });
  return NextResponse.json({ bookings: items });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
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
  const body = await req.json().catch(() => ({}));
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

  // ── การ์ดสอบถามประวัติน้องก่อนอาบน้ำ (กดเอง) ──
  if (action === "send_groom_info") {
    const to = await resolveRecipient(b, lineUserId);
    if (!to) {
      return NextResponse.json({ error: NO_LINE_ERROR }, { status: 400 });
    }
    const cfg = await getSiteConfig();
    const url = await getGroomInfoUrl(b.id);
    const flex = buildGroomInfoFlex({
      catName: String(b.catName),
      dateText: b.date ? `📅 นัดอาบน้ำ: ${b.date}${b.time ? ` ${b.time}` : ""}` : undefined,
      body: buildGroomInfoBody(b, cfg),
      url: url || undefined,
      label: "🩺 แจ้งประวัติน้อง",
    }, cfg.cards?.groomInfo);
    try {
      await pushLineMessage(to, [flex]);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── การ์ดสอบถามประวัติน้องก่อนอาบน้ำ แบบรวมทั้งบ้าน (หลายตัวพร้อมกัน) — ส่งการ์ดเดียว ลิงก์เดียว กรอกครบทุกตัวในหน้าเดียว ──
  if (action === "send_groom_info_group") {
    const ids: string[] = Array.isArray(body.ids) && body.ids.length > 0 ? body.ids : [id];
    const to = await resolveRecipient(b, lineUserId);
    if (!to) {
      return NextResponse.json({ error: NO_LINE_ERROR }, { status: 400 });
    }
    const bookings = (
      await Promise.all(ids.map((x: string) => getBooking(x)))
    ).filter((x): x is StoredBooking => !!x);
    if (bookings.length === 0) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const cfg = await getSiteConfig();
    const url = await getGroomInfoUrl(bookings.map((x) => x.id));
    const catNames = bookings.map((x) => x.catName).join(", ");
    const flex = buildGroomInfoFlex({
      catName: catNames,
      dateText: b.date ? `📅 นัดอาบน้ำ: ${b.date}${b.time ? ` ${b.time}` : ""}` : undefined,
      body: buildGroomInfoBody(
        { catName: bookings.length > 1 ? `น้องๆ ${bookings.length} ตัว` : catNames },
        cfg
      ),
      url: url || undefined,
      label:
        bookings.length > 1
          ? `🩺 แจ้งประวัติน้อง (${bookings.length} ตัว)`
          : "🩺 แจ้งประวัติน้อง",
    }, cfg.cards?.groomInfo);
    try {
      await pushLineMessage(to, [flex]);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── การ์ดให้ลูกค้าเลือกเวลาส่ง/รับน้อง (กดเอง) ──
  if (action === "send_checkin_reminder" || action === "send_checkout_reminder") {
    const to = await resolveRecipient(b, lineUserId);
    if (!to) {
      return NextResponse.json({ error: NO_LINE_ERROR }, { status: 400 });
    }
    const cfg = await getSiteConfig();
    const type = action === "send_checkin_reminder" ? "checkin" : "checkout";
    const url = await getBookingTimeUrl(b.id, type);
    const flex =
      type === "checkin"
        ? buildTimePickerFlex({
            title: "🕒 เลือกเวลาเข้าพัก",
            body: buildCheckinBodyText(b, cfg),
            url: url || undefined,
            label: "🕒 เลือกเวลาส่งน้อง",
          })
        : buildTimePickerFlex({
            title: "🕒 เลือกเวลารับน้อง",
            body: buildCheckoutBodyText(b, cfg),
            url: url || undefined,
            label: "🕒 เลือกเวลารับน้อง",
          });
    try {
      await pushLineMessage(to, [flex]);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── 📦 ส่งชุดการ์ดที่เลือกเอง — หลายการ์ดใน push เดียว (LINE นับเป็น 1 ข้อความ) ──
  // parts: reminder | consent | groomInfo | checkin | checkout | deposit(+amount) | payment
  if (action === "send_bundle") {
    const to = await resolveRecipient(b, lineUserId);
    if (!to) {
      return NextResponse.json({ error: NO_LINE_ERROR }, { status: 400 });
    }
    const parts: string[] = (Array.isArray(body.parts) ? body.parts : [])
      .map(String)
      .slice(0, 5); // LINE จำกัด 5 การ์ดต่อ push
    if (parts.length === 0) {
      return NextResponse.json({ error: "เลือกอย่างน้อย 1 การ์ด" }, { status: 400 });
    }
    const cfg = await getSiteConfig();
    const messages: object[] = [];

    for (const part of parts) {
      if (part === "reminder") {
        messages.push(
          await buildBookingConfirmFlex({
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
          })
        );
      } else if (part === "consent") {
        const url = await getConsentUrl(b.id);
        if (url) {
          messages.push(
            buildConsentFlex({
              businessName: cfg.business.name,
              title: cfg.messages.consentTitle || DEFAULT_MESSAGES.consentTitle,
              catName: String(b.catName),
              checkin: b.checkin || b.date,
              checkout: b.checkout,
              room: b.room,
              terms: cfg.messages.consentTerms?.length
                ? cfg.messages.consentTerms
                : DEFAULT_MESSAGES.consentTerms,
              url,
            })
          );
        }
      } else if (part === "groomInfo") {
        const url = await getGroomInfoUrl(b.id);
        messages.push(
          buildGroomInfoFlex({
            catName: String(b.catName),
            dateText: b.date
              ? `📅 นัดอาบน้ำ: ${b.date}${b.time ? ` ${b.time}` : ""}`
              : undefined,
            body: buildGroomInfoBody(b, cfg),
            url: url || undefined,
            label: "🩺 แจ้งประวัติน้อง",
          }, cfg.cards?.groomInfo)
        );
      } else if (part === "checkin" || part === "checkout") {
        const url = await getBookingTimeUrl(b.id, part);
        messages.push(
          part === "checkin"
            ? buildTimePickerFlex({
                title: "🕒 เลือกเวลาเข้าพัก",
                body: buildCheckinBodyText(b, cfg),
                url: url || undefined,
                label: "🕒 เลือกเวลาส่งน้อง",
              })
            : buildTimePickerFlex({
                title: "🕒 เลือกเวลารับน้อง",
                body: buildCheckoutBodyText(b, cfg),
                url: url || undefined,
                label: "🕒 เลือกเวลารับน้อง",
              })
        );
      } else if (part === "deposit") {
        const amount = Math.round(Number(body.depositAmount) || 0);
        if (amount > 0) {
          // ผูกมัดจำเหมือนกดปุ่มเรียกเก็บมัดจำเดี่ยว: มีบิลค้าง → ผูกบิล, ไม่มี → เครดิตล่วงหน้า
          const all = await listInvoices();
          const openInv = all.find(
            (i) => i.bookingId === b.id && i.status !== "paid"
          );
          const customer = await findCustomerForBooking(b);
          if (openInv) {
            await updateInvoice(openInv.id, { deposit: amount });
          } else if (customer) {
            await adjustDepositCredit(customer.id, amount);
          }
          const payment = await getPaymentConfig();
          messages.push(
            buildDepositRequestFlex({
              title: cfg.messages.depositRequestTitle,
              body: renderTemplate(cfg.messages.depositRequestBody, {
                name: String(b.customerName),
                cat: String(b.catName),
                amount: amount.toLocaleString(),
                pct: "",
              }),
              amount,
              bankName: payment.bankName,
              accountNumber: payment.accountNumber,
              accountName: payment.accountName,
            }, cfg.cards?.depositRequest)
          );
        }
      } else if (part === "payment") {
        const all = await listInvoices();
        const inv =
          all.find((i) => i.bookingId === b.id && i.status !== "paid") ||
          all.find((i) => i.bookingId === b.id);
        if (inv) {
          const payment = await getPaymentConfig();
          const deposit = inv.deposit || 0;
          const mode = deposit > 0 ? "remaining" : "full";
          messages.push(
            buildBillSummaryFlex({
              mode,
              title:
                mode === "remaining"
                  ? "แจ้งยอดคงเหลือที่ต้องโอน"
                  : cfg.billing.summaryFullTitle,
              closing: "",
              customerName: inv.customerName,
              catName: inv.catName,
              scheduleText: bookingScheduleText(b),
              items: inv.items,
              subtotal: inv.subtotal,
              discount: inv.discount,
              total: inv.total,
              deposit,
              remaining: Math.max(0, inv.total - deposit),
              bankName: payment.bankName,
              accountNumber: payment.accountNumber,
              accountName: payment.accountName,
            }, cfg.cards?.billSummary)
          );
        }
      }
    }

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "สร้างการ์ดไม่ได้สักใบ — เช็คว่ามีบิล/ตั้งค่า LIFF แล้ว" },
        { status: 400 }
      );
    }
    try {
      await pushLineMessage(to, messages);
      return NextResponse.json({ ok: true, sent: messages.length });
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

    // เงื่อนไขก่อนเข้าพัก → ส่งเป็น "การ์ด" พร้อมปุ่มไปหน้ากดยอมรับ
    if (action === "send_consent") {
      const url = await getConsentUrl(b.id);
      if (!url) {
        return NextResponse.json(
          { error: "ยังไม่ได้ตั้ง LIFF ID — ไป Admin → ติดตั้ง เพื่อตั้งค่าก่อน" },
          { status: 400 }
        );
      }
      const flex = buildConsentFlex({
        businessName: cfg.business.name,
        title: cfg.messages.consentTitle || DEFAULT_MESSAGES.consentTitle,
        catName: String(b.catName),
        checkin: b.checkin || b.date,
        checkout: b.checkout,
        room: b.room,
        terms: cfg.messages.consentTerms?.length
          ? cfg.messages.consentTerms
          : DEFAULT_MESSAGES.consentTerms,
        url,
      });
      try {
        await pushLineMessage(to, [flex]);
        return NextResponse.json({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    // แจ้งเข้าพัก → การ์ดเดียว: รายละเอียดเตรียมตัว + ปุ่มไปกดยอมรับเงื่อนไข
    if (action === "send_prestay") {
      const url = await getConsentUrl(b.id);
      const flex = buildPrestayFlex({
        ...buildPrestayFlexData(b, cfg),
        consentUrl: url || undefined,
      });
      try {
        await pushLineMessage(to, [flex]);
        return NextResponse.json({ ok: true });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    let text: string | null = null;
    {
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
