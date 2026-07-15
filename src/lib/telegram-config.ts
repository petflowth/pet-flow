import { getSecrets } from "./secrets-store";

export type TelegramCredentials = {
  botToken: string;
  ownerChatIds: string[];
  appUrl: string;
  source: "env" | "database";
};

const TOKEN_RE = /^\d+:[A-Za-z0-9_-]{30,}$/;

export function parseBotToken(raw: string) {
  const token = raw.trim();
  if (!TOKEN_RE.test(token)) {
    throw new Error(
      "Token ไม่ถูกต้อง — ไป @BotFather → /mybots → เลือกบอท → API Token แล้ว copy มาวาง"
    );
  }
  return token;
}

export function parseOwnerChatIds(raw: string) {
  const ids = raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!ids.length) {
    throw new Error("ใส่ Chat ID ของเจ้าของ (ทักบอท /start จะเห็นเลข)");
  }
  for (const id of ids) {
    if (!/^-?\d+$/.test(id)) {
      throw new Error(`Chat ID ไม่ถูกต้อง: ${id}`);
    }
  }
  return ids;
}

export function normalizeAppUrl(raw: string) {
  const url = raw.trim().replace(/\/$/, "");
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("URL เว็บต้องขึ้นต้นด้วย https://");
  }
  return url;
}

export function getAppUrlFromEnv() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  );
}

export async function getTelegramCredentials(): Promise<TelegramCredentials | null> {
  const envAppUrl = getAppUrlFromEnv();
  const secrets = await getSecrets();
  const t = secrets.telegram;

  if (t?.botToken) {
    return {
      botToken: t.botToken,
      ownerChatIds: t.ownerChatIds
        ? t.ownerChatIds.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
        : [],
      appUrl: t.appUrl || envAppUrl,
      source: "database",
    };
  }

  const envToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const envChats = (process.env.TELEGRAM_OWNER_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (envToken) {
    return {
      botToken: envToken,
      ownerChatIds: envChats,
      appUrl: envAppUrl,
      source: "env",
    };
  }

  return null;
}

export async function isTelegramConfigured() {
  const creds = await getTelegramCredentials();
  return Boolean(creds?.botToken);
}

export async function testTelegramToken(token: string) {
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const data = (await res.json()) as {
    ok?: boolean;
    description?: string;
    result?: { username?: string; first_name?: string };
  };

  if (!data.ok) {
    const hint =
      data.description === "Unauthorized"
        ? "Token ผิดหรือหมดอายุ — copy ใหม่จาก @BotFather"
        : data.description || "เชื่อมต่อ Telegram ไม่ได้";
    return { ok: false as const, message: hint };
  }

  return {
    ok: true as const,
    username: data.result?.username,
    name: data.result?.first_name,
  };
}

export const TELEGRAM_BOT_COMMANDS = [
  { command: "start", description: "เริ่มใช้ + ดู Chat ID" },
  { command: "today", description: "นัดวันนี้" },
  { command: "tomorrow", description: "เตรียมตัวพรุ่งนี้ (นัด + เช็คอิน/เอาท์)" },
  { command: "queue", description: "คิวรอยืนยัน" },
  { command: "month", description: "ตารางเดือนนี้" },
  { command: "sales", description: "ยอดขายวันนี้" },
  { command: "finance", description: "การเงินวันนี้" },
  { command: "book", description: "เพิ่มนัดลูกค้า" },
  { command: "summary", description: "สรุปยอดลูกค้า" },
  { command: "confirm", description: "ส่งยืนยันนัดทาง LINE" },
  { command: "search", description: "ค้นหาลูกค้า" },
  { command: "help", description: "วิธีใช้" },
] as const;

export async function syncTelegramBotCommands(token: string) {
  return fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: TELEGRAM_BOT_COMMANDS }),
  }).then((r) => r.json());
}

export async function registerTelegramBot(
  token: string,
  appUrl: string
) {
  const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  const setWebhook = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  }).then((r) => r.json());

  const setCommands = await syncTelegramBotCommands(token);

  const webhookInfo = await fetch(
    `https://api.telegram.org/bot${token}/getWebhookInfo`
  ).then((r) => r.json());

  const ok = Boolean(
    (setWebhook as { ok?: boolean }).ok &&
      (setCommands as { ok?: boolean }).ok &&
      (webhookInfo as { ok?: boolean }).ok
  );

  let message = ok
    ? "✅ บอทพร้อมใช้งาน — ทัก /start ใน Telegram ได้เลย"
    : "❌ ตั้ง webhook ไม่สำเร็จ";

  if (!(setWebhook as { ok?: boolean }).ok) {
    const webhookErr = (setWebhook as { description?: string }).description;
    if (webhookErr === "Unauthorized") {
      message = "❌ Token ผิด — ไป @BotFather copy API Token ใหม่";
    } else if (webhookErr) {
      message = `❌ ${webhookErr}`;
    }
  }

  return {
    ok,
    webhookUrl,
    setWebhook,
    setCommands,
    webhookInfo,
    message,
  };
}

/** ถ้า webhook ยังว่าง แต่ส่งแจ้งเตือนได้ — ลงทะเบียนรับคำสั่งอัตโนมัติ */
export async function ensureTelegramWebhook(token: string, appUrl: string) {
  const infoRes = await fetch(
    `https://api.telegram.org/bot${token}/getWebhookInfo`
  ).then((r) => r.json()) as { ok?: boolean; result?: { url?: string } };

  const currentUrl = infoRes.result?.url || "";
  const expected = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

  if (currentUrl === expected) {
    await syncTelegramBotCommands(token).catch(() => {});
    return { ok: true as const, already: true, webhookUrl: expected };
  }

  return registerTelegramBot(token, appUrl);
}
