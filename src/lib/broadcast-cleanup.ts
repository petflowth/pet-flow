import { getSupabase } from "./supabase/server";
import { requireTenantId } from "./tenant-context";

/**
 * ลบรูปโปร broadcast เก่าที่เก็บ base64 ในตาราง broadcast_images
 * (ของก่อนย้ายไปเก็บใน Storage) — ลบเฉพาะที่เก่ากว่า keepDays วัน เพราะ LINE
 * ดึงรูปไป cache ไว้ฝั่งเขาตั้งแต่ตอนส่งแล้ว ไม่ต้องใช้แถวนี้อีก
 * ใช้ร่วมกันทั้งปุ่มกดเองในหลังบ้านและ cron รายเดือน · เรียกซ้ำได้ปลอดภัย
 *
 * ต้อง scope ด้วย tenant_id เสมอ — ไม่งั้นร้านไหนกดปุ่มนี้ก็ลบรูปเก่าของทุกร้านทิ้งหมด
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
    .eq("tenant_id", requireTenantId())
    .select("id");

  if (error) {
    // ไม่มีตารางนี้ = ไม่เคยเก็บ base64 เลย (ร้านที่เริ่มใช้หลังย้ายไป Storage แล้ว)
    // ไม่ใช่ความผิดพลาด — ไม่มีอะไรให้ล้างก็คือล้างเสร็จ ไม่งั้น cron รายเดือน
    // จะเตือนล้มเหลวเข้า Telegram ทุกเดือนตลอดไปทั้งที่ไม่มีอะไรต้องแก้
    const missingTable =
      error.code === "PGRST205" ||
      /could not find the table|does not exist/i.test(error.message || "");
    if (missingTable) return { ok: true, removed: 0, keepDays };
    return { ok: false, removed: 0, keepDays, error: error.message };
  }

  return { ok: true, removed: data?.length ?? 0, keepDays };
}
