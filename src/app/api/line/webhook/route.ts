import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getLineCredentials } from "@/lib/line-config";
import { sendTelegram, sendTelegramPhoto } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LINE Messaging API webhook
 * มีคนเพิ่มเพื่อน LINE OA → ส่งแจ้งเตือนเข้า Telegram แอดมินทันที
 * (ลูกค้าตอบแชทธรรมดา — ไม่แจ้งเตือนแล้ว ตามที่ร้านขอ)
 *
 * ตั้งค่า: LINE Developers → Messaging API → Webhook URL =
 *   https://<โดเมนแอป>/api/line/webhook  แล้วกด Verify + เปิด "Use webhook"
 * (ไม่บังคับ) ใส่ env LINE_CHANNEL_SECRET เพื่อเปิดการตรวจลายเซ็นความปลอดภัย
 */

type LineMessage = { type: string; text?: string };
type LineEvent = {
  type: string;
  source?: { type?: string; userId?: string };
  message?: LineMessage;
};

function verifySignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const hash = crypto.createHmac("sha256", secret).update(body).digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function lineProfile(userId: string, token: string) {
  if (!token) return { displayName: "", pictureUrl: "" };
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { displayName: "", pictureUrl: "" };
    const data = (await res.json()) as {
      displayName?: string;
      pictureUrl?: string;
    };
    return {
      displayName: data.displayName || "",
      pictureUrl: data.pictureUrl || "",
    };
  } catch {
    return { displayName: "", pictureUrl: "" };
  }
}

/** ให้กด Verify / เช็คสถานะได้ */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "line-webhook" });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  const secret = process.env.LINE_CHANNEL_SECRET?.trim();
  if (secret) {
    const sig = req.headers.get("x-line-signature");
    if (!verifySignature(raw, sig, secret)) {
      return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
    }
  }

  let payload: { events?: LineEvent[] };
  try {
    payload = JSON.parse(raw) as { events?: LineEvent[] };
  } catch {
    return NextResponse.json({ ok: true });
  }

  const events = payload.events || [];
  const creds = await getLineCredentials();
  const token = creds?.channelToken || "";

  await Promise.all(
    events.map(async (ev) => {
      try {
        if (ev.type === "follow") {
          const userId = ev.source?.userId || "";
          const { displayName, pictureUrl } = await lineProfile(userId, token);
          const name = displayName || "ไม่ทราบชื่อ";
          const caption = `👋 มีคนเพิ่มเพื่อนที่ LINE OA\nชื่อไลน์: ${name}`;
          if (pictureUrl) {
            const sent = await sendTelegramPhoto(pictureUrl, caption);
            if (!sent.ok) await sendTelegram(caption);
          } else {
            await sendTelegram(caption);
          }
        }
      } catch {
        // อย่าให้ event เดียวพัง — ต้องคืน 200 ให้ LINE เสมอ
      }
    })
  );

  return NextResponse.json({ ok: true });
}
