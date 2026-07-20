import { getSupabase } from "./supabase/server";

/**
 * ค้นหาร้านข้ามทุกร้าน — ใช้เฉพาะตอนล็อกอิน (ยังไม่รู้ว่าเป็นร้านไหนจนกว่าจะเจอรหัส)
 * และหน้า /platform (มุมมองผู้ดูแลระบบ ข้ามร้านโดยตั้งใจ) เท่านั้น
 * store function อื่นทุกตัวต้องกรองด้วย tenant_id เสมอ ห้ามใช้ pattern นี้ที่อื่น
 */
export async function findTenantByOwnerCodeHash(
  codeHash: string
): Promise<{ id: string; name: string; status: string } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("tenants")
    .select("id, name, status")
    .eq("owner_code_hash", codeHash)
    .in("status", ["trial", "active"])
    .limit(1)
    .maybeSingle();
  return data || null;
}
