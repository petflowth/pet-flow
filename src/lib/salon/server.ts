/**
 * ระบบร้านทำผม — ฝั่งเซิร์ฟเวอร์
 *
 * ข้อมูลอยู่ใน schema "salon" ของฐานเดียวกับ PetFlow ทุกตารางกรองด้วย shop_id (= tenantId ของร้าน)
 * เซิร์ฟเวอร์ใช้ service_role ซึ่งข้าม RLS — ดังนั้น "ทุก query ต้องมี .eq('shop_id', shop)" ห้ามลืม
 */
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession, type SessionPayload } from "@/lib/auth";
import { requireTenantId, withTenant } from "@/lib/tenant-context";
import { getSupabase } from "@/lib/supabase/server";
import {
  bkkDay,
  bkkTime,
  busyPlan,
  hhmmOf,
  mergeSettings,
  minutesOf,
  overlaps,
  toIso,
  weekdayOf,
  type Busy,
  type SalonSettings,
  type Service,
  type Stylist,
  type Visit,
  type VisitService,
} from "./shared";

export class SalonError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function sdb() {
  const db = getSupabase();
  if (!db) throw new SalonError(503, "ยังไม่ได้ตั้งค่าฐานข้อมูล");
  return db.schema("salon");
}

export function shopId(): string {
  return requireTenantId();
}

export type SalonCtx = {
  session: SessionPayload;
  shop: string;
  /** ชื่อคนทำรายการ — ลงในบันทึกทุกครั้ง */
  by: string;
  isOwner: boolean;
};

type Handler<P> = (req: NextRequest, ctx: SalonCtx, params: P) => Promise<unknown>;

/**
 * ห่อ API route ของร้านทำผม: ตรวจล็อกอิน → ล็อกร้าน → จับ error เป็นข้อความภาษาไทย
 * owner: true = เฉพาะเจ้าของร้าน (ตั้งค่า, ยกเลิกบิล, รายงานเงิน)
 */
export function salonRoute<P = Record<string, string>>(handler: Handler<P>, opts: { owner?: boolean } = {}) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json({ error: "ต้องเข้าสู่ระบบก่อน" }, { status: 401 });
    }
    const isOwner = session.role === "owner";
    if (opts.owner && !isOwner) {
      return NextResponse.json({ error: "เฉพาะเจ้าของร้าน" }, { status: 403 });
    }
    try {
      const params = context?.params ? await context.params : ({} as P);
      const result = await withTenant(session.tenantId, () =>
        handler(req, { session, shop: session.tenantId, by: utf8Name(session.name) || session.role, isOwner }, params)
      );
      if (result instanceof NextResponse) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof SalonError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[salon]", req.method, req.nextUrl.pathname, msg);
      if (/schema must be one of|Invalid schema/i.test(msg)) {
        return NextResponse.json(
          { error: "ยังไม่ได้เปิดระบบร้านทำผมในฐานข้อมูล (ต้องเพิ่ม schema salon ใน Supabase)", code: "schema_missing" },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "ระบบขัดข้อง ลองใหม่อีกครั้ง" }, { status: 500 });
    }
  };
}

/** ชื่อใน session ถอดจาก base64 เป็น byte ทีละตัว (ภาษาไทยเพี้ยน) — แปลงกลับเป็น UTF-8 */
function utf8Name(name: string | undefined): string {
  if (!name) return "";
  try {
    return new TextDecoder().decode(Uint8Array.from(name, (c) => c.charCodeAt(0)));
  } catch {
    return name;
  }
}

/** แปลง error จาก supabase เป็น SalonError ที่อ่านรู้เรื่อง */
export function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const m = res.error.message || "";
    if (res.error.code === "23P01" || m.includes("visit_slots_no_overlap")) {
      throw new SalonError(409, "เวลานี้มีคิวอื่นแล้ว เลือกเวลาใหม่");
    }
    if (m.includes("stale")) throw new SalonError(409, "มีคนแก้คิวนี้ไปก่อนแล้ว กดย้อนกลับแล้วเปิดใหม่");
    if (m.includes("bill_exists")) throw new SalonError(409, "คิวนี้ปิดบิลไปแล้ว");
    if (m.includes("points_not_enough")) throw new SalonError(409, "แต้มลูกค้าไม่พอ");
    if (m.includes("points_no_customer")) throw new SalonError(400, "ต้องเลือกลูกค้าก่อนใช้แต้ม");
    if (m.includes("customers_shop_phone")) throw new SalonError(409, "เบอร์นี้มีลูกค้าอยู่แล้ว");
    if (m.includes("bill_not_found") || m.includes("not_found")) throw new SalonError(404, "ไม่พบข้อมูล");
    throw new Error(m);
  }
  return res.data;
}

export async function body(req: NextRequest): Promise<Record<string, unknown>> {
  return ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>;
}

export const str = (v: unknown, max = 200) => (v == null ? "" : String(v).trim().slice(0, max));
export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function isDay(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
}

// ───────────── ข้อมูลพื้นฐานของร้าน

export async function loadSettings(shop: string): Promise<SalonSettings> {
  const { data } = await sdb().from("settings").select("data").eq("shop_id", shop).maybeSingle();
  return mergeSettings(data?.data);
}

export async function loadStylists(shop: string, all = false): Promise<Stylist[]> {
  let q = sdb()
    .from("stylists")
    .select("id,name,level,commission_pct,color,sort,active")
    .eq("shop_id", shop)
    .order("sort")
    .order("created_at");
  if (!all) q = q.eq("active", true);
  return (check(await q) || []) as Stylist[];
}

export async function loadServices(shop: string, all = false): Promise<Service[]> {
  let q = sdb()
    .from("services")
    .select("id,category,name,price,price_from,duration_min,wait_min,wait_after_min,needs_deposit,rebook_days,sort,active")
    .eq("shop_id", shop)
    .order("sort")
    .order("created_at");
  if (!all) q = q.eq("active", true);
  const rows = (check(await q) || []) as Service[];
  return rows.map((s) => ({ ...s, price: Number(s.price) }));
}

// ───────────── คิว

const DAY_START = (day: string) => toIso(day, "00:00");
const DAY_END = (day: string) => new Date(new Date(toIso(day, "00:00")).getTime() + 86400000).toISOString();

const VISIT_COLS =
  "id,customer_id,guest_name,source,status,start_at,end_at,stylist_id,queue_no,note,deposit_required,cancel_reason,version";

type VisitRow = Omit<Visit, "services" | "customer" | "deposit_paid" | "bill">;

/** เติมรายการบริการ ลูกค้า มัดจำ และบิล ให้คิวหลายคิวในครั้งเดียว */
async function hydrate(shop: string, rows: VisitRow[]): Promise<Visit[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const custIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))] as string[];
  const [svc, cust, pays, bills] = await Promise.all([
    sdb()
      .from("visit_services")
      .select("id,visit_id,service_id,name,quoted_price,final_price,price_from,price_confirmed_by,duration_min,wait_min,wait_after_min,stylist_id,assistant_id,sort")
      .eq("shop_id", shop)
      .in("visit_id", ids)
      .order("sort"),
    custIds.length
      ? sdb()
          .from("customers")
          .select("id,name,nickname,phone,points,allergies,no_show_count")
          .eq("shop_id", shop)
          .in("id", custIds)
      : Promise.resolve({ data: [], error: null }),
    sdb()
      .from("payments")
      .select("visit_id,amount")
      .eq("shop_id", shop)
      .eq("kind", "deposit")
      .is("bill_id", null)
      .in("visit_id", ids),
    sdb()
      .from("bills")
      .select("id,visit_id,bill_no,total,status")
      .eq("shop_id", shop)
      .neq("status", "void")
      .in("visit_id", ids),
  ]);
  const services = (check(svc) || []) as (VisitService & { visit_id: string })[];
  const customers = (check(cust) || []) as NonNullable<Visit["customer"]>[];
  const deposits = (check(pays) || []) as { visit_id: string; amount: number }[];
  const billRows = (check(bills) || []) as { id: string; visit_id: string; bill_no: number; total: number; status: string }[];
  return rows.map((r) => ({
    ...r,
    deposit_required: Number(r.deposit_required) || 0,
    services: services
      .filter((s) => s.visit_id === r.id)
      .map((s) => ({
        ...s,
        quoted_price: Number(s.quoted_price),
        final_price: s.final_price == null ? null : Number(s.final_price),
      })),
    customer: customers.find((c) => c.id === r.customer_id) || null,
    deposit_paid: deposits.filter((d) => d.visit_id === r.id).reduce((a, d) => a + Number(d.amount), 0),
    bill: billRows.find((b) => b.visit_id === r.id) || null,
  }));
}

export async function listVisits(shop: string, day: string): Promise<Visit[]> {
  const rows = check(
    await sdb()
      .from("visits")
      .select(VISIT_COLS)
      .eq("shop_id", shop)
      .gte("start_at", DAY_START(day))
      .lt("start_at", DAY_END(day))
      .order("start_at")
  ) as VisitRow[];
  return hydrate(shop, rows || []);
}

export async function getVisit(shop: string, id: string): Promise<Visit> {
  if (!isUuid(id)) throw new SalonError(404, "ไม่พบคิวนี้");
  const row = check(await sdb().from("visits").select(VISIT_COLS).eq("shop_id", shop).eq("id", id).maybeSingle()) as VisitRow | null;
  if (!row) throw new SalonError(404, "ไม่พบคิวนี้");
  return (await hydrate(shop, [row]))[0];
}

export async function visitsOfCustomer(shop: string, customerId: string): Promise<Visit[]> {
  const rows = check(
    await sdb()
      .from("visits")
      .select(VISIT_COLS)
      .eq("shop_id", shop)
      .eq("customer_id", customerId)
      .order("start_at", { ascending: false })
      .limit(30)
  ) as VisitRow[];
  return hydrate(shop, rows || []);
}

// ───────────── ช่วงเวลาว่าง

/** ช่วงที่ช่างแต่ละคนติดงานในวันนั้น (นาทีนับจากเที่ยงคืนเวลาไทย) */
async function busyByStylist(shop: string, day: string, excludeVisit?: string): Promise<Map<string, Busy[]>> {
  // ดึงช่วงที่คาบเกี่ยววันนั้น (ใช้ start/end ของคิวกรองคร่าว ๆ แล้วอ่าน period จริง)
  const visits = check(
    await sdb()
      .from("visits")
      .select("id")
      .eq("shop_id", shop)
      .gte("start_at", DAY_START(day))
      .lt("start_at", DAY_END(day))
      .not("status", "in", "(cancelled,no_show)")
  ) as { id: string }[];
  const ids = (visits || []).map((v) => v.id).filter((id) => id !== excludeVisit);
  const map = new Map<string, Busy[]>();
  if (!ids.length) return map;
  const slots = check(
    await sdb().from("visit_slots").select("stylist_id,period").eq("shop_id", shop).in("visit_id", ids)
  ) as { stylist_id: string; period: string }[];
  for (const s of slots || []) {
    // period รูปแบบ ["2026-11-14 03:00:00+00","2026-11-14 04:00:00+00")
    const m = s.period.match(/^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/);
    if (!m) continue;
    const from = new Date(m[1].replace(" ", "T").replace(/\+00$/, "Z"));
    const to = new Date(m[2].replace(" ", "T").replace(/\+00$/, "Z"));
    const base = new Date(DAY_START(day)).getTime();
    const b = { from: Math.round((from.getTime() - base) / 60000), to: Math.round((to.getTime() - base) / 60000) };
    map.set(s.stylist_id, [...(map.get(s.stylist_id) || []), b]);
  }
  return map;
}

/**
 * ร้านคนเดียว: มีช่าง 1 คน (เจ้าของร้าน) สร้างให้อัตโนมัติ
 * ยังเก็บเป็นแถวใน stylists เพื่อให้ตัวกันจองซ้อน (visit_slots) ทำงาน และวันหน้ามีลูกน้องก็เพิ่มได้
 */
export async function mainStylistId(shop: string): Promise<string> {
  const list = await loadStylists(shop);
  if (list[0]) return list[0].id;
  const row = check(
    await sdb().from("stylists").insert({ shop_id: shop, name: "เจ้าของร้าน", level: "stylist" }).select("id").single()
  ) as { id: string };
  return row.id;
}

export type Availability = {
  day: string;
  closed: boolean;
  /** เวลาที่จองได้ (HH:MM) */
  times: string[];
  /** วันนี้: ว่างเริ่มได้ทันทีไหม และถ้าไม่ว่าง ว่างอีกทีกี่โมง */
  now: { time: string; free: boolean; next: string | null } | null;
};

export async function availability(
  shop: string,
  day: string,
  services: Pick<VisitService, "duration_min" | "wait_min" | "wait_after_min">[],
  opts: { excludeVisit?: string } = {}
): Promise<Availability> {
  const [settings, stylist, busyMap] = await Promise.all([
    loadSettings(shop),
    mainStylistId(shop),
    busyByStylist(shop, day, opts.excludeVisit),
  ]);
  const busy = busyMap.get(stylist) || [];
  const closed = settings.closed_weekdays.includes(weekdayOf(day));
  const open = minutesOf(settings.open);
  const close = minutesOf(settings.close);
  const step = Math.max(5, settings.slot_step || 30);
  const today = bkkDay(new Date().toISOString());
  const nowMin = day === today ? minutesOf(bkkTime(new Date().toISOString())) : -1;
  const freeAt = (t: number) => !overlaps(busyPlan(t, services).busy, busy);

  const times: string[] = [];
  if (!closed) {
    const total = busyPlan(0, services).end;
    for (let t = open; t + total <= close; t += step) {
      if (day === today && t < nowMin) continue;
      if (freeAt(t)) times.push(hhmmOf(t));
    }
  }

  let now: Availability["now"] = null;
  if (day === today) {
    const start = Math.ceil(nowMin / 5) * 5;
    let next: string | null = null;
    for (let t = start; t < 24 * 60; t += 5) {
      if (freeAt(t)) {
        next = hhmmOf(t);
        break;
      }
    }
    now = { time: hhmmOf(start), free: freeAt(start), next };
  }
  return { day, closed, times, now };
}

/** ช่วงเวลาที่ต้องจองให้ช่าง (ISO) จากเวลาเริ่มและบริการ */
export function slotsFor(day: string, startHHMM: string, stylistId: string | null, services: VisitService[]) {
  const start = minutesOf(startHHMM);
  const plan = busyPlan(start, services);
  const base = new Date(DAY_START(day)).getTime();
  const iso = (m: number) => new Date(base + m * 60000).toISOString();
  return {
    start_at: iso(start),
    end_at: iso(plan.end),
    slots: stylistId ? plan.busy.map((b) => ({ stylist_id: stylistId, from: iso(b.from), to: iso(b.to) })) : [],
  };
}

export async function audit(shop: string, by: string, action: string, entity: string, entityId: string, detail?: unknown, reason?: string) {
  await sdb()
    .from("audit_log")
    .insert({ shop_id: shop, actor: by, action, entity, entity_id: entityId, detail: detail ?? null, reason: reason ?? null });
}

/** ช่องที่แก้ได้ของบริการ (กรองค่าจากหน้าจอ) */
export function serviceFields(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("name" in b) out.name = str(b.name, 80);
  if ("category" in b) out.category = str(b.category, 40) || "ทั่วไป";
  if ("price" in b) out.price = Math.max(0, num(b.price));
  if ("price_from" in b) out.price_from = !!b.price_from;
  if ("duration_min" in b) out.duration_min = Math.min(600, Math.max(5, Math.round(num(b.duration_min)) || 30));
  if ("wait_min" in b) out.wait_min = Math.max(0, Math.round(num(b.wait_min)));
  if ("wait_after_min" in b) out.wait_after_min = Math.max(0, Math.round(num(b.wait_after_min)));
  if ("needs_deposit" in b) out.needs_deposit = !!b.needs_deposit;
  if ("rebook_days" in b) out.rebook_days = b.rebook_days ? Math.max(0, Math.round(num(b.rebook_days))) : null;
  if ("sort" in b) out.sort = Math.round(num(b.sort));
  if ("active" in b) out.active = !!b.active;
  return out;
}


export const CUSTOMER_COLS =
  "id,name,nickname,phone,line_id,birthday,hair_length,allergies,color_formula,notes,marketing_consent,photo_consent,points,no_show_count,created_at";

export async function createOrFindCustomer(shop: string, name: string, phone: string, notes = "") {
  if (!name && !phone) throw new SalonError(400, "ใส่ชื่อหรือเบอร์ลูกค้า");
  if (phone) {
    const found = check(
      await sdb()
        .from("customers")
        .select(CUSTOMER_COLS)
        .eq("shop_id", shop)
        .eq("phone", phone)
        .is("deleted_at", null)
        .is("merged_into", null)
        .maybeSingle()
    );
    if (found) return found;
  }
  return check(
    await sdb()
      .from("customers")
      .insert({ shop_id: shop, name: name || `ลูกค้า ${phone.slice(-4)}`, phone: phone || null, notes: notes || null })
      .select(CUSTOMER_COLS)
      .single()
  );
}

/** รายการบริการของคิว จาก id บริการที่เลือก (เรียงตามที่เลือก ซ้ำได้) */
export async function servicesFromIds(shop: string, ids: string[]): Promise<{ items: VisitService[]; rows: Service[] }> {
  const clean = ids.filter(isUuid);
  if (!clean.length) return { items: [], rows: [] };
  const all = await loadServices(shop, true);
  const rows = clean.map((id) => all.find((s) => s.id === id)).filter(Boolean) as Service[];
  return {
    rows,
    items: rows.map((s) => ({
      service_id: s.id,
      name: s.name,
      quoted_price: Number(s.price),
      final_price: s.price_from ? null : Number(s.price),
      price_from: s.price_from,
      duration_min: s.duration_min,
      wait_min: s.wait_min,
      wait_after_min: s.wait_after_min,
      stylist_id: null,
      assistant_id: null,
    })),
  };
}

/** บันทึกคิวผ่านฟังก์ชันในฐาน (ทำทีเดียวทั้งคิว+บริการ+ช่วงเวลา) */
export async function saveVisit(p: Record<string, unknown>): Promise<{ id: string; queue_no: number | null }> {
  return check(await sdb().rpc("save_visit", { p })) as { id: string; queue_no: number | null };
}

export function nowHHMM(): string {
  const t = minutesOf(bkkTime(new Date().toISOString()));
  return hhmmOf(Math.ceil(t / 5) * 5);
}
