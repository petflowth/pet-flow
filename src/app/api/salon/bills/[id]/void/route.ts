import { body, check, isUuid, salonRoute, sdb, str, SalonError } from "@/lib/salon/server";

/** ยกเลิกบิล (เจ้าของเท่านั้น) — คืนเงิน/แต้มทั้งหมด คิวกลับไปรอเก็บเงินใหม่ */
export const POST = salonRoute<{ id: string }>(
  async (req, { shop, by }, { id }) => {
    if (!isUuid(id)) throw new SalonError(404, "ไม่พบบิล");
    const b = await body(req);
    const reason = str(b.reason, 200);
    if (!reason) throw new SalonError(400, "บอกเหตุผลที่ยกเลิก");
    check(await sdb().rpc("void_bill", { p: { shop_id: shop, bill_id: id, reason, by } }));
    return { ok: true };
  },
  { owner: true }
);
