import { cleanPhone } from "@/lib/salon/shared";
import { body, check, createOrFindCustomer, CUSTOMER_COLS as COLS, salonRoute, sdb, str } from "@/lib/salon/server";

/** ค้นลูกค้าด้วยชื่อหรือเบอร์ (ไม่ใส่ = ล่าสุด 50 คน) */
export const GET = salonRoute(async (req, { shop }) => {
  const q = str(req.nextUrl.searchParams.get("q"), 50).replace(/[%,()]/g, "");
  let query = sdb()
    .from("customers")
    .select(COLS)
    .eq("shop_id", shop)
    .is("deleted_at", null)
    .is("merged_into", null)
    .limit(50);
  if (q) {
    const digits = q.replace(/\D/g, "");
    query =
      digits.length >= 3
        ? query.like("phone", `%${digits}%`)
        : query.or(`name.ilike.%${q}%,nickname.ilike.%${q}%`);
    query = query.order("name");
  } else {
    query = query.order("updated_at", { ascending: false });
  }
  return { customers: check(await query) || [] };
});

/** เพิ่มลูกค้าใหม่ — เบอร์ซ้ำกับคนเดิม คืนคนเดิมแทน (ไม่สร้างซ้ำ) */
export const POST = salonRoute(async (req, { shop }) => {
  const b = await body(req);
  const customer = await createOrFindCustomer(shop, str(b.name, 80), cleanPhone(str(b.phone)), str(b.notes, 500));
  return { customer };
});

