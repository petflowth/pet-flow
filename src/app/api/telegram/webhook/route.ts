import { NextRequest, NextResponse } from "next/server";
import { handleTelegramCommand } from "@/lib/telegram-commands";
import {
  buildStartReply,
  getTelegramWebhookInfo,
  getTelegramWebhookUrl,
  normalizeTelegramInput,
  parseTelegramCommand,
  sendTelegramToChat,
  setTelegramBotCommands,
  setTelegramWebhook,
} from "@/lib/telegram";

/**
 * GET /api/telegram/webhook — ตรวจสอบ webhook
 * GET /api/telegram/webhook?register=1 — ลงทะเบียน webhook อัตโนมัติ
 */
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN missing" },
      { status: 503 }
    );
  }

  const register = req.nextUrl.searchParams.get("register") === "1";
  const webhookUrl = getTelegramWebhookUrl();

  if (register) {
    if (!webhookUrl) {
      return NextResponse.json(
        { ok: false, error: "Set NEXT_PUBLIC_APP_URL on Vercel first" },
        { status: 400 }
      );
    }

    const setResult = await setTelegramWebhook(webhookUrl);
    const commandsResult = await setTelegramBotCommands();
    const info = await getTelegramWebhookInfo();
    return NextResponse.json({
      ok: setResult.ok,
      webhookUrl,
      setWebhook: setResult.data,
      setCommands: commandsResult.data,
      webhookInfo: info.data,
    });
  }

  const info = await getTelegramWebhookInfo();
  return NextResponse.json({
    ok: info.ok,
    expectedWebhookUrl: webhookUrl || null,
    webhookInfo: info.data,
  });
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
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

  const sent = await sendTelegramToChat(chatId, reply.message, {
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
