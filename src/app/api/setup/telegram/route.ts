import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { saveTelegramSecrets } from "@/lib/secrets-store";
import {
  ensureTelegramWebhook,
  getAppUrlFromEnv,
  getTelegramCredentials,
  isTelegramConfigured,
  normalizeAppUrl,
  parseBotToken,
  parseOwnerChatIds,
  registerTelegramBot,
  testTelegramToken,
} from "@/lib/telegram-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, handleGet);
}

async function handleGet() {
  const configured = await isTelegramConfigured();
  const creds = await getTelegramCredentials();

  let botUsername: string | undefined;
  let webhookConnected = false;
  let webhookUrl = "";

  if (creds?.botToken) {
    const test = await testTelegramToken(creds.botToken);
    if (test.ok) botUsername = test.username;

    if (creds.appUrl) {
      const ensured = await ensureTelegramWebhook(creds.botToken, creds.appUrl);
      webhookConnected = ensured.ok;
      webhookUrl =
        ("webhookUrl" in ensured && ensured.webhookUrl) ||
        `${creds.appUrl.replace(/\/$/, "")}/api/telegram/webhook`;
    }
  }

  return NextResponse.json({
    configured,
    source: creds?.source || "none",
    appUrl: creds?.appUrl || getAppUrlFromEnv(),
    ownerChatIds: creds?.ownerChatIds?.join(", ") || "",
    botUsername,
    hasOwnerIds: Boolean(creds?.ownerChatIds?.length),
    webhookConnected,
    webhookUrl,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const botToken = parseBotToken(String(body.botToken || ""));
    const ownerChatIds = parseOwnerChatIds(String(body.ownerChatIds || "")).join(
      ","
    );
    const appUrl = normalizeAppUrl(
      String(body.appUrl || getAppUrlFromEnv() || "")
    );

    const test = await testTelegramToken(botToken);
    if (!test.ok) {
      return NextResponse.json({
        ok: false,
        message: test.message,
      });
    }

    const register = await registerTelegramBot(botToken, appUrl);
    if (!register.ok) {
      return NextResponse.json({
        ok: false,
        message: register.message,
        register,
      });
    }

    await saveTelegramSecrets({ botToken, ownerChatIds, appUrl });

    return NextResponse.json({
      ok: true,
      message:
        `✅ บอท @${test.username || "petflow"} พร้อมแล้ว!\n` +
        `ทัก /start ใน Telegram — จะเห็นปุ่มเมนูด้านล่าง`,
      botUsername: test.username,
      webhookUrl: register.webhookUrl,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 400 }
    );
  }
}
