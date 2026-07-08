import { NextRequest, NextResponse } from "next/server";
import { bookingsTomorrow } from "@/lib/bookings-store";
import { buildBookingConfirmFlex } from "@/lib/booking-line-card";
import { pushLineMessage } from "@/lib/line";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** Cron 12:00 น. ไทย (05:00 UTC) — ส่งการ์ดยืนยันนัดลูกค้าที่มีนัดพรุ่งนี้ */
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

  if (tomorrow.length > 0) {
    await sendTelegram(
      formatBookingTelegram("⏰ เตือนอัตโนมัติ 12:00", {
        นัดพรุ่งนี้: String(tomorrow.length),
        ส่งการ์ดสำเร็จ: String(sent),
      })
    );
  }

  return NextResponse.json({
    ok: true,
    due: tomorrow.length,
    sent,
    errors,
  });
}
