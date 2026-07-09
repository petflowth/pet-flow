import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getLineCredentials } from "@/lib/line-config";
import { findCustomerByLine } from "@/lib/customers-store";
import { sendTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * LINE Messaging API webhook
 * ลูกค้าตอบ/ทักเข้ามาใน LINE OA → ส่งแจ้งเตือนเข้า Telegram แอดมินทันที
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

async function lineDisplayName(userId: string, token: string) {
  if (!token) return "";
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { displayName?: string };
    return data.displayName || "";
  } catch {
    return "";
  }
}

async function resolveSender(userId: string | undefined, token: string) {
  if (!userId) return { label: "ลูกค้า", cats: "" };
  const customer = await findCustomerByLine(userId).catch(() => null);
  if (customer) {
    const cats =
      customer.cats?.map((c) => c.name).filter(Boolean).join(", ") || "";
    return {
      label: customer.name || customer.lineDisplayName || "ลูกค้า",
      cats,
    };
  }
  const dn = await lineDisplayName(userId, token);
  return { label: dn || "ลูกค้า (ยังไม่ลงทะเบียน)", cats: "" };
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
        if (ev.type === "message") {
          const { label, cats } = await resolveSender(ev.source?.userId, token);
          const who = cats ? `${label} (🐱 ${cats})` : label;
          const text = describeMessage(ev.message);
          await sendTelegram(
            `💬 ลูกค้าตอบใน LINE\n\n👤 ${who}\n🗨️ ${text}\n\n👉 เปิดแอป LINE Official Account เพื่อตอบกลับ`
          );
        } else if (ev.type === "follow") {
          const { label } = await resolveSender(ev.source?.userId, token);
          await sendTelegram(`🎉 มีเพื่อนใหม่เพิ่มบัญชี LINE\n\n👤 ${label}`);
        }
      } catch {
        // อย่าให้ event เดียวพัง — ต้องคืน 200 ให้ LINE เสมอ
      }
    })
  );

  return NextResponse.json({ ok: true });
}
