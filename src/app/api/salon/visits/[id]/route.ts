import { bkkDay, bkkTime, type VisitService } from "@/lib/salon/shared";
import {
  audit,
  body,
  check,
  getVisit,
  isDay,
  isUuid,
  loadServices,
  mainStylistId,
  num,
  salonRoute,
  saveVisit,
  sdb,
  slotsFor,
  str,
  SalonError,
} from "@/lib/salon/server";

export const GET = salonRoute<{ id: string }>(async (_req, { shop }, { id }) => ({ visit: await getVisit(shop, id) }));

const NEXT: Record<string, { status: string; stamp?: string; from: string[] }> = {
  arrive: { status: "arrived", stamp: "arrived_at", from: ["booked", "confirmed"] },
  start: { status: "in_service", stamp: "started_at", from: ["booked", "confirmed", "arrived", "waiting"] },
  finish: { status: "awaiting_payment", stamp: "finished_at", from: ["booked", "confirmed", "arrived", "waiting", "in_service"] },
  confirm: { status: "confirmed", from: ["booked"] },
  // กดผิด — ย้อนกลับเป็นจองไว้/มาถึง
  undo_arrive: { status: "booked", from: ["arrived"] },
  undo_start: { status: "arrived", from: ["in_service"] },
  undo_finish: { status: "in_service", from: ["awaiting_payment"] },
};

/**
 * เปลี่ยนสถานะ/แก้คิว: { action, ... }
 * arrive | start | finish | confirm | undo_* | cancel {reason} | no_show
 * reschedule {day, time} | services {items:[{service_id, name, price}], force} | note {note}
 */
export const PATCH = salonRoute<{ id: string }>(async (req, { shop, by }, { id }) => {
  const b = await body(req);
  const action = str(b.action, 30);
  const visit = await getVisit(shop, id);
  const closed = ["done", "cancelled", "no_show"].includes(visit.status);

  const step = NEXT[action];
  if (step) {
    if (!step.from.includes(visit.status)) throw new SalonError(409, "สถานะคิวเปลี่ยนไปแล้ว กดรีเฟรช");
    const f: Record<string, unknown> = { status: step.status, updated_at: new Date().toISOString(), version: visit.version + 1 };
    if (step.stamp) f[step.stamp] = new Date().toISOString();
    check(await sdb().from("visits").update(f).eq("shop_id", shop).eq("id", id).eq("version", visit.version));
    return { ok: true };
  }

  if (action === "cancel" || action === "no_show") {
    if (closed || visit.bill) throw new SalonError(409, "คิวนี้ปิดไปแล้ว");
    check(
      await sdb()
        .from("visits")
        .update({
          status: action === "cancel" ? "cancelled" : "no_show",
          cancel_reason: str(b.reason, 200) || null,
          updated_at: new Date().toISOString(),
          version: visit.version + 1,
        })
        .eq("shop_id", shop)
        .eq("id", id)
    );
    // คืนเวลาให้คิวอื่นจองได้
    check(await sdb().from("visit_slots").delete().eq("shop_id", shop).eq("visit_id", id));
    if (action === "no_show" && visit.customer_id) {
      check(
        await sdb()
          .from("customers")
          .update({ no_show_count: (visit.customer?.no_show_count || 0) + 1 })
          .eq("shop_id", shop)
          .eq("id", visit.customer_id)
      );
    }
    await audit(shop, by, action, "visit", id, { deposit_paid: visit.deposit_paid }, str(b.reason, 200));
    return { ok: true, deposit_paid: visit.deposit_paid };
  }

  if (closed || visit.bill) throw new SalonError(409, "คิวนี้ปิดไปแล้ว แก้ไม่ได้");
  const stylist = visit.stylist_id || (await mainStylistId(shop));

  if (action === "note") {
    check(await sdb().from("visits").update({ note: str(b.note, 500) || null }).eq("shop_id", shop).eq("id", id));
    return { ok: true };
  }

  if (action === "reschedule") {
    if (!isDay(b.day) || !/^\d{2}:\d{2}$/.test(String(b.time))) throw new SalonError(400, "เลือกวันและเวลา");
    await saveVisit({
      shop_id: shop,
      id,
      version: visit.version,
      stylist_id: stylist,
      services: visit.services,
      ...slotsFor(b.day as string, String(b.time), stylist, visit.services),
    });
    await audit(shop, by, "reschedule", "visit", id, { from: visit.start_at, to: `${b.day} ${b.time}` });
    return { ok: true };
  }

  if (action === "services") {
    const all = await loadServices(shop, true);
    const raw = Array.isArray(b.items) ? (b.items as Record<string, unknown>[]) : [];
    const items: VisitService[] = raw.slice(0, 20).map((it) => {
      const s = isUuid(it.service_id) ? all.find((x) => x.id === it.service_id) : undefined;
      const price = it.price == null || it.price === "" ? null : Math.max(0, num(it.price));
      return {
        service_id: s?.id || null,
        name: str(it.name, 80) || s?.name || "บริการ",
        quoted_price: s ? Number(s.price) : price || 0,
        final_price: price ?? (s && !s.price_from ? Number(s.price) : null),
        price_from: s?.price_from || false,
        price_confirmed_by: price != null ? by : null,
        duration_min: s?.duration_min ?? 30,
        wait_min: s?.wait_min ?? 0,
        wait_after_min: s?.wait_after_min ?? 0,
        stylist_id: null,
        assistant_id: null,
      };
    });
    if (!items.length) throw new SalonError(400, "ต้องมีบริการอย่างน้อย 1 อย่าง");
    const day = bkkDay(visit.start_at);
    const t = slotsFor(day, bkkTime(visit.start_at), stylist, items);
    try {
      await saveVisit({ shop_id: shop, id, version: visit.version, stylist_id: stylist, services: items, ...t });
    } catch (e) {
      // เพิ่มบริการแล้วเวลาเลยไปชนคิวถัดไป — ถามก่อน ถ้ายืนยันก็บันทึก (ไม่กันเวลาส่วนที่ชน)
      if (!(e instanceof SalonError) || e.status !== 409 || !b.force) throw e;
      await saveVisit({ shop_id: shop, id, version: visit.version, stylist_id: stylist, services: items, ...t, slots: [] });
      return { ok: true, overlap: true };
    }
    return { ok: true };
  }

  throw new SalonError(400, "ไม่รู้จักคำสั่งนี้");
});
