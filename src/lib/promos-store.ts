import { getSupabase } from "./supabase/server";

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
  },
];

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
  };
}

export async function listPromos() {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("promos").select("*").order("until", { ascending: false });
    return ((data as PromoRow[] | null) || []).map(rowToPromo);
  }
  return [...mem].sort((a, b) => b.until.localeCompare(a.until));
}

export async function getActivePromos(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const all = await listPromos();
  return all.filter((p) => p.active && p.startDate <= today && p.until >= today);
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
  const promo: PromoRecord = { ...data, id: `P${Date.now()}` };
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
