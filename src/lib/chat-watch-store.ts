import { getSupabase } from "./supabase/server";

const TEN_MIN_MS = 10 * 60 * 1000;

type ChatWatchRow = {
  line_user_id: string;
  last_message_at: string | null;
  last_notified_at: string | null;
};

const mem = new Map<string, { lastMessageAt: number; lastNotifiedAt: number }>();

/**
 * เรียกทุกครั้งที่ลูกค้าทักเข้ามาใน LINE — คืนค่า true ถ้าควรแจ้งเตือน
 * (ข้อความนี้ห่างจากข้อความก่อนหน้าของลูกค้าคนนี้เกิน 10 นาที = น่าจะยังไม่มีคนตอบ)
 *
 * ข้อจำกัด: ระบบไม่รู้ว่าพนักงานตอบแชทจริงหรือยัง (พนักงานตอบผ่านแอป LINE OA
 * โดยตรง ไม่ผ่านระบบนี้) จึงใช้ "ลูกค้าทักซ้ำหลังเงียบไปนาน" เป็นสัญญาณแทน
 */
export async function shouldNotifyUnanswered(lineUserId: string): Promise<boolean> {
  const now = Date.now();
  const sb = getSupabase();

  if (!sb) {
    const prev = mem.get(lineUserId);
    const gap = prev ? now - prev.lastMessageAt : Infinity;
    const shouldNotify =
      gap >= TEN_MIN_MS && (!prev || now - prev.lastNotifiedAt >= TEN_MIN_MS);
    mem.set(lineUserId, {
      lastMessageAt: now,
      lastNotifiedAt: shouldNotify ? now : prev?.lastNotifiedAt || 0,
    });
    return shouldNotify;
  }

  const { data } = await sb
    .from("chat_watch")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle();
  const row = data as ChatWatchRow | null;

  const lastMessageAt = row?.last_message_at ? new Date(row.last_message_at).getTime() : 0;
  const lastNotifiedAt = row?.last_notified_at ? new Date(row.last_notified_at).getTime() : 0;
  const gap = row?.last_message_at ? now - lastMessageAt : Infinity;
  const shouldNotify = gap >= TEN_MIN_MS && now - lastNotifiedAt >= TEN_MIN_MS;

  await sb.from("chat_watch").upsert({
    line_user_id: lineUserId,
    last_message_at: new Date(now).toISOString(),
    last_notified_at: shouldNotify ? new Date(now).toISOString() : row?.last_notified_at || null,
  });

  return shouldNotify;
}
