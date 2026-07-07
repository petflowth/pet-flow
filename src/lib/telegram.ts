/**
 * Telegram Bot — แจ้งเตือนเจ้าของเมื่อมีจอง / ลูกค้ายืนยัน
 * ตั้งค่า: TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_IDS (คั่นด้วย comma)
 */

export async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chats = (process.env.TELEGRAM_OWNER_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token || !chats.length) return { ok: false, reason: "not_configured" };

  const results = await Promise.all(
    chats.map(async (chatId) => {
      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
          }),
        }
      );
      return res.ok;
    })
  );

  return { ok: results.every(Boolean) };
}

export function formatBookingTelegram(
  title: string,
  detail: Record<string, string>
) {
  const lines = Object.entries(detail)
    .map(([k, v]) => `<b>${k}</b>: ${v}`)
    .join("\n");
  return `🐱 <b>CatCha Hotel</b>\n${title}\n\n${lines}`;
}
