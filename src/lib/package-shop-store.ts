import { getSupabase } from "./supabase/server";
import { uploadDataUrlToStorage } from "./supabase/storage";
import { requireTenantId } from "./tenant-context";

/**
 * ร้านขายคอร์ส/แพ็กเกจในแอปลูกค้า
 *
 * แยกเป็น 2 ส่วน:
 * - PackageOffer = "อะไรที่ขายอยู่" (ร้านตั้งเอง โชว์ในหน้าแรกของลูกค้า)
 * - PackageOrder = "ลูกค้ากดซื้อแล้วรอโอน" — ร้านกดยืนยันรับเงินแล้วค่อยกลายเป็นคอร์สจริง
 *
 * จงใจไม่สร้างคอร์สให้ทันทีที่กดซื้อ เพราะเงินยังไม่เข้า —
 * คอร์สจะถูกสร้างตอนร้านกดยืนยันเท่านั้น (ดู confirmPackageOrder)
 */

export type PackageOffer = {
  id: string;
  name: string;
  totalUses: number;
  price: number;
  description?: string;
  active: boolean;
  createdAt: string;
};

export type PackageOrderStatus = "pending" | "paid" | "cancelled";

export type PackageOrder = {
  id: string;
  customerId: string;
  customerName: string;
  lineUserId?: string;
  offerId?: string;
  /** ก๊อปชื่อ/จำนวนครั้ง/ราคา ณ ตอนสั่ง — ร้านแก้ราคาทีหลังไม่กระทบออร์เดอร์เก่า */
  name: string;
  totalUses: number;
  price: number;
  status: PackageOrderStatus;
  slipUrl?: string;
  /** id ของคอร์สที่สร้างให้ตอนยืนยัน — กันยืนยันซ้ำแล้วได้คอร์สสองใบ */
  packageId?: string;
  createdAt: string;
  paidAt?: string;
};

type OfferRow = {
  id: string;
  name: string | null;
  total_uses: number;
  price: number;
  description: string | null;
  active: boolean;
  created_at: string;
};

type OrderRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  line_user_id: string | null;
  offer_id: string | null;
  name: string | null;
  total_uses: number;
  price: number;
  status: string;
  slip_url: string | null;
  package_id: string | null;
  created_at: string;
  paid_at: string | null;
};

const memOffers: PackageOffer[] = [];
const memOrders: PackageOrder[] = [];

function rowToOffer(r: OfferRow): PackageOffer {
  return {
    id: r.id,
    name: r.name || "",
    totalUses: Number(r.total_uses) || 0,
    price: Number(r.price) || 0,
    description: r.description || undefined,
    active: r.active !== false,
    createdAt: r.created_at,
  };
}

function rowToOrder(r: OrderRow): PackageOrder {
  return {
    id: r.id,
    customerId: r.customer_id || "",
    customerName: r.customer_name || "",
    lineUserId: r.line_user_id || undefined,
    offerId: r.offer_id || undefined,
    name: r.name || "",
    totalUses: Number(r.total_uses) || 0,
    price: Number(r.price) || 0,
    status: (r.status as PackageOrderStatus) || "pending",
    slipUrl: r.slip_url || undefined,
    packageId: r.package_id || undefined,
    createdAt: r.created_at,
    paidAt: r.paid_at || undefined,
  };
}

/* ───────── แพ็กเกจที่เปิดขาย ───────── */

export async function listPackageOffers(activeOnly = false): Promise<PackageOffer[]> {
  const sb = getSupabase();
  let list: PackageOffer[];
  if (sb) {
    try {
      const { data, error } = await sb
        .from("package_offers")
        .select("*")
        .eq("tenant_id", requireTenantId())
        .order("created_at", { ascending: true });
      if (error) return [];
      list = ((data as OfferRow[] | null) || []).map(rowToOffer);
    } catch {
      return [];
    }
  } else {
    list = [...memOffers];
  }
  return activeOnly ? list.filter((o) => o.active) : list;
}

export async function createPackageOffer(data: {
  name: string;
  totalUses: number;
  price: number;
  description?: string;
}): Promise<PackageOffer | null> {
  const name = data.name.trim();
  const totalUses = Math.max(1, Math.round(data.totalUses) || 0);
  const price = Math.max(0, Math.round(data.price) || 0);
  if (!name) return null;

  const offer: PackageOffer = {
    id: `POF${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name,
    totalUses,
    price,
    description: data.description?.trim() || undefined,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("package_offers").insert({
      id: offer.id,
      tenant_id: requireTenantId(),
      name: offer.name,
      total_uses: offer.totalUses,
      price: offer.price,
      description: offer.description || null,
      active: true,
      created_at: offer.createdAt,
    });
  } else {
    memOffers.push(offer);
  }
  return offer;
}

export async function setPackageOfferActive(id: string, active: boolean) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("package_offers")
      .update({ active })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const o = memOffers.find((x) => x.id === id);
    if (o) o.active = active;
  }
  return { ok: true as const };
}

export async function deletePackageOffer(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("package_offers")
      .delete()
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const i = memOffers.findIndex((x) => x.id === id);
    if (i >= 0) memOffers.splice(i, 1);
  }
  return { ok: true as const };
}

/* ───────── ออร์เดอร์ที่ลูกค้ากดซื้อ ───────── */

export async function listPackageOrders(filter?: {
  status?: PackageOrderStatus;
  customerId?: string;
}): Promise<PackageOrder[]> {
  const sb = getSupabase();
  let list: PackageOrder[];
  if (sb) {
    try {
      let q = sb.from("package_orders").select("*").eq("tenant_id", requireTenantId());
      if (filter?.status) q = q.eq("status", filter.status);
      if (filter?.customerId) q = q.eq("customer_id", filter.customerId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) return [];
      list = ((data as OrderRow[] | null) || []).map(rowToOrder);
    } catch {
      return [];
    }
  } else {
    list = memOrders.filter(
      (o) =>
        (!filter?.status || o.status === filter.status) &&
        (!filter?.customerId || o.customerId === filter.customerId)
    );
  }
  return list;
}

export async function getPackageOrder(id: string): Promise<PackageOrder | undefined> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data } = await sb
        .from("package_orders")
        .select("*")
        .eq("id", id)
        .eq("tenant_id", requireTenantId())
        .maybeSingle();
      return data ? rowToOrder(data as OrderRow) : undefined;
    } catch {
      return undefined;
    }
  }
  return memOrders.find((o) => o.id === id);
}

/** ลูกค้ากดซื้อ — ยังไม่ได้เงิน จึงยังไม่สร้างคอร์ส แค่ตั้งออร์เดอร์รอโอน */
export async function createPackageOrder(data: {
  customerId: string;
  customerName: string;
  lineUserId?: string;
  offer: PackageOffer;
}): Promise<PackageOrder> {
  const order: PackageOrder = {
    id: `POR${Date.now()}${Math.floor(Math.random() * 1000)}`,
    customerId: data.customerId,
    customerName: data.customerName,
    lineUserId: data.lineUserId,
    offerId: data.offer.id,
    name: data.offer.name,
    totalUses: data.offer.totalUses,
    price: data.offer.price,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("package_orders").insert({
      id: order.id,
      tenant_id: requireTenantId(),
      customer_id: order.customerId,
      customer_name: order.customerName,
      line_user_id: order.lineUserId || null,
      offer_id: order.offerId || null,
      name: order.name,
      total_uses: order.totalUses,
      price: order.price,
      status: "pending",
      created_at: order.createdAt,
    });
  } else {
    memOrders.unshift(order);
  }
  return order;
}

/** ลูกค้าแนบสลิป — เก็บเป็นไฟล์ใน storage ถ้าตั้งค่าไว้ (ไม่งั้นเก็บ data URL ตามเดิม) */
export async function attachOrderSlip(id: string, slipDataUrl: string) {
  const order = await getPackageOrder(id);
  if (!order) return { ok: false as const, error: "not_found" };
  if (order.status !== "pending") {
    return { ok: false as const, error: "not_pending" };
  }
  const url = await uploadDataUrlToStorage(`package-slips/${id}`, slipDataUrl);

  const sb = getSupabase();
  if (sb) {
    await sb
      .from("package_orders")
      .update({ slip_url: url })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const o = memOrders.find((x) => x.id === id);
    if (o) o.slipUrl = url;
  }
  return { ok: true as const, slipUrl: url };
}

/**
 * ร้านกดยืนยันว่าได้เงินแล้ว → สร้างคอร์สจริงให้ลูกค้า + ลงรายรับ
 *
 * อัปเดตสถานะแบบมีเงื่อนไข (เฉพาะตอนยัง pending) ก่อนจะสร้างคอร์ส
 * กันกดสองทีแล้วลูกค้าได้คอร์สซ้ำ/รายรับซ้ำ
 */
export async function confirmPackageOrder(
  id: string,
  opts?: { isLegacy?: boolean }
) {
  const order = await getPackageOrder(id);
  if (!order) return { ok: false as const, error: "not_found" };
  if (order.status !== "pending") {
    return { ok: false as const, error: "not_pending" };
  }

  const paidAt = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    // จองสิทธิ์ก่อน — ถ้าอีกคลิกชิงไปแล้วจะไม่มีแถวถูกแก้ แปลว่าแพ้การแข่ง ให้หยุด
    const { data: claimed } = await sb
      .from("package_orders")
      .update({ status: "paid", paid_at: paidAt })
      .eq("id", id)
      .eq("tenant_id", requireTenantId())
      .eq("status", "pending")
      .select("id");
    if (!claimed || claimed.length === 0) {
      return { ok: false as const, error: "not_pending" };
    }
  } else {
    const o = memOrders.find((x) => x.id === id);
    if (!o || o.status !== "pending") {
      return { ok: false as const, error: "not_pending" };
    }
    o.status = "paid";
    o.paidAt = paidAt;
  }

  const { sellPackage } = await import("./packages-store");
  const pkg = await sellPackage({
    customerId: order.customerId,
    customerName: order.customerName,
    name: order.name,
    totalUses: order.totalUses,
    price: order.price,
    isLegacy: opts?.isLegacy,
  });

  if (sb) {
    await sb
      .from("package_orders")
      .update({ package_id: pkg.id })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const o = memOrders.find((x) => x.id === id);
    if (o) o.packageId = pkg.id;
  }

  return { ok: true as const, order: { ...order, status: "paid" as const, paidAt }, pkg };
}

export async function cancelPackageOrder(id: string) {
  const order = await getPackageOrder(id);
  if (!order) return { ok: false as const, error: "not_found" };
  if (order.status === "paid") {
    // จ่ายแล้วยกเลิกตรงนี้ไม่ได้ — ต้องไปยกเลิกคอร์สที่หน้าลูกค้า ไม่งั้นคอร์สจะค้างอยู่
    return { ok: false as const, error: "already_paid" };
  }
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("package_orders")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const o = memOrders.find((x) => x.id === id);
    if (o) o.status = "cancelled";
  }
  return { ok: true as const };
}
