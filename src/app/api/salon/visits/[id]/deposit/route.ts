import { round2 } from "@/lib/salon/shared";
import { body, check, getVisit, num, salonRoute, sdb, str, SalonError } from "@/lib/salon/server";

/** รับมัดจำ { method, amount, reference, idem_key } */
export const POST = salonRoute<{ id: string }>(async (req, { shop, by }, { id }) => {
  const b = await body(req);
  const visit = await getVisit(shop, id);
  if (["done", "cancelled", "no_show"].includes(visit.status) || visit.bill) throw new SalonError(409, "คิวนี้ปิดไปแล้ว");
  const method = ["cash", "transfer", "card"].includes(String(b.method)) ? String(b.method) : "";
  if (!method) throw new SalonError(400, "เลือกวิธีรับเงิน");
  const amount = round2(num(b.amount));
  if (amount <= 0) throw new SalonError(400, "ใส่จำนวนเงิน");
  const idem = str(b.idem_key, 80) || `dep-${id}-${Date.now()}`;
  const { error } = await sdb().from("payments").insert({
    shop_id: shop,
    visit_id: id,
    kind: "deposit",
    method,
    amount,
    reference: str(b.reference, 80) || null,
    idem_key: idem,
    received_by: by,
  });
  // กดซ้ำ (idem_key เดิม) = รับไปแล้ว ไม่บันทึกซ้ำ
  if (error && !/duplicate|unique/i.test(error.message)) check({ data: null, error });
  return { ok: true };
});
