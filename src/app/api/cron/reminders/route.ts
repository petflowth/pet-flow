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
  buildBillSummaryFlex,
} from "@/lib/line";
import { getPaymentConfig } from "@/lib/payment-config";
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
  bookingScheduleText,
} from "@/lib/booking-reminders";
import { listCustomers, getCatGroomInfo } from "@/lib/customers-store";
import { issueCoupon, listCustomerCoupons } from "@/lib/coupons-store";
import { parseGroomInfo, groomInfoSummary } from "@/lib/groom-info";
import { resolveGroomForm } from "@/lib/groom-form";
import { renderTemplate } from "@/lib/messages";
import { buildTomorrowPrepMessage } from "@/lib/telegram-commands";

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
  let groomBriefs = 0;

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
      // รวมการ์ดของวันนี้ไว้ใน push เดียว (เตือนนัด + ขอประวัติ ถ้าจำเป็น) — นับ 1 ข้อความ LINE
      const dayMessages: object[] = [
        await buildBookingConfirmFlex({
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
        }),
      ];

      // นัดอาบน้ำ: เคยกรอกประวัติแล้ว → บรีฟให้ร้าน · ยังไม่เคย → แนบการ์ดกรอกไปในข้อความเดียวกัน
      if (auto?.groomInfoEnabled !== false && b.service === "groom") {
        const info = parseGroomInfo(await getCatGroomInfo(b.lineUserId, b.catName));
        if (info) {
          await sendTelegram(
            formatBookingTelegram(`🩺 บรีฟก่อนอาบน้ำ: ${b.catName}`, {
              ลูกค้า: b.customerName,
              วันนัด: `${b.date || ""}${b.time ? ` ${b.time}` : ""}`,
              ...groomInfoSummary(info, resolveGroomForm(cfg.groomForm)),
            })
          );
          groomBriefs++;
        } else {
          const url = await getGroomInfoUrl(b.id);
          dayMessages.push(
            buildGroomInfoFlex({
              catName: b.catName,
              dateText: b.date ? `📅 นัดอาบน้ำ: ${b.date}${b.time ? ` ${b.time}` : ""}` : undefined,
              body: buildGroomInfoBody(b, cfg),
              url: url || undefined,
              label: "🩺 แจ้งประวัติน้อง",
            }, cfg.cards?.groomInfo)
          );
          groomInfoCards++;
        }
      }

      await pushLineMessage(b.lineUserId, dayMessages);
      sent++;
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

    // #4 — ชุดก่อนเข้าพัก N วัน: เตรียมตัว+เงื่อนไข + ยอดคงเหลือ (ถ้ามี) + เลือกเวลาเช็คอิน
    // รวมทั้งหมดใน push เดียว = นับ 1 ข้อความ LINE — ลิงก์ยอมรับชี้ที่นัดนี้เท่านั้น
    if (auto?.prestayReminderEnabled !== false && b.checkin === in3) {
      const consentUrl = await getConsentUrl(b.id);
      const prestayBundle: object[] = [
        buildPrestayFlex({
          ...buildPrestayFlexData(b, cfg),
          consentUrl: consentUrl || undefined,
        }, cfg.cards?.prestay),
      ];
      // มีบิลค้าง + มัดจำแล้ว → แนบการ์ดยอดคงเหลือที่ต้องโอนก่อนเข้าพัก
      const pendingInv = allInvoices.find(
        (i) => i.bookingId === b.id && i.status === "pending" && (i.deposit || 0) > 0
      );
      if (pendingInv && pendingInv.total - (pendingInv.deposit || 0) > 0) {
        const payment = await getPaymentConfig();
        prestayBundle.push(
          buildBillSummaryFlex({
            mode: "remaining",
            title: "แจ้งยอดคงเหลือที่ต้องโอนก่อนเข้าพัก",
            closing: "",
            customerName: pendingInv.customerName,
            catName: pendingInv.catName,
            scheduleText: bookingScheduleText(b),
            items: pendingInv.items,
            subtotal: pendingInv.subtotal,
            discount: pendingInv.discount,
            total: pendingInv.total,
            deposit: pendingInv.deposit || 0,
            remaining: Math.max(0, pendingInv.total - (pendingInv.deposit || 0)),
            bankName: payment.bankName,
            accountNumber: payment.accountNumber,
            accountName: payment.accountName,
          }, cfg.cards?.billSummary)
        );
      }
      // แนบการ์ดเลือกเวลาเช็คอินไปเลย — ไม่ต้องรอส่งแยกอีกวัน
      const checkinUrl = await getBookingTimeUrl(b.id, "checkin");
      prestayBundle.push(
        buildTimePickerFlex({
          title: "🕒 เลือกเวลาเข้าพัก",
          body: buildCheckinBodyText(b, cfg),
          url: checkinUrl || undefined,
          label: "🕒 เลือกเวลาส่งน้อง",
        }, cfg.cards?.timePicker)
      );
      try {
        await pushLineMessage(b.lineUserId, prestayBundle);
        prestayReminders++;
      } catch (e) {
        errors.push(`prestay ${b.id}: ${String(e)}`);
      }
    }

    // เตือนเช็คอิน N วันก่อนเข้าพัก → การ์ดให้ลูกค้าเลือกเวลามาส่งน้อง
    // (ข้ามถ้าลูกค้าเลือกเวลาแล้วจากชุดก่อนเข้าพัก — ไม่ถามซ้ำ)
    if (auto?.checkinReminderEnabled !== false && b.checkin === inCheckin && !b.arrivalTime) {
      const url = await getBookingTimeUrl(b.id, "checkin");
      const flex = buildTimePickerFlex({
        title: "🕒 เลือกเวลาเข้าพัก",
        body: buildCheckinBodyText(b, cfg),
        url: url || undefined,
        label: "🕒 เลือกเวลาส่งน้อง",
      }, cfg.cards?.timePicker);
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
      b.checkout === inCheckout &&
      !b.pickupTime
    ) {
      const url = await getBookingTimeUrl(b.id, "checkout");
      const flex = buildTimePickerFlex({
        title: "🕒 เลือกเวลารับน้อง",
        body: buildCheckoutBodyText(b, cfg),
        url: url || undefined,
        label: "🕒 เลือกเวลารับน้อง",
      }, cfg.cards?.timePicker);
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
        }, cfg.cards?.review);
        try {
          await pushLineMessage(b.lineUserId, [flex]);
          reviewRequests++;
        } catch (e) {
          errors.push(`review ${b.id}: ${String(e)}`);
        }
      }
    }
  }

  // ── 🎂 อวยพรวันเกิด (แมว/เจ้าของ) + แจกคูปองวันเกิด (เปิด/ปิดได้) ──
  let birthdayGreetings = 0;
  let birthdayCoupons = 0;
  const mmdd = todayStr.slice(5); // "MM-DD"
  const year = todayStr.slice(0, 4);
  try {
    if (auto?.birthdayEnabled === false) {
      // ปิดอวยพรวันเกิด — ข้าม
    } else {
    const allCustomers = await listCustomers();
    for (const c of allCustomers) {
      if (!c.lineUserId || c.marketingConsent === false) continue;
      const bdayCat = c.cats.find((cat) => cat.birthday && cat.birthday.slice(5) === mmdd);
      const ownerBday = Boolean(c.birthday && c.birthday.slice(5) === mmdd);
      if (!bdayCat && !ownerBday) continue;

      // แจกคูปองวันเกิด (ครั้งเดียวต่อปี)
      let couponLine = "";
      const amt = Math.round(auto?.birthdayCouponAmount ?? 100);
      if (auto?.birthdayCouponEnabled !== false && amt > 0) {
        try {
          const mine = await listCustomerCoupons(c.id);
          const already = mine.some(
            (cp) => /วันเกิด/.test(cp.reason) && cp.createdAt.slice(0, 4) === year
          );
          if (!already) {
            await issueCoupon({
              customerId: c.id,
              amount: amt,
              reason: `🎂 ของขวัญวันเกิด ${year}`,
              expiresInDays: 30,
            });
            birthdayCoupons++;
            couponLine = `\n\n🎁 ร้านมีของขวัญวันเกิดให้ — คูปองส่วนลด ${amt} บาท เก็บไว้ในกระเป๋าคูปองแล้วนะคะ (ใช้ได้ 30 วัน) 🎟️`;
          }
        } catch (e) {
          errors.push(`birthday-coupon ${c.id}: ${String(e)}`);
        }
      }

      const text =
        renderTemplate(cfg.messages.birthdayGreeting, {
          shop: cfg.business.name,
          name: c.name,
          cat: (bdayCat ? bdayCat.name : c.name) || "น้องแมว",
        }) + couponLine;
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
    groomBriefs > 0 ||
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
        บรีฟก่อนอาบน้ำ: String(groomBriefs),
        อวยพรวันเกิด: String(birthdayGreetings),
        คูปองวันเกิด: String(birthdayCoupons),
      })
    );
  }

  // เตรียมตัวพรุ่งนี้ — ส่งทุกวัน (ไม่ต้องรอมีเหตุการณ์อื่น) ให้ร้านวางแผนงานล่วงหน้าได้
  try {
    const tomorrow = addDays(todayStr, 1);
    await sendTelegram(await buildTomorrowPrepMessage(tomorrow));
  } catch (e) {
    errors.push(`tomorrow-prep: ${String(e)}`);
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
    groomBriefs,
    birthdayGreetings,
    birthdayCoupons,
    errors,
  });
}
