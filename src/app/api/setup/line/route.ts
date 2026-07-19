import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import { getSecrets, saveLineSecrets } from "@/lib/secrets-store";
import {
  getAppUrlFromEnv,
  getLineCredentials,
  isLineConfigured,
  isLiffConfigured,
  parseLineChannelToken,
  testLineChannelToken,
  setLineWebhookEndpoint,
  getLineWebhookEndpoint,
} from "@/lib/line-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สิทธิ์ถูกตรวจที่ middleware ด้วยคุกกี้ที่เซ็นชื่อแล้ว — ตรวจซ้ำที่นี่กันพลาด
// (ของเดิมเทียบกับ NEXT_PUBLIC_ADMIN_CODE ซึ่งถูกฝังไปในไฟล์ JS ฝั่งเบราว์เซอร์)
async function checkAdmin(req: NextRequest) {
  return !!(await getSessionFrom(req));
}

export async function GET() {
  const configured = await isLineConfigured();
  const liffConfigured = await isLiffConfigured();
  const creds = await getLineCredentials();
  const appUrl = getAppUrlFromEnv() || "https://catchahotel.com";

  let displayName: string | undefined;
  let basicId: string | undefined;

  if (creds?.channelToken) {
    const test = await testLineChannelToken(creds.channelToken);
    if (test.ok) {
      displayName = test.displayName;
      basicId = test.basicId;
    }
  }

  return NextResponse.json({
    configured,
    liffConfigured,
    source: creds?.source || "none",
    liffId: creds?.liffId || "",
    endpointUrl: `${appUrl}/app`,
    testLiffUrl: creds?.liffId ? `https://liff.line.me/${creds.liffId}` : "",
    displayName,
    basicId,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const action = String(body.action || "save_token");

  try {
    if (action === "save_liff") {
      const liffId = String(body.liffId || "").trim();
      if (!liffId || liffId.length < 6) {
        return NextResponse.json(
          { ok: false, message: "กรอก LIFF ID ให้ครบ (จาก LINE Developers → LIFF)" },
          { status: 400 }
        );
      }

      const current = await getSecrets();
      await saveLineSecrets({
        channelToken: current.line?.channelToken,
        liffId,
      });

      return NextResponse.json({
        ok: true,
        message: `✅ บันทึก LIFF ID แล้ว\nทดสอบ: https://liff.line.me/${liffId}`,
        liffId,
      });
    }

    if (action === "set_webhook") {
      const creds = await getLineCredentials();
      if (!creds?.channelToken) {
        return NextResponse.json({
          ok: false,
          message: "ยังไม่ได้ตั้ง Channel Access Token — ใส่ Token ก่อน",
        });
      }
      const appUrl = getAppUrlFromEnv() || "https://catchahotel.com";
      const webhookUrl = `${appUrl}/api/line/webhook`;
      const result = await setLineWebhookEndpoint(creds.channelToken, webhookUrl);
      if (!result.ok) {
        return NextResponse.json({
          ok: false,
          message: `ตั้ง Webhook ไม่สำเร็จ: ${result.message}`,
        });
      }
      const status = await getLineWebhookEndpoint(creds.channelToken);
      return NextResponse.json({
        ok: true,
        message: `✅ ตั้ง Webhook อัตโนมัติแล้ว!\n${webhookUrl}\nแจ้งคนแอด + ลูกค้าตอบแชท จะเข้า Telegram แล้ว`,
        webhookUrl,
        active: status?.active,
      });
    }

    const channelToken = parseLineChannelToken(String(body.channelToken || ""));
    const liffId = String(body.liffId || "").trim();
    const current = await getSecrets();

    const test = await testLineChannelToken(channelToken);
    if (!test.ok) {
      return NextResponse.json({ ok: false, message: test.message });
    }

    await saveLineSecrets({
      channelToken,
      liffId: liffId || current.line?.liffId,
    });

    return NextResponse.json({
      ok: true,
      message: `✅ LINE Token พร้อมส่งการ์ด (${test.displayName || "OA"})`,
      displayName: test.displayName,
      basicId: test.basicId,
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
