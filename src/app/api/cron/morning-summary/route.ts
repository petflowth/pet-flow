import { NextRequest, NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram";
import { buildMorningSummaryMessage } from "@/lib/telegram-commands";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron 08:00 น. ไทย (01:00 UTC) — สรุปเช้า: งานของวันนี้ทั้งหมด ส่งเข้า Telegram เจ้าของ */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    const msg = await buildMorningSummaryMessage(today);
    const res = await sendTelegram(msg);
    return NextResponse.json({ ok: res.ok, today });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
