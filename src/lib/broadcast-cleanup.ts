import { getSupabase } from "./supabase/server";

/**
 * ลบรูปโปร broadcast เก่าที่เก็บ base64 ในตาราง broadcast_images
 * (ของก่อนย้ายไปเก็บใน Storage) — ลบเฉพาะที่เก่ากว่า keepDays วัน เพราะ LINE
 * ดึงรูปไป cache ไว้ฝั่งเขาตั้งแต่ตอนส่งแล้ว ไม่ต้องใช้แถวนี้อีก
 * ใช้ร่วมกันทั้งปุ่มกดเองในหลังบ้านและ cron รายเดือน · เรียกซ้ำได้ปลอดภัย
 */
export async function cleanupOldBroadcastImages(
  keepDays = 30
): Promise<{ ok: boolean; removed: number; keepDays: number; error?: string }> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, removed: 0, keepDays, error: "no-supabase" };
  }

  const cutoff = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("broadcast_images")
    .delete()
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    return { ok: false, removed: 0, keepDays, error: error.message };
  }

  return { ok: true, removed: data?.length ?? 0, keepDays };
}
