import { NextRequest, NextResponse } from "next/server";
import { handleTelegramCommand } from "@/lib/telegram-commands";
import {
  getTelegramCredentials,
  isTelegramConfigured,
  registerTelegramBot,
} from "@/lib/telegram-config";
import {
  buildStartReply,
  getTelegramWebhookInfo,
  getTelegramWebhookUrl,
  normalizeTelegramInput,
  parseTelegramCommand,
  sendTelegramToChat,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/telegram/webhook — ตรวจสอบ webhook
 * GET /api/telegram/webhook?register=1 — ลงทะเบียน webhook อัตโนมัติ
 */
export async function GET(req: NextRequest) {
  const creds = await getTelegramCredentials();
  if (!creds?.botToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "ยังไม่ได้ตั้งบอท — ไป Admin → ติดตั้ง → Telegram",
        hint: "TELEGRAM_BOT_TOKEN missing",
      },
      { status: 503 }
    );
  }

  const register = req.nextUrl.searchParams.get("register") === "1";
  const webhookUrl = getTelegramWebhookUrl(creds.appUrl);

  if (register) {
    if (!webhookUrl) {
      return NextResponse.json(
        { ok: false, error: "ไม่พบ URL เว็บ — ตั้งในหน้า Admin → ติดตั้ง" },
        { status: 400 }
      );
    }

    const result = await registerTelegramBot(creds.botToken, creds.appUrl);
    return NextResponse.json({
      ...result,
      source: creds.source,
    });
  }

  const info = await getTelegramWebhookInfo(creds.botToken);
  const configured = await isTelegramConfigured();

  return NextResponse.json({
    ok: info.ok,
    configured,
    source: creds.source,
    expectedWebhookUrl: webhookUrl || null,
    webhookInfo: info.data,
    ownerChatIds: creds.ownerChatIds,
  });
}

export async function POST(req: NextRequest) {
  const creds = await getTelegramCredentials();
  if (!creds?.botToken) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN missing" },
      { status: 503 }
    );
  }

  let body: { message?: { text?: string; chat?: { id?: number } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const message = body.message;
  if (!message?.text || message.chat?.id == null) {
    return NextResponse.json({ ok: true, skipped: "non_text_message" });
  }

  const chatId = message.chat.id;
  const text = normalizeTelegramInput(String(message.text));
  const { command } = parseTelegramCommand(text);

  let reply: { message: string; html?: boolean };
  if (command === "/start") {
    reply = { html: true, message: buildStartReply(chatId) };
  } else {
    reply = await handleTelegramCommand(text, chatId);
  }

  const sent = await sendTelegramToChat(creds.botToken, chatId, reply.message, {
    html: reply.html !== false,
    showMenu: true,
  });
  if (!sent.ok) {
    console.error("telegram sendMessage failed", sent.status, sent.data);
    return NextResponse.json(
      { ok: false, error: "send_failed", detail: sent.data },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
