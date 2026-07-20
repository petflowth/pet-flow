import { NextRequest, NextResponse } from "next/server";
import { cleanupOldBroadcastImages } from "@/lib/broadcast-cleanup";
import { sendTelegram } from "@/lib/telegram";

/** Cron รายเดือน — รีดพื้นที่ฐานข้อมูลคืน โดยลบรูปโปร broadcast เก่าที่ค้างเป็น base64 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await cleanupOldBroadcastImages();

  if (result.ok && result.removed > 0) {
    await sendTelegram(
      `🧹 <b>ล้างพื้นที่รายเดือน</b>\n` +
        `ลบรูปโปร broadcast เก่า (เกิน ${result.keepDays} วัน): ${result.removed} รูป`
    );
  } else if (!result.ok && result.error !== "no-supabase") {
    await sendTelegram(`⚠️ ล้างพื้นที่รายเดือนล้มเหลว: ${result.error}`);
  }

  return NextResponse.json(result);
}
