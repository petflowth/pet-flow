import { NextRequest, NextResponse } from "next/server";
import { bookingsTomorrow, listBookings } from "@/lib/bookings-store";
import { listInvoices } from "@/lib/invoices-store";
import { getSiteConfig } from "@/lib/config-store";
import { buildBookingConfirmFlex } from "@/lib/booking-line-card";
import { pushLineMessage, buildPrestayFlex } from "@/lib/line";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import {
  buildDepositReminderText,
  buildPrestayBodyText,
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

  const tomorrow = await bookingsTomorrow();
  let sent = 0;
  const errors: string[] = [];

  for (const b of tomorrow) {
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
    } catch (e) {
      errors.push(`${b.id}: ${String(e)}`);
    }
  }

  // ── เตือนก่อนเข้าพัก (ห้องพัก) — ยอดคงเหลือ 7 วันก่อน + รายละเอียด 3 วันก่อน ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const in7 = addDays(todayStr, 7);
  const in3 = addDays(todayStr, 3);
  const cfg = await getSiteConfig();
  const consentUrl = await getConsentUrl();
  const allBookings = await listBookings();
  const allInvoices = await listInvoices();

  let depositReminders = 0;
  let prestayReminders = 0;

  for (const b of allBookings) {
    if (b.service !== "room" || !b.lineUserId || b.status === "cancelled") continue;

    // #1 — 7 วันก่อนเข้าพัก: แจ้งยอดคงเหลือ (ถ้ามีมัดจำ + ยังค้าง)
    if (b.checkin === in7) {
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

    // #4 — 3 วันก่อนเข้าพัก (วันแรกพอ): การ์ดเดียว = รายละเอียด + ปุ่มยอมรับเงื่อนไข
    if (b.checkin === in3) {
      const flex = buildPrestayFlex({
        body: buildPrestayBodyText(b, cfg),
        consentUrl: consentUrl || undefined,
      });
      try {
        await pushLineMessage(b.lineUserId, [flex]);
        prestayReminders++;
      } catch (e) {
        errors.push(`prestay ${b.id}: ${String(e)}`);
      }
    }
  }

  // ── 🎂 อวยพรวันเกิดแมว (เฉพาะลูกค้าที่ยินยอมรับข่าวสาร) ──
  let birthdayGreetings = 0;
  const mmdd = todayStr.slice(5); // "MM-DD"
  try {
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
  } catch (e) {
    errors.push(`birthday-scan: ${String(e)}`);
  }

  if (
    tomorrow.length > 0 ||
    depositReminders > 0 ||
    prestayReminders > 0 ||
    birthdayGreetings > 0
  ) {
    await sendTelegram(
      formatBookingTelegram("⏰ เตือนอัตโนมัติ 12:00", {
        นัดพรุ่งนี้: String(tomorrow.length),
        ส่งการ์ดสำเร็จ: String(sent),
        แจ้งยอดคงเหลือ7วัน: String(depositReminders),
        แจ้งเข้าพัก3วัน: String(prestayReminders),
        อวยพรวันเกิดแมว: String(birthdayGreetings),
      })
    );
  }

  return NextResponse.json({
    ok: true,
    due: tomorrow.length,
    sent,
    depositReminders,
    prestayReminders,
    birthdayGreetings,
    errors,
  });
}
