import { body, check, loadServices, salonRoute, sdb, serviceFields } from "@/lib/salon/server";

const SAMPLE = [
  { category: "ตัด", name: "ตัดผมผู้หญิง", price: 300, duration_min: 45 },
  { category: "ตัด", name: "ตัดผมผู้ชาย", price: 150, duration_min: 30 },
  { category: "ตัด", name: "สระ ไดร์", price: 150, duration_min: 30 },
  { category: "เคมี", name: "ทำสี", price: 1500, price_from: true, duration_min: 120, wait_after_min: 30, wait_min: 40, rebook_days: 60 },
  { category: "เคมี", name: "ดัด", price: 1500, price_from: true, duration_min: 150, rebook_days: 90 },
  { category: "เคมี", name: "ยืด", price: 2000, price_from: true, duration_min: 180, rebook_days: 120 },
  { category: "บำรุง", name: "ทรีตเมนต์", price: 500, duration_min: 30 },
];

export const GET = salonRoute(async (_req, { shop }) => ({ services: await loadServices(shop, true) }));

export const POST = salonRoute(
  async (req, { shop }) => {
    const b = await body(req);
    // ร้านใหม่: ใส่บริการตัวอย่างให้ก่อน แล้วค่อยแก้ราคาเอง
    if (b.seed) {
      const existing = check(await sdb().from("services").select("id").eq("shop_id", shop).limit(1)) as unknown[];
      if (existing?.length) return { ok: true };
      const rows = SAMPLE.map((x, i) => ({ ...x, shop_id: shop, sort: i }));
      check(await sdb().from("services").insert(rows));
      return { ok: true };
    }
    const fields = serviceFields(b);
    if (!fields.name) return { error: "ใส่ชื่อบริการ" };
    const row = check(await sdb().from("services").insert({ ...fields, shop_id: shop }).select("id").single());
    return { ok: true, id: (row as { id: string }).id };
  },
  { owner: true }
);
