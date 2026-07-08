import { NextRequest, NextResponse } from "next/server";
import { sendInactiveFollowUps } from "@/lib/customer-crm";
import { sendTelegram } from "@/lib/telegram";
import { getSiteConfig } from "@/lib/config-store";

/** Cron — ส่งข้อความตามลูกค้าที่หายไปนาน (แนะนำ 09:00 น. ไทย) */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const config = await getSiteConfig();
  const result = await sendInactiveFollowUps({ limit: 30 });

  if (result.sent > 0 || result.eligible > 0) {
    await sendTelegram(
      `😴 <b>ตามลูกค้าที่หายไป</b>\n` +
        `เกณฑ์: ${config.crm.inactiveDays} วัน\n` +
        `ส่งสำเร็จ: ${result.sent}/${result.total}\n` +
        `พร้อมส่ง: ${result.eligible} คน`
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
