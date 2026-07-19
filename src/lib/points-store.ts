import { getSiteConfig } from "./config-store";
import { getSupabase } from "./supabase/server";
import { requireTenantId } from "./tenant-context";

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

type HistoryRow = {
  id: string;
  line_user_id: string;
  type: string;
  points: number;
  label_th: string;
  label_en: string;
  coupon_code: string | null;
  created_at: string;
};

const mem = new Map<string, CustomerAccount>();

function seedMem(lineUserId: string, displayName: string): CustomerAccount {
  return {
    lineUserId,
    displayName,
    points: lineUserId === "dev-user" ? 42 : 0,
    history: [],
  };
}

function rowToHistory(r: HistoryRow): PointsHistoryEntry {
  return {
    id: r.id,
    type: r.type as "earn" | "redeem",
    points: r.points,
    labelTh: r.label_th,
    labelEn: r.label_en,
    at: r.created_at,
    couponCode: r.coupon_code || undefined,
  };
}

async function loadHistory(lineUserId: string) {
  const sb = getSupabase();
  if (!sb) return mem.get(lineUserId)?.history || [];
  const { data } = await sb
    .from("points_history")
    .select("*")
    .eq("line_user_id", lineUserId)
    .eq("tenant_id", requireTenantId())
    .order("created_at", { ascending: false });
  return ((data as HistoryRow[] | null) || []).map(rowToHistory);
}

/** แต้มของทุกลูกค้าในครั้งเดียว (ใช้กับตารางลูกค้า — กันยิง query ทีละคน) */
export async function getAllPointsMap(): Promise<Record<string, number>> {
  const sb = getSupabase();
  if (!sb) {
    const map: Record<string, number> = {};
    mem.forEach((acc, lineUserId) => {
      map[lineUserId] = acc.points;
    });
    return map;
  }
  const { data } = await sb
    .from("points_accounts")
    .select("line_user_id, points")
    .eq("tenant_id", requireTenantId());
  const map: Record<string, number> = {};
  for (const row of (data as { line_user_id: string; points: number }[] | null) || []) {
    map[row.line_user_id] = row.points;
  }
  return map;
}

export async function getAccount(
  lineUserId: string,
  displayName = ""
): Promise<CustomerAccount> {
  const sb = getSupabase();
  if (sb) {
    const { data: acc } = await sb
      .from("points_accounts")
      .select("*")
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();

    if (!acc) {
      const points = lineUserId === "dev-user" ? 42 : 0;
      await sb.from("points_accounts").insert({
        line_user_id: lineUserId,
        tenant_id: requireTenantId(),
        display_name: displayName || lineUserId,
        points,
      });
      return {
        lineUserId,
        displayName: displayName || lineUserId,
        points,
        history: [],
      };
    }

    if (displayName && acc.display_name !== displayName) {
      await sb
        .from("points_accounts")
        .update({ display_name: displayName })
        .eq("line_user_id", lineUserId)
        .eq("tenant_id", requireTenantId());
    }

    const history = await loadHistory(lineUserId);
    return {
      lineUserId,
      displayName: displayName || acc.display_name,
      points: acc.points,
      history,
    };
  }

  let account = mem.get(lineUserId);
  if (!account) {
    account = seedMem(lineUserId, displayName);
    mem.set(lineUserId, account);
  }
  if (displayName) account.displayName = displayName;
  return account;
}

export async function redeemReward(
  lineUserId: string,
  rewardId: string,
  displayName = ""
) {
  const config = await getSiteConfig();
  const tier = config.pointsRewards.find((r) => r.id === rewardId);
  if (!tier) return { ok: false as const, error: "invalid_reward" };

  const acc = await getAccount(lineUserId, displayName);
  if (acc.points < tier.points) {
    return { ok: false as const, error: "insufficient_points" };
  }

  const couponCode = `PETFLOW-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  const entry: PointsHistoryEntry = {
    id: `H${Date.now()}`,
    type: "redeem",
    points: -tier.points,
    labelTh: tier.reward.th,
    labelEn: tier.reward.en,
    at: new Date().toISOString(),
    couponCode,
  };

  const sb = getSupabase();
  if (sb) {
    const newPoints = acc.points - tier.points;
    await sb
      .from("points_accounts")
      .update({ points: newPoints, display_name: acc.displayName })
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", requireTenantId());
    await sb.from("points_history").insert({
      id: entry.id,
      tenant_id: requireTenantId(),
      line_user_id: lineUserId,
      type: entry.type,
      points: entry.points,
      label_th: entry.labelTh,
      label_en: entry.labelEn,
      coupon_code: couponCode,
      created_at: entry.at,
    });
    return {
      ok: true as const,
      account: {
        ...acc,
        points: newPoints,
        history: [entry, ...acc.history],
      },
      couponCode,
      reward: tier,
    };
  }

  acc.points -= tier.points;
  acc.history.unshift(entry);
  return { ok: true as const, account: acc, couponCode, reward: tier };
}

export async function addPoints(
  lineUserId: string,
  amount: number,
  labelTh: string,
  labelEn: string,
  displayName = ""
) {
  const acc = await getAccount(lineUserId, displayName);
  const entry: PointsHistoryEntry = {
    id: `H${Date.now()}`,
    type: "earn",
    points: amount,
    labelTh,
    labelEn,
    at: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    const newPoints = acc.points + amount;
    await sb
      .from("points_accounts")
      .update({ points: newPoints })
      .eq("line_user_id", lineUserId)
      .eq("tenant_id", requireTenantId());
    await sb.from("points_history").insert({
      id: entry.id,
      tenant_id: requireTenantId(),
      line_user_id: lineUserId,
      type: entry.type,
      points: entry.points,
      label_th: entry.labelTh,
      label_en: entry.labelEn,
      created_at: entry.at,
    });
    return { ...acc, points: newPoints, history: [entry, ...acc.history] };
  }

  acc.points += amount;
  acc.history.unshift(entry);
  return acc;
}

export async function getPointsHistory(lineUserId: string) {
  return loadHistory(lineUserId);
}
