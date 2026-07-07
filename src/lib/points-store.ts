import { POINTS_REWARDS } from "./business";

export type PointsHistoryEntry = {
  id: string;
  type: "earn" | "redeem";
  points: number;
  labelTh: string;
  labelEn: string;
  at: string;
  couponCode?: string;
};

export type CustomerAccount = {
  lineUserId: string;
  displayName: string;
  points: number;
  history: PointsHistoryEntry[];
};

const accounts = new Map<string, CustomerAccount>();

function seedAccount(lineUserId: string, displayName: string): CustomerAccount {
  return {
    lineUserId,
    displayName,
    points: lineUserId === "dev-user" ? 42 : 0,
    history: [],
  };
}

export function getAccount(lineUserId: string, displayName = ""): CustomerAccount {
  let acc = accounts.get(lineUserId);
  if (!acc) {
    acc = seedAccount(lineUserId, displayName);
    accounts.set(lineUserId, acc);
  }
  if (displayName) acc.displayName = displayName;
  return acc;
}

export function redeemReward(
  lineUserId: string,
  rewardId: string,
  displayName = ""
) {
  const tier = POINTS_REWARDS.find((r) => r.id === rewardId);
  if (!tier) return { ok: false as const, error: "invalid_reward" };

  const acc = getAccount(lineUserId, displayName);
  if (acc.points < tier.points) {
    return { ok: false as const, error: "insufficient_points" };
  }

  acc.points -= tier.points;
  const couponCode = `CATCHA-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const entry: PointsHistoryEntry = {
    id: `H${Date.now()}`,
    type: "redeem",
    points: -tier.points,
    labelTh: tier.reward.th,
    labelEn: tier.reward.en,
    at: new Date().toISOString(),
    couponCode,
  };
  acc.history.unshift(entry);

  return {
    ok: true as const,
    account: acc,
    couponCode,
    reward: tier,
  };
}

export function addPoints(
  lineUserId: string,
  amount: number,
  labelTh: string,
  labelEn: string,
  displayName = ""
) {
  const acc = getAccount(lineUserId, displayName);
  acc.points += amount;
  acc.history.unshift({
    id: `H${Date.now()}`,
    type: "earn",
    points: amount,
    labelTh,
    labelEn,
    at: new Date().toISOString(),
  });
  return acc;
}
