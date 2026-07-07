import { NextRequest, NextResponse } from "next/server";
import { bookingsForDate } from "@/lib/bookings-store";

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
    const today = new Date().toISOString().slice(0, 10);
    const list = bookingsForDate(today);
    if (!list.length) {
      reply = "📅 วันนี้ยังไม่มีนัดในระบบ";
    } else {
      reply =
        `📅 นัดวันนี้ (${today})\n\n` +
        list
          .map(
            (b, i) =>
              `${i + 1}. ${b.catName} · ${b.customerName}\n` +
              `   ${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} ${b.time || ""} · ${b.status === "confirmed" ? "✅" : "⏳"}`
          )
          .join("\n\n");
    }
  } else if (text === "/help") {
    reply = "คำสั่ง:\n/start — ดู Chat ID\n/today — นัดวันนี้\n/help";
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
