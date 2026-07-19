import type { CustomerRecord } from "./customers-store";

export type CustomerTier = "new" | "regular" | "member" | "vip";

export const TIER_LABELS: Record<CustomerTier, string> = {
  new: "ใหม่",
  regular: "ประจำ",
  member: "Member",
  vip: "VIP",
};

export const TIER_ORDER: CustomerTier[] = ["new", "regular", "member", "vip"];

export type TierRules = {
  regularMinVisits: number;
  vipMinVisits: number;
  vipMinSpend: number;
};

export const DEFAULT_TIER_RULES: TierRules = {
  regularMinVisits: 1,
  vipMinVisits: 5,
  vipMinSpend: 0,
};

/**
 * กฎอัปเกรดระดับลูกค้า (ตั้งเงื่อนไขเองได้)
 * VIP = ครบจำนวนครั้ง หรือ ยอดถึง (อย่างใดอย่างหนึ่ง) · Member = เติมเครดิต · ประจำ = ครบจำนวนครั้ง
 */
export function computeTier(
  visits: number,
  totalSpend: number,
  isMember: boolean,
  rules: TierRules = DEFAULT_TIER_RULES
): CustomerTier {
  const vipByVisits = rules.vipMinVisits > 0 && visits >= rules.vipMinVisits;
  const vipBySpend = rules.vipMinSpend > 0 && totalSpend >= rules.vipMinSpend;
  if (vipByVisits || vipBySpend) return "vip";
  if (isMember) return "member";
  if (rules.regularMinVisits > 0 && visits >= rules.regularMinVisits) return "regular";
  return "new";
}

/** @deprecated ใช้ computeTier แทน (เก็บไว้เผื่อ backward-compat) */
export function computeTierFromVisits(
  visits: number,
  isMember: boolean
): CustomerTier {
  return computeTier(visits, 0, isMember, DEFAULT_TIER_RULES);
}

export function isProfileComplete(c: Pick<CustomerRecord, "phone" | "cats">): boolean {
  return Boolean(c.phone?.trim()) && c.cats.length > 0;
}

export function tierBadgeClass(tier: CustomerTier): string {
  switch (tier) {
    case "vip":
      return "bg-honey/40 text-petflow-chocolate";
    case "member":
      return "bg-latte/30 text-latte-deep";
    case "regular":
      return "bg-sage/25 text-ok";
    default:
      return "bg-paper text-brown-soft";
  }
}
