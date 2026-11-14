import { body, check, isUuid, salonRoute, sdb, SalonError, serviceFields } from "@/lib/salon/server";

/** แก้บริการ — ไม่ลบจริง (บิลเก่ายังอ้างถึง) ใช้ active: false ซ่อนแทน */
export const PATCH = salonRoute<{ id: string }>(
  async (req, { shop }, { id }) => {
    if (!isUuid(id)) throw new SalonError(404, "ไม่พบบริการ");
    const fields = serviceFields(await body(req));
    check(await sdb().from("services").update(fields).eq("shop_id", shop).eq("id", id));
    return { ok: true };
  },
  { owner: true }
);
