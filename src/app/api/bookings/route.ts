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
  deleteBooking,
  type StoredBooking,
} from "@/lib/bookings-store";
import { AUTO_MESSAGE_TOPICS } from "@/lib/auto-messages";
import { bookingMatchesCustomer } from "@/lib/booking-customer-match";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withResolvedTenant, withTenant } from "@/lib/tenant-context";
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
  buildReviewRequestFlex,
  reviewMessageFor,
  buildReceiptFlex,
  buildDepositThanksFlex,
} from "@/lib/line";
import { buildBookingConfirmFlex } from "@/lib/booking-line-card";
import {
  findCustomerForBooking,
  recalculateCustomerTier,
  adjustDepositCredit,
  getCatGroomInfo,
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

/** ล็อกอินหลังบ้านอยู่ไหม — route นี้ใช้ร่วมกันทั้งแอปลูกค้าและหลังบ้าน */
async function getAdminSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId") || undefined;
  const session = await getAdminSession(req);
  // ไม่ได้ล็อกอิน = แอปลูกค้า → ดูได้เฉพาะนัดของตัวเอง ห้ามดึงทั้งร้าน
  if (!lineUserId && !session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session) return withTenant(session.tenantId, () => handleGet(lineUserId));
  return withResolvedTenant(req, () => handleGet(lineUserId));
}

async function handleGet(lineUserId?: string) {
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
      autoOff: b.autoOff || [],
      groomProgram: b.groomProgram,
      customerId: customer?.id,
    };
  });
  return NextResponse.json({ bookings: items });
}

export async function POST(req: NextRequest) {
  // หลังบ้านเท่านั้น — ลูกค้าจองเองมีเส้นทางของตัวเองที่ /api/bookings/self (ตรวจสิทธิ์+ความว่างครบ)
  // route นี้อยู่ใน SHARED_API (middleware ปล่อยผ่าน) ถ้าไม่เช็คตรงนี้ ใครก็สร้างนัด/ลูกค้าปลอมได้
  const session = await getAdminSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withTenant(session.tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
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
    groomProgram: body.groomProgram ? String(body.groomProgram) : undefined,
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
  const session = await getAdminSession(req);
  if (session) return withTenant(session.tenantId, () => handlePatch(req, true));
  return withResolvedTenant(req, () => handlePatch(req, false));
}

async function handlePatch(req: NextRequest, admin: boolean) {
  const body = await req.json().catch(() => ({}));
  const { id, action, lineUserId, checkinTime } = body;
  const b = await getBooking(id);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });

  // ลูกค้าใน LINE ทำได้อย่างเดียวคือกดยืนยันนัด "ของตัวเอง"
  // การกระทำอื่นทั้งหมด (ยกเลิก แก้ไข ส่งการ์ด เรียกเก็บเงิน) ต้องล็อกอินหลังบ้าน
  if (!admin) {
    const ownsBooking = !!lineUserId && b.lineUserId === lineUserId;
    if (action !== "confirm" || !ownsBooking) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // นัดที่ลูกค้าจองเอง — ร้านเท่านั้นที่ยืนยันได้ ต้องกันที่ API ด้วย ไม่ใช่แค่ซ่อนปุ่ม
    // (ไม่งั้นยังจองเอง-ยืนยันเองได้ผ่านการ์ด LINE เก่าหรือยิง API ตรง)
    if (b.selfBooked) {
      return NextResponse.json(
        { error: "waiting_shop_confirm", message: "รอร้านยืนยันคิวนะคะ" },
        { status: 403 }
      );
    }
  }

  let notifyError: string | undefined;
  if (action === "confirm") {
    // ต้องเช็คสถานะ "ก่อน" อัปเดต — กันส่งข้อความซ้ำถ้ากดยืนยันซ้ำ/ลูกค้ากดยืนยันหลังร้านยืนยันไปแล้ว
    const wasNotYetConfirmed = b.status !== "confirmed";
    await updateBooking(id, { status: "confirmed", checkinTime });

    // แจ้งลูกค้าทันทีว่าได้คิวแล้ว — คนละเรื่องกับการ์ดเตือนล่วงหน้าก่อนถึงวันจริง (send_reminder / cron)
    // ส่งเฉพาะตอน "ร้าน" เป็นคนยืนยัน — ลูกค้ากดตอบรับเองในแอปไม่ต้องส่งซ้ำ (เขาเพิ่งกดเองเห็นผลอยู่แล้ว
    // ส่งไปก็เปลืองโควตาข้อความ LINE ฟรี ๆ)
    // ส่งไม่สำเร็จก็ยังยืนยันนัดต่อไปได้ (ไม่บล็อก) แต่ต้องบอก staff ว่าลูกค้าไม่ได้รับ ไม่ใช่เงียบไปเฉยๆ
    if (wasNotYetConfirmed && admin && b.lineUserId) {
      try {
        const cfg = await getSiteConfig();
        if (cfg.automation?.bookingApprovedEnabled !== false) {
          const text = renderTemplate(
            cfg.messages.bookingApprovedText || DEFAULT_MESSAGES.bookingApprovedText,
            {
              shop: cfg.business.name,
              cat: b.catName,
              when: bookingScheduleText(b),
            }
          );
          await pushLineMessage(b.lineUserId, [{ type: "text", text }]);
        }
      } catch (e) {
        notifyError = e instanceof Error ? e.message : String(e);
      }
    }

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
    return NextResponse.json({ ok: true, booking: toBooking(updated!), notifyError });
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
        groomProgram: b.groomProgram,
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
      dateText: b.date
        ? `${cfg.cards?.groomInfo?.texts?.datePrefix || "📅 นัดอาบน้ำ:"} ${b.date}${b.time ? ` ${b.time}` : ""}`
        : undefined,
      body: buildGroomInfoBody(b, cfg),
      url: url || undefined,
      label: cfg.cards?.groomInfo?.texts?.button || "🩺 แจ้งประวัติน้อง",
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
      dateText: b.date
        ? `${cfg.cards?.groomInfo?.texts?.datePrefix || "📅 นัดอาบน้ำ:"} ${b.date}${b.time ? ` ${b.time}` : ""}`
        : undefined,
      body: buildGroomInfoBody(
        { catName: bookings.length > 1 ? `น้องๆ ${bookings.length} ตัว` : catNames },
        cfg
      ),
      url: url || undefined,
      label:
        bookings.length > 1
          ? `${cfg.cards?.groomInfo?.texts?.button || "🩺 แจ้งประวัติน้อง"} (${bookings.length} ตัว)`
          : cfg.cards?.groomInfo?.texts?.button || "🩺 แจ้งประวัติน้อง",
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
          }, cfg.cards?.timePicker)
        : buildTimePickerFlex({
            title: "🕒 เลือกเวลารับน้อง",
            body: buildCheckoutBodyText(b, cfg),
            url: url || undefined,
            label: "🕒 เลือกเวลารับน้อง",
          }, cfg.cards?.timePicker);
    try {
      await pushLineMessage(to, [flex]);
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── 📦 ส่งชุดการ์ดที่เลือกเอง — หลายการ์ดใน push เดียว (LINE นับเป็น 1 ข้อความ) ──
  // parts: reminder | prestay | consent | groomInfo | checkin | checkout
  //        | deposit(+depositAmount) | depositThanks | summary | payment
  //        | receipt (เฉพาะบิลที่จ่ายแล้ว) | review
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
    /** การ์ดที่ระบบข้ามให้ พร้อมเหตุผล — ส่งกลับไปบอกพนักงานที่หน้าจอ */
    const skipped: string[] = [];

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
            groomProgram: b.groomProgram,
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
      } else if (part === "prestay") {
        const url = await getConsentUrl(b.id);
        messages.push(
          buildPrestayFlex({
            ...buildPrestayFlexData(b, cfg),
            consentUrl: url || undefined,
          }, cfg.cards?.prestay)
        );
      } else if (part === "receipt" || part === "depositThanks") {
        const all = await listInvoices();
        const inv =
          all.find((i) => i.bookingId === b.id && i.status === "paid") ||
          all.find((i) => i.bookingId === b.id);
        if (inv && part === "receipt" && inv.status === "paid") {
          messages.push(
            buildReceiptFlex({
              invoiceId: inv.id,
              customerName: inv.customerName,
              catName: inv.catName,
              total: inv.total,
              discount: inv.discount,
              promoLabel: inv.promoLabel,
              pointsEarned: inv.pointsEarned || 0,
              shopName: cfg.business.name,
              paymentMethod:
                inv.paymentMethod === "member_credit"
                  ? "Member Credit"
                  : inv.paymentMethod === "cash"
                    ? "เงินสด"
                    : "โอนเงิน",
            }, cfg.cards?.receipt)
          );
        }
        if (inv && part === "depositThanks" && (inv.deposit || 0) > 0) {
          messages.push(
            buildDepositThanksFlex({
              title: cfg.messages.depositThanksTitle,
              body: renderTemplate(cfg.messages.depositThanksBody, {
                name: inv.customerName,
                cat: inv.catName,
                amount: (inv.deposit || 0).toLocaleString(),
              }),
              terms: cfg.messages.depositTerms || [],
              amount: inv.deposit || 0,
            }, cfg.cards?.depositThanks)
          );
        }
      } else if (part === "summary" || part === "review") {
        const all = await listInvoices();
        const inv =
          all.find((i) => i.bookingId === b.id && i.status !== "paid") ||
          all.find((i) => i.bookingId === b.id);
        if (inv && part === "summary") {
          const payment = await getPaymentConfig();
          messages.push(
            buildBillSummaryFlex({
              mode: "booking",
              title: cfg.billing.summaryBookingTitle,
              closing: "",
              customerName: inv.customerName,
              catName: inv.catName,
              scheduleText: bookingScheduleText(b),
              items: inv.items,
              subtotal: inv.subtotal,
              discount: inv.discount,
              promoLabel: inv.promoLabel,
              total: inv.total,
              deposit: inv.deposit || 0,
              remaining: Math.max(0, inv.total - (inv.deposit || 0)),
              bankName: payment.bankName,
              accountNumber: payment.accountNumber,
              accountName: payment.accountName,
            }, cfg.cards?.billSummary)
          );
        }
        if (inv && part === "review") {
          const reviewUrl = cfg.business.reviewUrl || cfg.business.maps;
          if (reviewUrl) {
            const hasGroom = (inv.items || []).some(
              (it) =>
                it.kind === "grooming" ||
                /อาบน้ำ|กรูม|premium|malaseb/i.test(it.label)
            );
            const hasRoom = (inv.items || []).some((it) => /คืน|ห้อง/.test(it.label));
            const msg = reviewMessageFor(hasGroom, hasRoom, cfg.business.name, cfg.cards?.review);
            messages.push(
              buildReviewRequestFlex({
                title: msg.title,
                body: msg.body,
                reviewUrl,
                reviewLabel: cfg.business.reviewButtonText,
              }, cfg.cards?.review)
            );
          }
        }
      } else if (part === "groomInfo") {
        // เคยกรอกประวัติไว้แล้ว → ไม่ถามซ้ำ (ประวัติผูกกับตัวแมว ข้ามนัดก็ยังจำได้)
        // ถ้าอยากถามใหม่จริง ๆ ให้ใช้ปุ่มส่งเดี่ยว "ขอประวัติ" แทน
        const existing = to
          ? await getCatGroomInfo(to, String(b.catName))
          : undefined;
        if (existing) {
          skipped.push(`${b.catName}: เคยกรอกประวัติแล้ว ไม่ขอซ้ำ`);
        } else {
          const url = await getGroomInfoUrl(b.id);
          messages.push(
            buildGroomInfoFlex({
              catName: String(b.catName),
              dateText: b.date
                ? `${cfg.cards?.groomInfo?.texts?.datePrefix || "📅 นัดอาบน้ำ:"} ${b.date}${b.time ? ` ${b.time}` : ""}`
                : undefined,
              body: buildGroomInfoBody(b, cfg),
              url: url || undefined,
              label: cfg.cards?.groomInfo?.texts?.button || "🩺 แจ้งประวัติน้อง",
            }, cfg.cards?.groomInfo)
          );
        }
      } else if (part === "checkin" || part === "checkout") {
        const url = await getBookingTimeUrl(b.id, part);
        messages.push(
          part === "checkin"
            ? buildTimePickerFlex({
                title: "🕒 เลือกเวลาเข้าพัก",
                body: buildCheckinBodyText(b, cfg),
                url: url || undefined,
                label: "🕒 เลือกเวลาส่งน้อง",
              }, cfg.cards?.timePicker)
            : buildTimePickerFlex({
                title: "🕒 เลือกเวลารับน้อง",
                body: buildCheckoutBodyText(b, cfg),
                url: url || undefined,
                label: "🕒 เลือกเวลารับน้อง",
              }, cfg.cards?.timePicker)
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
                  ? cfg.cards?.billSummary?.texts?.remainingTitle || "แจ้งยอดคงเหลือที่ต้องโอน"
                  : cfg.billing.summaryFullTitle,
              closing: "",
              customerName: inv.customerName,
              catName: inv.catName,
              scheduleText: bookingScheduleText(b),
              items: inv.items,
              subtotal: inv.subtotal,
              discount: inv.discount,
              promoLabel: inv.promoLabel,
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
        {
          error: skipped.length
            ? `ไม่มีการ์ดให้ส่ง — ${skipped.join(", ")}`
            : "สร้างการ์ดไม่ได้สักใบ — เช็คว่ามีบิล/ตั้งค่า LIFF แล้ว",
        },
        { status: 400 }
      );
    }
    try {
      await pushLineMessage(to, messages);
      return NextResponse.json({ ok: true, sent: messages.length, skipped });
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
      }, cfg.cards?.prestay);
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
    if (body.groomProgram != null) patch.groomProgram = String(body.groomProgram) || undefined;
    // หัวข้อข้อความอัตโนมัติที่นัดนี้ไม่ต้องส่ง
    if (Array.isArray(body.autoOff)) {
      const valid = new Set(AUTO_MESSAGE_TOPICS.map((t) => t.id));
      patch.autoOff = body.autoOff.map(String).filter((t: string) => valid.has(t));
    }

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

  // ลบนัดทิ้งถาวร — เผื่อลงข้อมูลผิด (คนละเรื่องกับ cancel ที่แค่เปลี่ยนสถานะ)
  if (action === "delete") {
    if (b.calendarEventId) {
      await deleteCalendarEvent(b.calendarEventId);
    }
    await deleteBooking(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
