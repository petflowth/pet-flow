import { cleanPhone } from "@/lib/salon/shared";
import { body, check, CUSTOMER_COLS, isUuid, salonRoute, sdb, str, SalonError, visitsOfCustomer } from "@/lib/salon/server";

/** ข้อมูลลูกค้า + ประวัติการมาร้าน */
export const GET = salonRoute<{ id: string }>(async (_req, { shop }, { id }) => {
  if (!isUuid(id)) throw new SalonError(404, "ไม่พบลูกค้า");
  const customer = check(
    await sdb().from("customers").select(CUSTOMER_COLS).eq("shop_id", shop).eq("id", id).maybeSingle()
  );
  if (!customer) throw new SalonError(404, "ไม่พบลูกค้า");
  const visits = await visitsOfCustomer(shop, id);
  return { customer, visits };
});

export const PATCH = salonRoute<{ id: string }>(async (req, { shop }, { id }) => {
  if (!isUuid(id)) throw new SalonError(404, "ไม่พบลูกค้า");
  const b = await body(req);
  const f: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in b) {
    f.name = str(b.name, 80);
    if (!f.name) throw new SalonError(400, "ใส่ชื่อลูกค้า");
  }
  if ("phone" in b) f.phone = cleanPhone(str(b.phone)) || null;
  for (const k of ["nickname", "allergies", "color_formula", "notes"]) if (k in b) f[k] = str(b[k], 500) || null;
  if ("delete" in b && b.delete) f.deleted_at = new Date().toISOString();
  check(await sdb().from("customers").update(f).eq("shop_id", shop).eq("id", id));
  return { ok: true };
});
