import { customerSummary, findCustomerByLine, type CustomerRecord } from "./customers-store";
import { getSupabase } from "./supabase/server";

export type PromoKind = "display" | "customer";
export type PromoRestriction = "none" | "first_visit" | "calendar_month";
export type CustomerTier = "all" | "member" | "new" | "returning";

export type PromoRecord = {
  id: string;
  title: { th: string; en: string };
  body: { th: string; en: string };
  discountPercent?: number;
  discountAmount?: number;
  imageUrl?: string;
  startDate: string;
  until: string;
  active: boolean;
  kind: PromoKind;
  restriction: PromoRestriction;
  validMonth?: string;
  tiers: CustomerTier[];
  couponCode?: string;
};

export type PromoClaimRecord = {
  id: string;
  promoId: string;
  customerId: string;
  lineUserId?: string;
  customerName: string;
  promoTitle: string;
  source: "app" | "admin";
  createdAt: string;
};

export type CustomerPromoView = PromoRecord & {
  claimed: boolean;
  eligible: boolean;
  reason?: string;
  claimedAt?: string;
};

type PromoRow = {
  id: string;
  title_th: string;
  title_en: string;
  body_th: string;
  body_en: string;
  discount_percent: number | null;
  discount_amount: number | null;
  image_url: string | null;
  start_date: string;
  until: string;
  active: boolean;
  kind?: string | null;
  restriction?: string | null;
  valid_month?: string | null;
  tiers?: string[] | null;
  coupon_code?: string | null;
};

type PromoClaimRow = {
  id: string;
  promo_id: string;
  customer_id: string;
  line_user_id: string | null;
  customer_name: string;
  promo_title: string;
  source: string;
  created_at: string;
};

const mem: PromoRecord[] = [
  {
    id: "P1",
    title: { th: "สมาชิกใหม่ รับแต้ม x2", en: "New member double points" },
    body: {
      th: "จองครั้งแรกรับแต้มสะสม 2 เท่า 🧡",
      en: "First booking earns 2x loyalty points 🧡",
    },
    startDate: "2026-01-01",
    until: "2026-08-31",
    active: true,
    kind: "display",
    restriction: "none",
    tiers: ["all"],
  },
  {
    id: "P2",
    title: { th: "พัก 7 คืนขึ้นไป ฟรีกล้อง CCTV", en: "7+ nights free CCTV" },
    body: {
      th: "ห้อง MiNi Meow / Mid Cozy / Cat Tower รับฟรีกล้องวงจรปิด",
      en: "MiNi Meow, Mid Cozy & Cat Tower — free CCTV for 7+ nights",
    },
    startDate: "2026-01-01",
    until: "2026-12-31",
    active: true,
    kind: "display",
    restriction: "none",
    tiers: ["all"],
  },
  {
    id: "PC1",
    title: { th: "โปรต้อนรับลูกค้าใหม่", en: "Welcome offer" },
    body: {
      th: "ลูกค้าใหม่รับส่วนลด 10% สำหรับบริการครั้งแรก — กดใช้ที่หน้าร้าน",
      en: "New customers get 10% off first visit — tap to claim",
    },
    discountPercent: 10,
    startDate: "2026-01-01",
    until: "2026-12-31",
    active: true,
    kind: "customer",
    restriction: "first_visit",
    tiers: ["new"],
    couponCode: "WELCOME10",
  },
];

const memClaims: PromoClaimRecord[] = [];

function normalizeTiers(tiers?: string[] | null): CustomerTier[] {
  const list = (tiers || []).filter(Boolean) as CustomerTier[];
  return list.length ? list : ["all"];
}

function rowToPromo(r: PromoRow): PromoRecord {
  return {
    id: r.id,
    title: { th: r.title_th, en: r.title_en },
    body: { th: r.body_th, en: r.body_en },
    discountPercent: r.discount_percent ?? undefined,
    discountAmount: r.discount_amount ?? undefined,
    imageUrl: r.image_url ?? undefined,
    startDate: r.start_date,
    until: r.until,
    active: r.active,
    kind: (r.kind as PromoKind) || "display",
    restriction: (r.restriction as PromoRestriction) || "none",
    validMonth: r.valid_month ?? undefined,
    tiers: normalizeTiers(r.tiers),
    couponCode: r.coupon_code ?? undefined,
  };
}

function promoToRow(p: PromoRecord) {
  return {
    id: p.id,
    title_th: p.title.th,
    title_en: p.title.en,
    body_th: p.body.th,
    body_en: p.body.en,
    discount_percent: p.discountPercent ?? null,
    discount_amount: p.discountAmount ?? null,
    image_url: p.imageUrl ?? null,
    start_date: p.startDate,
    until: p.until,
    active: p.active,
    kind: p.kind,
    restriction: p.restriction,
    valid_month: p.validMonth ?? null,
    tiers: p.tiers,
    coupon_code: p.couponCode ?? null,
  };
}

function rowToClaim(r: PromoClaimRow): PromoClaimRecord {
  return {
    id: r.id,
    promoId: r.promo_id,
    customerId: r.customer_id,
    lineUserId: r.line_user_id ?? undefined,
    customerName: r.customer_name,
    promoTitle: r.promo_title,
    source: r.source as PromoClaimRecord["source"],
    createdAt: r.created_at,
  };
}

function claimToRow(c: PromoClaimRecord) {
  return {
    id: c.id,
    promo_id: c.promoId,
    customer_id: c.customerId,
    line_user_id: c.lineUserId ?? null,
    customer_name: c.customerName,
    promo_title: c.promoTitle,
    source: c.source,
    created_at: c.createdAt,
  };
}

function currentMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

export function customerMatchesTiers(
  customer: CustomerRecord,
  visits: number,
  tiers: CustomerTier[]
): boolean {
  if (!tiers.length || tiers.includes("all")) return true;
  if (tiers.includes("member") && customer.isMember) return true;
  if (tiers.includes("new") && visits === 0) return true;
  if (tiers.includes("returning") && visits > 0) return true;
  return false;
}

export function checkPromoEligibility(
  promo: PromoRecord,
  customer: CustomerRecord,
  visits: number,
  claimed: boolean,
  now = new Date()
): { eligible: boolean; reason?: string } {
  const today = now.toISOString().slice(0, 10);

  if (!promo.active) return { eligible: false, reason: "โปรนี้ปิดใช้งานแล้ว" };
  if (promo.startDate > today) return { eligible: false, reason: "โปรยังไม่เริ่ม" };
  if (promo.until < today) return { eligible: false, reason: "โปรหมดอายุแล้ว" };

  if (promo.restriction === "calendar_month" && promo.validMonth) {
    if (currentMonth(now) !== promo.validMonth) {
      return { eligible: false, reason: `โปรนี้ใช้ได้เฉพาะเดือน ${promo.validMonth}` };
    }
  }

  if (promo.restriction === "first_visit" && visits > 0) {
    return { eligible: false, reason: "โปรนี้สำหรับลูกค้าใหม่เท่านั้น" };
  }

  if (!customerMatchesTiers(customer, visits, promo.tiers)) {
    return { eligible: false, reason: "โปรนี้ไม่ตรงกับกลุ่มลูกค้าของคุณ" };
  }

  if (claimed) {
    return { eligible: false, reason: "คุณใช้โปรนี้แล้ว" };
  }

  return { eligible: true };
}

export async function listPromoClaims(promoId?: string) {
  const sb = getSupabase();
  if (sb) {
    let q = sb.from("promo_claims").select("*").order("created_at", { ascending: false });
    if (promoId) q = q.eq("promo_id", promoId);
    const { data } = await q;
    return ((data as PromoClaimRow[] | null) || []).map(rowToClaim);
  }
  const list = [...memClaims].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return promoId ? list.filter((c) => c.promoId === promoId) : list;
}

async function getClaimForCustomer(promoId: string, customerId: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("promo_claims")
      .select("*")
      .eq("promo_id", promoId)
      .eq("customer_id", customerId)
      .maybeSingle();
    return data ? rowToClaim(data as PromoClaimRow) : undefined;
  }
  return memClaims.find((c) => c.promoId === promoId && c.customerId === customerId);
}

export async function listPromos() {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("promos").select("*").order("until", { ascending: false });
    return ((data as PromoRow[] | null) || []).map(rowToPromo);
  }
  return [...mem].sort((a, b) => b.until.localeCompare(a.until));
}

export async function getActivePromos(now = new Date(), kind?: PromoKind) {
  const today = now.toISOString().slice(0, 10);
  const all = await listPromos();
  return all.filter(
    (p) =>
      p.active &&
      p.startDate <= today &&
      p.until >= today &&
      (kind ? p.kind === kind : true)
  );
}

export async function getCustomerPromos(lineUserId: string, now = new Date()): Promise<CustomerPromoView[]> {
  const customer = await findCustomerByLine(lineUserId);
  if (!customer) return [];

  const summary = await customerSummary(customer.id);
  const visits = summary?.visits ?? 0;
  const promos = await getActivePromos(now, "customer");

  const views: CustomerPromoView[] = [];
  for (const promo of promos) {
    const claim = await getClaimForCustomer(promo.id, customer.id);
    const { eligible, reason } = checkPromoEligibility(
      promo,
      customer,
      visits,
      Boolean(claim),
      now
    );
    views.push({
      ...promo,
      claimed: Boolean(claim),
      eligible,
      reason,
      claimedAt: claim?.createdAt,
    });
  }

  return views;
}

export async function claimCustomerPromo(
  promoId: string,
  lineUserId: string,
  source: PromoClaimRecord["source"] = "app"
): Promise<{ ok: true; claim: PromoClaimRecord; promo: PromoRecord } | { ok: false; error: string }> {
  const customer = await findCustomerByLine(lineUserId);
  if (!customer) return { ok: false, error: "ไม่พบข้อมูลลูกค้า — เปิดแอปจาก LINE อีกครั้ง" };

  const promo = await getPromo(promoId);
  if (!promo || promo.kind !== "customer") {
    return { ok: false, error: "ไม่พบโปรนี้" };
  }

  const summary = await customerSummary(customer.id);
  const visits = summary?.visits ?? 0;
  const existing = await getClaimForCustomer(promoId, customer.id);
  const { eligible, reason } = checkPromoEligibility(
    promo,
    customer,
    visits,
    Boolean(existing)
  );

  if (!eligible) return { ok: false, error: reason || "ใช้โปรนี้ไม่ได้" };

  const claim: PromoClaimRecord = {
    id: `CL${Date.now()}`,
    promoId,
    customerId: customer.id,
    lineUserId,
    customerName: customer.name,
    promoTitle: promo.title.th,
    source,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("promo_claims").insert(claimToRow(claim));
    if (error) return { ok: false, error: "บันทึกไม่สำเร็จ — อาจใช้โปรนี้แล้ว" };
  } else {
    memClaims.unshift(claim);
  }

  return { ok: true, claim, promo };
}

export async function getPromo(id: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("promos").select("*").eq("id", id).maybeSingle();
    return data ? rowToPromo(data as PromoRow) : undefined;
  }
  return mem.find((p) => p.id === id);
}

export async function addPromo(data: Omit<PromoRecord, "id">) {
  const promo: PromoRecord = {
    ...data,
    id: `P${Date.now()}`,
    kind: data.kind || "display",
    restriction: data.restriction || "none",
    tiers: data.tiers?.length ? data.tiers : ["all"],
  };
  const sb = getSupabase();
  if (sb) {
    await sb.from("promos").insert(promoToRow(promo));
    return promo;
  }
  mem.unshift(promo);
  return promo;
}

export async function updatePromo(id: string, patch: Partial<Omit<PromoRecord, "id">>) {
  const existing = await getPromo(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  if (patch.title) updated.title = { ...existing.title, ...patch.title };
  if (patch.body) updated.body = { ...existing.body, ...patch.body };

  const sb = getSupabase();
  if (sb) {
    await sb.from("promos").update(promoToRow(updated)).eq("id", id);
    return updated;
  }

  const i = mem.findIndex((x) => x.id === id);
  if (i < 0) return null;
  mem[i] = updated;
  return updated;
}

export async function deletePromo(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb.from("promos").delete().eq("id", id);
    return true;
  }
  const i = mem.findIndex((x) => x.id === id);
  if (i < 0) return false;
  mem.splice(i, 1);
  return true;
}

export async function calcPromoDiscount(
  promoId: string | undefined,
  subtotal: number
): Promise<{ discount: number; label?: string }> {
  if (!promoId) return { discount: 0 };
  const p = await getPromo(promoId);
  if (!p || !p.active) return { discount: 0 };
  const today = new Date().toISOString().slice(0, 10);
  if (p.startDate > today || p.until < today) return { discount: 0 };

  let discount = 0;
  if (p.discountPercent) discount = Math.round((subtotal * p.discountPercent) / 100);
  if (p.discountAmount) discount = Math.max(discount, p.discountAmount);
  return { discount: Math.min(discount, subtotal), label: p.title.th };
}
