import { NextRequest, NextResponse } from "next/server";
import { pushLineMessage } from "@/lib/line";

export const runtime = "nodejs";

/** ส่งข้อความ (text) ไปหาลูกค้าทาง LINE — ใช้จากหน้าคิดเงิน (ส่งสรุป/แจ้งยอด) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lineUserId = String(body.lineUserId || "").trim();
  const text = String(body.text || "").trim();

  if (!lineUserId) {
    return NextResponse.json({ error: "no_line_user" }, { status: 400 });
  }
  if (!text) {
    return NextResponse.json({ error: "empty_text" }, { status: 400 });
  }

  try {
    await pushLineMessage(lineUserId, [{ type: "text", text }]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
