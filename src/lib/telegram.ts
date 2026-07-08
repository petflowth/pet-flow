/**
 * Telegram Bot — แจ้งเตือนเจ้าของเมื่อมีจอง / ลูกค้ายืนยัน
 * ตั้งค่า: TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_IDS (คั่นด้วย comma)
 */

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramCommand = {
  command: string;
  payload?: string;
};

/** ปุ่มเมนูด้านล่างแชท — กดได้เลย ไม่ต้องพิมพ์คำสั่ง */
export const TELEGRAM_MENU_BUTTONS = {
  today: "📅 นัดวันนี้",
  queue: "⏳ คิวรอยืนยัน",
  month: "🗓️ ตารางเดือน",
  sales: "💰 ยอดขายวันนี้",
  finance: "📒 การเงินวันนี้",
  customers: "👥 ลูกค้าล่าสุด",
  help: "❓ วิธีใช้",
} as const;

const MENU_TO_COMMAND: Record<string, string> = {
  [TELEGRAM_MENU_BUTTONS.today]: "/today",
  [TELEGRAM_MENU_BUTTONS.queue]: "/queue",
  [TELEGRAM_MENU_BUTTONS.month]: "/month",
  [TELEGRAM_MENU_BUTTONS.sales]: "/sales",
  [TELEGRAM_MENU_BUTTONS.finance]: "/finance",
  [TELEGRAM_MENU_BUTTONS.customers]: "/customers",
  [TELEGRAM_MENU_BUTTONS.help]: "/help",
};

export function getTelegramMenuKeyboard() {
  return {
    keyboard: [
      [
        { text: TELEGRAM_MENU_BUTTONS.today },
        { text: TELEGRAM_MENU_BUTTONS.queue },
      ],
      [
        { text: TELEGRAM_MENU_BUTTONS.month },
        { text: TELEGRAM_MENU_BUTTONS.sales },
      ],
      [
        { text: TELEGRAM_MENU_BUTTONS.finance },
        { text: TELEGRAM_MENU_BUTTONS.customers },
      ],
      [{ text: TELEGRAM_MENU_BUTTONS.help }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** แปลงข้อความจากปุ่มเมนู → คำสั่ง */
export function normalizeTelegramInput(text: string) {
  const trimmed = text.trim();
  return MENU_TO_COMMAND[trimmed] || trimmed;
}

/** รองรับ /start, /start@BotName, /start payload */
export function parseTelegramCommand(text: string): TelegramCommand {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return { command: "" };

  const [head, ...rest] = trimmed.split(/\s+/);
  const command = head.split("@")[0].toLowerCase();
  const payload = rest.join(" ").trim();
  return payload ? { command, payload } : { command };
}

export function getTelegramWebhookUrl() {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  ).replace(/\/$/, "");
  return base ? `${base}/api/telegram/webhook` : "";
}

async function telegramApi<T = unknown>(
  method: string,
  body?: Record<string, unknown>
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false as const, reason: "not_configured" as const };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean;
    description?: string;
  };

  return {
    ok: res.ok && data.ok !== false,
    status: res.status,
    data,
  };
}

export async function sendTelegramToChat(
  chatId: number | string,
  text: string,
  options?: { html?: boolean; showMenu?: boolean }
) {
  const html = options?.html !== false;
  const showMenu = options?.showMenu !== false;

  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: html ? "HTML" : undefined,
    reply_markup: showMenu ? getTelegramMenuKeyboard() : undefined,
  });
}

export async function sendTelegram(text: string) {
  const chats = (process.env.TELEGRAM_OWNER_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!process.env.TELEGRAM_BOT_TOKEN || !chats.length) {
    return { ok: false, reason: "not_configured" };
  }

  const results = await Promise.all(
    chats.map((chatId) => sendTelegramToChat(chatId, text))
  );

  return { ok: results.every((r) => r.ok) };
}

export async function getTelegramWebhookInfo() {
  return telegramApi("getWebhookInfo");
}

export async function setTelegramWebhook(url: string) {
  return telegramApi("setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function setTelegramBotCommands() {
  return telegramApi("setMyCommands", {
    commands: [
      { command: "today", description: "นัดวันนี้" },
      { command: "queue", description: "คิวรอยืนยัน" },
      { command: "month", description: "ตารางเดือนนี้" },
      { command: "sales", description: "ยอดขายวันนี้" },
      { command: "finance", description: "การเงินวันนี้" },
      { command: "customers", description: "ลูกค้าล่าสุด" },
      { command: "search", description: "ค้นหาลูกค้า เช่น /search ส้ม" },
      { command: "help", description: "วิธีใช้" },
    ],
  });
}

export function buildStartReply(chatId: number | string) {
  return (
    `🐱 <b>สวัสดีจาก CatCha Hotel Bot</b>\n\n` +
    `Chat ID ของคุณ: <code>${chatId}</code>\n` +
    `นำไปใส่ใน <code>TELEGRAM_OWNER_CHAT_IDS</code> บน Vercel เพื่อรับแจ้งเตือนจอง\n\n` +
    `👇 กดปุ่มเมนูด้านล่างได้เลย\n` +
    `หรือพิมพ์ /search ชื่อ เพื่อค้นหาลูกค้า`
  );
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
