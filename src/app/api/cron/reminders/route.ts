import { NextRequest, NextResponse } from "next/server";
import { listBookings } from "@/lib/bookings-store";
import { listInvoices } from "@/lib/invoices-store";
import { getSiteConfig } from "@/lib/config-store";
import { buildBookingConfirmFlex } from "@/lib/booking-line-card";
import {
  pushLineMessage,
  buildPrestayFlex,
  buildTimePickerFlex,
  buildReviewRequestFlex,
  buildGroomInfoFlex,
} from "@/lib/line";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import {
  buildDepositReminderText,
  buildPrestayFlexData,
  buildCheckinBodyText,
  buildCheckoutBodyText,
  buildGroomInfoBody,
  getBookingTimeUrl,
  getGroomInfoUrl,
  getConsentUrl,
} from "@/lib/booking-reminders";
import { listCustomers } from "@/lib/customers-store";
import { renderTemplate } from "@/lib/messages";

function addDays(dateStr: string, n: number) {
  const dt = new Date(`${dateStr}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Cron 12:00 น. ไทย (05:00 UTC) — ยืนยันนัดพรุ่งนี้ + เตือนมัดจำ 7 วัน + รายละเอียดเข้าพัก 3 วันก่อน */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cfg = await getSiteConfig();
  const auto = cfg.automation;
  const errors: string[] = [];
  let sent = 0;
  let groomInfoCards = 0;

  const todayStr = new Date().toISOString().slice(0, 10);
  const allBookings = await listBookings();
  const allInvoices = await listInvoices();

  // ── ยืนยันนัด ล่วงหน้า N วัน (ตั้งค่าได้ · เปิด/ปิดได้) ──
  const confirmDate = addDays(todayStr, auto?.confirmDaysBefore ?? 1);
  const confirmList =
    auto?.confirmTomorrowEnabled === false
      ? []
      : allBookings.filter(
          (b) =>
            b.lineUserId &&
            b.status !== "cancelled" &&
            (b.checkin || b.date) === confirmDate
        );
  for (const b of confirmList) {
    if (!b.lineUserId) continue;
    try {
      const flex = await buildBookingConfirmFlex({
        id: b.id,
        catName: b.catName,
        customerName: b.customerName,
        service: b.service,
        date: b.date,
        time: b.time,
        checkin: b.checkin,
        checkout: b.checkout,
        room: b.room,
        notes: b.notes,
      });
      await pushLineMessage(b.lineUserId, [flex]);
      sent++;

      // พ่วงการ์ดสอบถามประวัติน้อง สำหรับนัดอาบน้ำ (ส่งต่อจากยืนยันนัด)
      if (auto?.groomInfoEnabled !== false && b.service === "groom") {
        const url = await getGroomInfoUrl(b.id);
        const groomFlex = buildGroomInfoFlex({
          catName: b.catName,
          dateText: b.date ? `📅 นัดอาบน้ำ: ${b.date}${b.time ? ` ${b.time}` : ""}` : undefined,
          body: buildGroomInfoBody(b, cfg),
          url: url || undefined,
          label: "🩺 แจ้งประวัติน้อง",
        });
        await pushLineMessage(b.lineUserId, [groomFlex]);
        groomInfoCards++;
      }
    } catch (e) {
      errors.push(`${b.id}: ${String(e)}`);
    }
  }

  // ── เตือนก่อนเข้าพัก (ห้องพัก) — จำนวนวันตั้งค่าได้ในหลังบ้าน ──
  const in7 = addDays(todayStr, auto?.depositReminderDays ?? 7);
  const in3 = addDays(todayStr, auto?.prestayReminderDays ?? 3);
  const inCheckin = addDays(todayStr, auto?.checkinReminderDays ?? 1);
  const inCheckout = addDays(todayStr, auto?.checkoutReminderDays ?? 1);
  const afterCheckoutReview = addDays(todayStr, -(auto?.reviewRequestDaysAfter ?? 1));
  const consentUrl = await getConsentUrl();

  let depositReminders = 0;
  let prestayReminders = 0;
  let checkinReminders = 0;
  let checkoutReminders = 0;
  let reviewRequests = 0;

  for (const b of allBookings) {
    if (b.service !== "room" || !b.lineUserId || b.status === "cancelled") continue;

    // #1 — แจ้งยอดคงเหลือ N วันก่อนเข้าพัก (ถ้ามีมัดจำ + ยังค้าง)
    if (auto?.depositReminderEnabled !== false && b.checkin === in7) {
      const inv = allInvoices.find(
        (i) => i.bookingId === b.id && i.status === "pending" && (i.deposit || 0) > 0
      );
      if (inv) {
        const text = buildDepositReminderText(b, inv, cfg);
        if (text) {
          try {
            await pushLineMessage(b.lineUserId, [{ type: "text", text }]);
            depositReminders++;
          } catch (e) {
            errors.push(`deposit ${b.id}: ${String(e)}`);
          }
        }
      }
    }

    // #4 — แจ้งรายละเอียด + เงื่อนไข N วันก่อนเข้าพัก (วันแรกพอ)
    if (auto?.prestayReminderEnabled !== false && b.checkin === in3) {
      const flex = buildPrestayFlex({
        ...buildPrestayFlexData(b, cfg),
        consentUrl: consentUrl || undefined,
      });
      try {
        await pushLineMessage(b.lineUserId, [flex]);
        prestayReminders++;
      } catch (e) {
        errors.push(`prestay ${b.id}: ${String(e)}`);
      }
    }

    // เตือนเช็คอิน N วันก่อนเข้าพัก → การ์ดให้ลูกค้าเลือกเวลามาส่งน้อง
    if (auto?.checkinReminderEnabled !== false && b.checkin === inCheckin) {
      const url = await getBookingTimeUrl(b.id, "checkin");
      const flex = buildTimePickerFlex({
        title: "🕒 เลือกเวลาเข้าพัก",
        body: buildCheckinBodyText(b, cfg),
        url: url || undefined,
        label: "🕒 เลือกเวลาส่งน้อง",
      });
      try {
        await pushLineMessage(b.lineUserId, [flex]);
        checkinReminders++;
      } catch (e) {
        errors.push(`checkin ${b.id}: ${String(e)}`);
      }
    }

    // เตือนเช็คเอาท์ N วันก่อนออก → การ์ดให้ลูกค้าเลือกเวลามารับน้อง
    if (
      auto?.checkoutReminderEnabled !== false &&
      b.checkout &&
      b.checkout === inCheckout
    ) {
      const url = await getBookingTimeUrl(b.id, "checkout");
      const flex = buildTimePickerFlex({
        title: "🕒 เลือกเวลารับน้อง",
        body: buildCheckoutBodyText(b, cfg),
        url: url || undefined,
        label: "🕒 เลือกเวลารับน้อง",
      });
      try {
        await pushLineMessage(b.lineUserId, [flex]);
        checkoutReminders++;
      } catch (e) {
        errors.push(`checkout ${b.id}: ${String(e)}`);
      }
    }

    // ⭐ ขอรีวิว หลังเช็คเอาท์ (แยกจากใบเสร็จ — ลูกค้าใช้บริการจริงแล้ว)
    if (
      auto?.reviewRequestEnabled !== false &&
      b.checkout &&
      b.checkout === afterCheckoutReview
    ) {
      const reviewUrl = cfg.business.reviewUrl || cfg.business.maps;
      if (reviewUrl) {
        const flex = buildReviewRequestFlex({
          title: "⭐ ขอบคุณที่ใช้บริการค่ะ",
          body: renderTemplate(cfg.messages.reviewRequest, {
            shop: cfg.business.name,
            cat: b.catName,
          }),
          reviewUrl,
          reviewLabel: cfg.business.reviewButtonText,
        });
        try {
          await pushLineMessage(b.lineUserId, [flex]);
          reviewRequests++;
        } catch (e) {
          errors.push(`review ${b.id}: ${String(e)}`);
        }
      }
    }
  }

  // ── 🎂 อวยพรวันเกิดแมว (เฉพาะลูกค้าที่ยินยอมรับข่าวสาร · เปิด/ปิดได้) ──
  let birthdayGreetings = 0;
  const mmdd = todayStr.slice(5); // "MM-DD"
  try {
    if (auto?.birthdayEnabled === false) {
      // ปิดอวยพรวันเกิด — ข้าม
    } else {
    const allCustomers = await listCustomers();
    for (const c of allCustomers) {
      if (!c.lineUserId || c.marketingConsent === false) continue;
      const bdayCat = c.cats.find((cat) => cat.birthday && cat.birthday.slice(5) === mmdd);
      if (!bdayCat) continue;
      const text = renderTemplate(cfg.messages.birthdayGreeting, {
        shop: cfg.business.name,
        name: c.name,
        cat: bdayCat.name || "น้องแมว",
      });
      try {
        await pushLineMessage(c.lineUserId, [{ type: "text", text }]);
        birthdayGreetings++;
      } catch (e) {
        errors.push(`birthday ${c.id}: ${String(e)}`);
      }
    }
    }
  } catch (e) {
    errors.push(`birthday-scan: ${String(e)}`);
  }

  if (
    confirmList.length > 0 ||
    depositReminders > 0 ||
    prestayReminders > 0 ||
    checkinReminders > 0 ||
    checkoutReminders > 0 ||
    reviewRequests > 0 ||
    groomInfoCards > 0 ||
    birthdayGreetings > 0
  ) {
    await sendTelegram(
      formatBookingTelegram("⏰ เตือนอัตโนมัติ 12:00", {
        ยืนยันนัด: String(confirmList.length),
        ส่งการ์ดสำเร็จ: String(sent),
        แจ้งยอดคงเหลือ: String(depositReminders),
        แจ้งเข้าพัก: String(prestayReminders),
        เตือนเช็คอิน: String(checkinReminders),
        เตือนเช็คเอาท์: String(checkoutReminders),
        ขอรีวิว: String(reviewRequests),
        ประวัติก่อนอาบน้ำ: String(groomInfoCards),
        อวยพรวันเกิดแมว: String(birthdayGreetings),
      })
    );
  }

  return NextResponse.json({
    ok: true,
    due: confirmList.length,
    sent,
    depositReminders,
    prestayReminders,
    checkinReminders,
    checkoutReminders,
    reviewRequests,
    groomInfoCards,
    birthdayGreetings,
    errors,
  });
}
