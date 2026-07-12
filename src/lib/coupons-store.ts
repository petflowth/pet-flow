import { getSupabase } from "./supabase/server";

export type Coupon = {
  id: string;
  code: string;
  customerId?: string;
  amount: number;
  reason: string;
  status: "active" | "used" | "expired";
  expiresAt?: string;
  usedAt?: string;
  usedInvoiceId?: string;
  createdAt: string;
};

type CouponRow = {
  id: string;
  code: string | null;
  customer_id: string | null;
  amount: number;
  reason: string | null;
  status: string;
  expires_at: string | null;
  used_at: string | null;
  used_invoice_id: string | null;
  created_at: string;
};

const mem: Coupon[] = [];

function rowToCoupon(r: CouponRow): Coupon {
  return {
    id: r.id,
    code: r.code || "",
    customerId: r.customer_id || undefined,
    amount: Number(r.amount) || 0,
    reason: r.reason || "",
    status: r.status as Coupon["status"],
    expiresAt: r.expires_at || undefined,
    usedAt: r.used_at || undefined,
    usedInvoiceId: r.used_invoice_id || undefined,
    createdAt: r.created_at,
  };
}

function randCode(prefix: string) {
  // เลี่ยง Math.random ไม่ได้ในบางที่ แต่ที่นี่ฝั่งเซิร์ฟเวอร์ปกติ ใช้ได้
  const r = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}${r.slice(0, 6)}`;
}

/** ออกคูปองให้ลูกค้า (referral / โปร / แต้ม ฯลฯ) */
export async function issueCoupon(data: {
  customerId: string;
  amount: number;
  reason: string;
  expiresInDays?: number;
}): Promise<Coupon> {
  const now = new Date();
  const expiresAt = data.expiresInDays
    ? new Date(now.getTime() + data.expiresInDays * 86400000).toISOString()
    : undefined;
  const coupon: Coupon = {
    id: `CPN${now.getTime()}${Math.floor(Math.random() * 1000)}`,
    code: randCode("CAT"),
    customerId: data.customerId,
    amount: Math.round(data.amount) || 0,
    reason: data.reason,
    status: "active",
    expiresAt,
    createdAt: now.toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("coupons").insert({
      id: coupon.id,
      code: coupon.code,
      customer_id: coupon.customerId || null,
      amount: coupon.amount,
      reason: coupon.reason || null,
      status: coupon.status,
      expires_at: coupon.expiresAt || null,
      created_at: coupon.createdAt,
    });
  } else {
    mem.unshift(coupon);
  }
  return coupon;
}

function withComputedStatus(c: Coupon): Coupon {
  if (c.status === "active" && c.expiresAt && c.expiresAt < new Date().toISOString()) {
    return { ...c, status: "expired" };
  }
  return c;
}

/** คูปองทั้งหมดของลูกค้า (คำนวณสถานะหมดอายุให้อัตโนมัติ) */
export async function listCustomerCoupons(customerId: string): Promise<Coupon[]> {
  const sb = getSupabase();
  let list: Coupon[];
  if (sb) {
    const { data } = await sb
      .from("coupons")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    list = ((data as CouponRow[] | null) || []).map(rowToCoupon);
  } else {
    list = mem.filter((c) => c.customerId === customerId);
  }
  return list.map(withComputedStatus);
}

/** เฉพาะคูปองที่ใช้ได้ (active + ยังไม่หมดอายุ) */
export async function activeCustomerCoupons(customerId: string): Promise<Coupon[]> {
  return (await listCustomerCoupons(customerId)).filter((c) => c.status === "active");
}

export async function getCoupon(id: string): Promise<Coupon | undefined> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("coupons").select("*").eq("id", id).maybeSingle();
    return data ? withComputedStatus(rowToCoupon(data as CouponRow)) : undefined;
  }
  const c = mem.find((x) => x.id === id);
  return c ? withComputedStatus(c) : undefined;
}

/** ใช้คูปอง (mark used) — ผูกกับบิลที่ใช้ */
export async function redeemCoupon(id: string, invoiceId?: string) {
  const c = await getCoupon(id);
  if (!c) return { ok: false as const, error: "not_found" };
  if (c.status !== "active") return { ok: false as const, error: "not_usable", coupon: c };
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("coupons")
      .update({ status: "used", used_at: now, used_invoice_id: invoiceId || null })
      .eq("id", id);
  } else {
    const m = mem.find((x) => x.id === id);
    if (m) {
      m.status = "used";
      m.usedAt = now;
      m.usedInvoiceId = invoiceId;
    }
  }
  return { ok: true as const, coupon: { ...c, status: "used" as const, usedAt: now, usedInvoiceId: invoiceId } };
}

/** คืนคูปองกลับมาใช้ได้ (เช่นลบบิลที่ใช้คูปองไป) */
export async function unredeemCoupon(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("coupons")
      .update({ status: "active", used_at: null, used_invoice_id: null })
      .eq("id", id);
  } else {
    const m = mem.find((x) => x.id === id);
    if (m) {
      m.status = "active";
      m.usedAt = undefined;
      m.usedInvoiceId = undefined;
    }
  }
}
