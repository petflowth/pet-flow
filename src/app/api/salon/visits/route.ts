import { bangkokToday } from "@/lib/bangkok-date";
import { depositFor } from "@/lib/salon/shared";
import {
  body,
  check,
  createOrFindCustomer,
  isDay,
  isUuid,
  listVisits,
  loadSettings,
  mainStylistId,
  nowHHMM,
  salonRoute,
  saveVisit,
  sdb,
  servicesFromIds,
  slotsFor,
  str,
  SalonError,
} from "@/lib/salon/server";
import { cleanPhone } from "@/lib/salon/shared";

/** คิวทั้งวัน ?day=YYYY-MM-DD */
export const GET = salonRoute(async (req, { shop }) => {
  const d = req.nextUrl.searchParams.get("day");
  const day = isDay(d) ? d : bangkokToday();
  return { day, visits: await listVisits(shop, day) };
});

/**
 * เพิ่มคิว — จองล่วงหน้า (source=booking + day + time) หรือลูกค้าเดินเข้า (source=walk_in เริ่มเลย)
 * ลูกค้า: customer_id เดิม / new_customer {name, phone} / ไม่ระบุ (guest_name)
 */
export const POST = salonRoute(async (req, { shop, by }) => {
  const b = await body(req);
  const walkIn = b.source === "walk_in";
  const today = bangkokToday();
  const day = walkIn ? today : isDay(b.day) ? (b.day as string) : "";
  if (!day) throw new SalonError(400, "เลือกวันที่");
  const time = /^\d{2}:\d{2}$/.test(String(b.time || "")) ? String(b.time) : walkIn ? nowHHMM() : "";
  if (!time) throw new SalonError(400, "เลือกเวลา");

  const ids = Array.isArray(b.service_ids) ? (b.service_ids as unknown[]).map(String) : [];
  const { items, rows } = await servicesFromIds(shop, ids);
  if (!items.length) throw new SalonError(400, "เลือกบริการอย่างน้อย 1 อย่าง");

  let customerId: string | null = isUuid(b.customer_id) ? (b.customer_id as string) : null;
  const nc = (b.new_customer || {}) as Record<string, unknown>;
  if (!customerId && (str(nc.name) || cleanPhone(str(nc.phone)))) {
    const c = (await createOrFindCustomer(shop, str(nc.name, 80), cleanPhone(str(nc.phone)))) as { id: string };
    customerId = c.id;
  }
  if (customerId) {
    const c = check(await sdb().from("customers").select("id").eq("shop_id", shop).eq("id", customerId).maybeSingle());
    if (!c) throw new SalonError(404, "ไม่พบลูกค้า");
  }

  const [settings, stylist] = await Promise.all([loadSettings(shop), mainStylistId(shop)]);
  const t = slotsFor(day, time, stylist, items);
  const saved = await saveVisit({
    shop_id: shop,
    day,
    source: walkIn ? "walk_in" : "booking",
    // ร้านคนเดียว: เดินเข้ามาแล้วว่าง = เริ่มทำเลย, ไม่ว่าง = รอคิว
    status: walkIn ? (b.wait ? "waiting" : "in_service") : "booked",
    customer_id: customerId,
    guest_name: customerId ? null : str(b.guest_name, 80) || "ลูกค้าเดินเข้า",
    stylist_id: stylist,
    note: str(b.note, 500),
    deposit_required: walkIn ? 0 : depositFor(settings, rows),
    by,
    services: items,
    ...t,
  });
  return { ok: true, id: saved.id, queue_no: saved.queue_no };
});
