import { getSupabase } from "./supabase/server";
import { requireTenantId } from "./tenant-context";

const TEN_MIN_MS = 10 * 60 * 1000;
// ห่างจากข้อความก่อนหน้าเกินนี้ = ถือว่าบทสนทนารอบก่อนน่าจะจบ/ตอบไปแล้ว เริ่มนับรอบใหม่
// (กันแจ้งเตือนซ้ำไปเรื่อยๆ ถ้าลูกค้าทักมาใหม่เรื่องอื่นหลังเงียบไปนาน)
const STREAK_RESET_MS = 30 * 60 * 1000;

type ChatWatchRow = {
  line_user_id: string;
  last_message_at: string | null;
  first_unanswered_at: string | null;
  last_notified_at: string | null;
};

const mem = new Map<
  string,
  { lastMessageAt: number; firstUnansweredAt: number; lastNotifiedAt: number }
>();

/**
 * เรียกทุกครั้งที่ลูกค้าทักเข้ามาใน LINE — คืนค่า true ถ้าควรแจ้งเตือน
 *
 * ระบบไม่รู้ว่าพนักงานตอบแชทจริงหรือยัง (พนักงานตอบผ่านแอป LINE OA โดยตรง
 * ไม่ผ่านระบบนี้) จึงประมาณจาก "นับตั้งแต่ข้อความแรกของรอบสนทนานี้ผ่านมากี่นาทีแล้ว"
 * แทน — ไม่ใช่ช่องว่างระหว่างข้อความ 2 อันล่าสุด (แบบเดิม ซึ่งยิงทุกครั้งที่ลูกค้า
 * ทักห่างกันเกิน 10 นาที ไม่ว่าจะเคยมีคนตอบไปแล้วหรือไม่)
 *
 * รอบสนทนาใหม่เริ่มเมื่อ: ยังไม่เคยมีข้อความมาก่อน หรือห่างจากข้อความก่อนหน้าเกิน
 * 30 นาที (ถือว่ารอบก่อนน่าจะจบไปแล้ว) — ข้อความแรกของรอบใหม่จะยังไม่แจ้งเตือน
 * ทันที ต้องรอเวลาผ่านไปจนครบ 10 นาทีนับจากข้อความแรกของรอบนั้นถึงจะแจ้ง
 * และแจ้งครั้งเดียวต่อรอบ (เว้น 10 นาทีก่อนแจ้งซ้ำถ้ายังไม่มีคนตอบ)
 */
export async function shouldNotifyUnanswered(lineUserId: string): Promise<boolean> {
  const now = Date.now();
  const sb = getSupabase();

  if (!sb) {
    const prev = mem.get(lineUserId);
    const gapSincePrev = prev ? now - prev.lastMessageAt : Infinity;
    const isNewStreak = gapSincePrev >= STREAK_RESET_MS || !prev;
    const streakStart = isNewStreak ? now : prev!.firstUnansweredAt;
    const waited = now - streakStart;
    const lastNotifiedAt = isNewStreak ? 0 : prev!.lastNotifiedAt;
    const shouldNotify = waited >= TEN_MIN_MS && now - lastNotifiedAt >= TEN_MIN_MS;
    mem.set(lineUserId, {
      lastMessageAt: now,
      firstUnansweredAt: streakStart,
      lastNotifiedAt: shouldNotify ? now : lastNotifiedAt,
    });
    return shouldNotify;
  }

  const { data } = await sb
    .from("chat_watch")
    .select("*")
    .eq("line_user_id", lineUserId)
    .eq("tenant_id", requireTenantId())
    .maybeSingle();
  const row = data as ChatWatchRow | null;

  const lastMessageAt = row?.last_message_at ? new Date(row.last_message_at).getTime() : 0;
  const gapSincePrev = lastMessageAt ? now - lastMessageAt : Infinity;
  const isNewStreak = gapSincePrev >= STREAK_RESET_MS || !row?.first_unanswered_at;
  const streakStart = isNewStreak ? now : new Date(row!.first_unanswered_at!).getTime();
  const waited = now - streakStart;
  const lastNotifiedAt =
    isNewStreak || !row?.last_notified_at ? 0 : new Date(row.last_notified_at).getTime();
  const shouldNotify = waited >= TEN_MIN_MS && now - lastNotifiedAt >= TEN_MIN_MS;

  await sb.from("chat_watch").upsert({
    line_user_id: lineUserId,
    tenant_id: requireTenantId(),
    last_message_at: new Date(now).toISOString(),
    first_unanswered_at: new Date(streakStart).toISOString(),
    last_notified_at: shouldNotify
      ? new Date(now).toISOString()
      : isNewStreak
        ? null
        : row?.last_notified_at || null,
  });

  return shouldNotify;
}
