import { NextRequest, NextResponse } from "next/server";

/**
 * Telegram webhook — รับคำสั่งจากเจ้าของ
 * /start → แสดง chat id สำหรับตั้งค่า TELEGRAM_OWNER_CHAT_IDS
 * /today → ดูนัดวันนี้ (ต่อ DB ทีหลัง)
 */
export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const body = await req.json();
  const message = body.message;
  if (!message?.text || !message.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = String(message.text).trim();

  let reply = "";
  if (text === "/start") {
    reply =
      `🐱 สวัสดีจาก CatCha Hotel Bot\n\n` +
      `Chat ID ของคุณ: <code>${chatId}</code>\n` +
      `นำไปใส่ใน TELEGRAM_OWNER_CHAT_IDS เพื่อรับแจ้งเตือนจอง`;
  } else if (text === "/today") {
    reply = "📅 นัดวันนี้ — ต่อฐานข้อมูลแล้วจะแสดงรายการจริง";
  } else if (text === "/help") {
    reply = "คำสั่ง: /start /today /help";
  } else {
    reply = "พิมพ์ /help ดูคำสั่ง";
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: reply,
      parse_mode: "HTML",
    }),
  });

  return NextResponse.json({ ok: true });
}
