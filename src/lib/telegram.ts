/**
 * Telegram Bot — แจ้งเตือนเจ้าของเมื่อมีจอง / ลูกค้ายืนยัน
 * ตั้งค่า: หน้า Admin → ติดตั้ง หรือ env TELEGRAM_BOT_TOKEN
 */

import {
  ensureTelegramWebhook,
  getAppUrlFromEnv,
  getTelegramCredentials,
} from "./telegram-config";

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
  if (MENU_TO_COMMAND[trimmed]) return MENU_TO_COMMAND[trimmed];
  if (/คิว.*ยืนยัน/.test(trimmed)) return "/queue";
  if (/นัดวันนี้/.test(trimmed)) return "/today";
  if (/ตารางเดือน/.test(trimmed)) return "/month";
  if (/ยอดขาย/.test(trimmed)) return "/sales";
  if (/การเงิน/.test(trimmed)) return "/finance";
  if (/ลูกค้า/.test(trimmed)) return "/customers";
  if (/วิธีใช้|help/i.test(trimmed)) return "/help";
  return trimmed;
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

export function getTelegramWebhookUrl(appUrl?: string) {
  const base = (appUrl || getAppUrlFromEnv()).replace(/\/$/, "");
  return base ? `${base}/api/telegram/webhook` : "";
}

async function telegramApi<T = unknown>(
  token: string,
  method: string,
  body?: Record<string, unknown>
) {
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean;
    description?: string;
    error_code?: number;
  };

  return {
    ok: res.ok && data.ok !== false,
    status: res.status,
    data,
  };
}

export async function sendTelegramToChat(
  token: string,
  chatId: number | string,
  text: string,
  options?: { html?: boolean; showMenu?: boolean }
) {
  const html = options?.html !== false;
  const showMenu = options?.showMenu !== false;

  return telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: html ? "HTML" : undefined,
    reply_markup: showMenu ? getTelegramMenuKeyboard() : undefined,
  });
}

export async function sendTelegram(text: string) {
  const creds = await getTelegramCredentials();
  if (!creds?.botToken || !creds.ownerChatIds.length) {
    return { ok: false, reason: "not_configured" };
  }

  if (creds.appUrl) {
    await ensureTelegramWebhook(creds.botToken, creds.appUrl).catch(() => {});
  }

  const results = await Promise.all(
    creds.ownerChatIds.map((chatId) =>
      sendTelegramToChat(creds.botToken, chatId, text, { showMenu: false })
    )
  );

  return { ok: results.every((r) => r.ok) };
}

export async function getTelegramWebhookInfo(token: string) {
  return telegramApi(token, "getWebhookInfo");
}

export async function setTelegramWebhook(token: string, url: string) {
  return telegramApi(token, "setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export async function setTelegramBotCommands(token: string) {
  return telegramApi(token, "setMyCommands", {
    commands: [
      { command: "start", description: "เริ่มใช้ + ดู Chat ID" },
      { command: "today", description: "นัดวันนี้" },
      { command: "queue", description: "คิวรอยืนยัน" },
      { command: "month", description: "ตารางเดือนนี้" },
      { command: "sales", description: "ยอดขายวันนี้" },
      { command: "finance", description: "การเงินวันนี้" },
      { command: "customers", description: "ลูกค้าล่าสุด" },
      { command: "help", description: "วิธีใช้" },
    ],
  });
}

export function buildStartReply(chatId: number | string) {
  return (
    `🐱 <b>สวัสดีจาก CatCha Hotel Bot</b>\n\n` +
    `Chat ID ของคุณ: <code>${chatId}</code>\n` +
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
