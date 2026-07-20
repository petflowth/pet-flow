import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getLineCredentials } from "@/lib/line-config";
import { findCustomerByLine } from "@/lib/customers-store";
import { sendTelegram, sendTelegramPhoto } from "@/lib/telegram";
import { shouldNotifyUnanswered } from "@/lib/chat-watch-store";
import { withResolvedTenant } from "@/lib/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LINE Messaging API webhook
 * - มีคนเพิ่มเพื่อน LINE OA → ส่งแจ้งเตือนเข้า Telegram แอดมินทันที
 * - ลูกค้าตอบแชท → แจ้งเตือนเฉพาะตอนทักซ้ำหลังเงียบไปเกิน 10 นาที
 *   (ระบบไม่รู้ว่าพนักงานตอบผ่านแอป LINE OA ไปแล้วหรือยัง — ใช้ "ทักซ้ำหลังเงียบนาน"
 *   เป็นสัญญาณแทนว่าน่าจะยังไม่มีคนตอบ)
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

function describeMessage(m?: LineMessage) {
  if (!m) return "(ไม่มีข้อความ)";
  switch (m.type) {
    case "text":
      return m.text?.trim() || "(ข้อความว่าง)";
    case "image":
      return "[ส่งรูปภาพ 🖼️]";
    case "sticker":
      return "[ส่งสติกเกอร์ 😺]";
    case "video":
      return "[ส่งวิดีโอ 🎬]";
    case "audio":
      return "[ส่งข้อความเสียง 🎤]";
    case "file":
      return "[ส่งไฟล์ 📎]";
    case "location":
      return "[ส่งตำแหน่งที่ตั้ง 📍]";
    default:
      return `[${m.type}]`;
  }
}

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

async function postHandler(req: NextRequest) {
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
        if (ev.type === "message") {
          const userId = ev.source?.userId || "";
          if (!userId) return;
          const notify = await shouldNotifyUnanswered(userId);
          if (!notify) return;
          const customer = await findCustomerByLine(userId).catch(() => null);
          const who = customer?.name || customer?.lineDisplayName || "ลูกค้า (ยังไม่ลงทะเบียน)";
          const text = describeMessage(ev.message);
          await sendTelegram(
            `⏰ ลูกค้ารอเกิน 10 นาที ยังไม่มีคนตอบ\n\n👤 ${who}\n🗨️ ${text}\n\n👉 เปิดแอป LINE Official Account เพื่อตอบกลับ`
          );
        } else if (ev.type === "follow") {
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

// R1/R3: resolve ร้านจาก /s/<slug>/api/line/webhook (header x-tenant-slug) → bootstrap ถ้าไม่มี
export function POST(req: NextRequest) { return withResolvedTenant(req, () => postHandler(req)); }
