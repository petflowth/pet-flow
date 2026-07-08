import { NextRequest, NextResponse } from "next/server";
import { saveLineSecrets } from "@/lib/secrets-store";
import {
  getLineCredentials,
  isLineConfigured,
  parseLineChannelToken,
  testLineChannelToken,
} from "@/lib/line-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAdmin(body: { adminCode?: string }) {
  const secret = process.env.NEXT_PUBLIC_ADMIN_CODE;
  return !secret || body.adminCode === secret;
}

export async function GET() {
  const configured = await isLineConfigured();
  const creds = await getLineCredentials();

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
    source: creds?.source || "none",
    liffId: creds?.liffId || process.env.NEXT_PUBLIC_LIFF_ID || "",
    displayName,
    basicId,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!checkAdmin(body)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const channelToken = parseLineChannelToken(String(body.channelToken || ""));
    const liffId = String(body.liffId || process.env.NEXT_PUBLIC_LIFF_ID || "").trim();

    const test = await testLineChannelToken(channelToken);
    if (!test.ok) {
      return NextResponse.json({ ok: false, message: test.message });
    }

    await saveLineSecrets({
      channelToken,
      liffId: liffId || undefined,
    });

    return NextResponse.json({
      ok: true,
      message: `✅ LINE พร้อมส่งการ์ดแล้ว (${test.displayName || "OA"})`,
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
