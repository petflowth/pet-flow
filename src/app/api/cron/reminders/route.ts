import { NextRequest, NextResponse } from "next/server";
import { bookingsTomorrow, listBookings } from "@/lib/bookings-store";
import { listInvoices } from "@/lib/invoices-store";
import { getSiteConfig } from "@/lib/config-store";
import { buildBookingConfirmFlex } from "@/lib/booking-line-card";
import { pushLineMessage } from "@/lib/line";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { renderTemplate } from "@/lib/messages";
import { getLineCredentials } from "@/lib/line-config";
import { buildConsentUrl } from "@/lib/liff-urls";

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
  const pay = cfg.payment;
  const shopName = cfg.business.name;
  const liffId = (await getLineCredentials())?.liffId;
  const consentUrl = liffId ? buildConsentUrl(liffId) : "";
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
        const remaining = inv.total - (inv.deposit || 0);
        if (remaining > 0) {
          const text = renderTemplate(cfg.messages.depositReminder, {
            shop: shopName,
            cat: b.catName,
            checkin: b.checkin || "",
            deposit: (inv.deposit || 0).toLocaleString(),
            remaining: remaining.toLocaleString(),
            bank: pay.bankName,
            accountNumber: pay.accountNumber,
            accountName: pay.accountName,
          });
          try {
            await pushLineMessage(b.lineUserId, [{ type: "text", text }]);
            depositReminders++;
          } catch (e) {
            errors.push(`deposit ${b.id}: ${String(e)}`);
          }
        }
      }
    }

    // #4 — 3 วันก่อนเข้าพัก (วันแรกพอ): รายละเอียด + สิ่งที่ต้องเตรียม
    if (b.checkin === in3) {
      let text = renderTemplate(cfg.messages.prestayReminder, {
        shop: shopName,
        cat: b.catName,
        checkin: b.checkin || "",
        checkout: b.checkout ? `→ ${b.checkout}` : "",
        room: b.room ? `🏠 ห้อง: ${b.room}` : "",
        consentUrl,
      });
      // แนบลิงก์กดยอมรับข้อตกลง (ถ้ายังไม่มีในข้อความ)
      if (consentUrl && !text.includes(consentUrl)) {
        text += `\n\n📋 กรุณาอ่านและกดยอมรับข้อตกลงก่อนเข้าพักที่นี่นะคะ 🧡\n${consentUrl}`;
      }
      try {
        await pushLineMessage(b.lineUserId, [{ type: "text", text }]);
        prestayReminders++;
      } catch (e) {
        errors.push(`prestay ${b.id}: ${String(e)}`);
      }
    }
  }

  if (tomorrow.length > 0 || depositReminders > 0 || prestayReminders > 0) {
    await sendTelegram(
      formatBookingTelegram("⏰ เตือนอัตโนมัติ 12:00", {
        นัดพรุ่งนี้: String(tomorrow.length),
        ส่งการ์ดสำเร็จ: String(sent),
        แจ้งยอดคงเหลือ7วัน: String(depositReminders),
        แจ้งเข้าพัก3วัน: String(prestayReminders),
      })
    );
  }

  return NextResponse.json({
    ok: true,
    due: tomorrow.length,
    sent,
    depositReminders,
    prestayReminders,
    errors,
  });
}
