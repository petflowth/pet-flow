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

const promos: PromoRecord[] = [
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

export function listPromos() {
  return [...promos].sort((a, b) => b.until.localeCompare(a.until));
}

export function getActivePromos(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return promos.filter(
    (p) =>
      p.active &&
      p.startDate <= today &&
      p.until >= today
  );
}

export function getPromo(id: string) {
  return promos.find((p) => p.id === id);
}

export function addPromo(data: Omit<PromoRecord, "id">) {
  const promo: PromoRecord = { ...data, id: `P${Date.now()}` };
  promos.unshift(promo);
  return promo;
}

export function updatePromo(id: string, patch: Partial<Omit<PromoRecord, "id">>) {
  const p = promos.find((x) => x.id === id);
  if (!p) return null;
  Object.assign(p, patch);
  return p;
}

export function deletePromo(id: string) {
  const i = promos.findIndex((x) => x.id === id);
  if (i < 0) return false;
  promos.splice(i, 1);
  return true;
}

export function calcPromoDiscount(
  promoId: string | undefined,
  subtotal: number
): { discount: number; label?: string } {
  if (!promoId) return { discount: 0 };
  const p = getPromo(promoId);
  if (!p || !p.active) return { discount: 0 };
  const today = new Date().toISOString().slice(0, 10);
  if (p.startDate > today || p.until < today) return { discount: 0 };

  let discount = 0;
  if (p.discountPercent) {
    discount = Math.round((subtotal * p.discountPercent) / 100);
  }
  if (p.discountAmount) {
    discount = Math.max(discount, p.discountAmount);
  }
  return {
    discount: Math.min(discount, subtotal),
    label: p.title.th,
  };
}
