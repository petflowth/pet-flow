import type { CustomerRecord } from "./customers-store";

export type CustomerTier = "new" | "regular" | "member" | "vip";

export const TIER_LABELS: Record<CustomerTier, string> = {
  new: "ใหม่",
  regular: "ประจำ",
  member: "Member",
  vip: "VIP",
};

export const TIER_ORDER: CustomerTier[] = ["new", "regular", "member", "vip"];

/** กฎอัปเกรด: VIP ≥5 ครั้ง · Member = เติมเครดิต · ประจำ ≥1 ครั้ง */
export function computeTierFromVisits(
  visits: number,
  isMember: boolean
): CustomerTier {
  if (visits >= 5) return "vip";
  if (isMember) return "member";
  if (visits >= 1) return "regular";
  return "new";
}

export function isProfileComplete(c: Pick<CustomerRecord, "phone" | "cats">): boolean {
  return Boolean(c.phone?.trim()) && c.cats.length > 0;
}

export function tierBadgeClass(tier: CustomerTier): string {
  switch (tier) {
    case "vip":
      return "bg-honey/40 text-catcha-chocolate";
    case "member":
      return "bg-latte/30 text-latte-deep";
    case "regular":
      return "bg-sage/25 text-ok";
    default:
      return "bg-paper text-brown-soft";
  }
}
