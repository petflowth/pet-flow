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

/**
 * แต้มผูกกับ "ลูกค้า" ไม่ใช่ LINE ID ดิบ
 *
 * LINE ให้ User ID คนละตัวได้บนคอม (LIFF) กับมือถือ (ในแอป LINE) ถ้าคนละ Provider
 * แต่ findCustomerByLine(ID เครื่องปัจจุบัน) ชี้กลับมาลูกค้าคนเดิมเสมอ → ใช้คีย์
 * C:<customerId> เก็บแต้ม แต้มจึงรวมเป็นบัญชีเดียวไม่แตกตามอุปกรณ์
 */
async function resolvePointsKey(lineUserId: string): Promise<string> {
  const id = (lineUserId || "").trim();
  if (!id || id.startsWith("C:")) return id;
  try {
    const { findCustomerByLine } = await import("./customers-store");
    const c = await findCustomerByLine(id);
    return c ? `C:${c.id}` : id;
  } catch {
    return id;
  }
}

/** ย้ายแต้ม/ประวัติจาก LINE ID ดิบ → คีย์ลูกค้า (รวมครั้งเดียว กันแต้มค้างคนละ ID) */
async function migrateLegacyPoints(rawId: string, key: string) {
  const sb = getSupabase();
  if (rawId === key) return;
  if (sb) {
    const tenantId = requireTenantId();
    const { data: legacy } = await sb
      .from("points_accounts")
      .select("*")
      .eq("line_user_id", rawId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!legacy) return;
    await sb
      .from("points_history")
      .update({ line_user_id: key })
      .eq("line_user_id", rawId)
      .eq("tenant_id", tenantId);
    const { data: keyAcc } = await sb
      .from("points_accounts")
      .select("points, display_name")
      .eq("line_user_id", key)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const merged = (keyAcc?.points || 0) + (legacy.points || 0);
    if (keyAcc) {
      await sb
        .from("points_accounts")
        .update({ points: merged, display_name: keyAcc.display_name || legacy.display_name })
        .eq("line_user_id", key)
        .eq("tenant_id", tenantId);
    } else {
      await sb.from("points_accounts").insert({
        line_user_id: key,
        tenant_id: tenantId,
        points: merged,
        display_name: legacy.display_name,
      });
    }
    await sb.from("points_accounts").delete().eq("line_user_id", rawId).eq("tenant_id", tenantId);
    return;
  }
  const legacy = mem.get(rawId);
  if (!legacy) return;
  const keyAcc = mem.get(key) || seedMem(key, legacy.displayName);
  keyAcc.points += legacy.points;
  keyAcc.history = [...legacy.history, ...keyAcc.history];
  mem.set(key, keyAcc);
  mem.delete(rawId);
}

export async function getAccount(
  lineUserId: string,
  displayName = "",
  customerId?: string
): Promise<CustomerAccount> {
  // ถ้า client บอก customerId มาตรงๆ (ตัวที่แอปใช้โชว์ข้อมูลลูกค้า) ใช้เป็นคีย์เลย
  // แม่นกว่าเดา จาก lineUserId เพราะ LINE ID สลับไปมาได้ตามอุปกรณ์
  const key = customerId ? `C:${customerId}` : await resolvePointsKey(lineUserId);

  // รวมแต้มที่ค้างอยู่ใต้ LINE ID เก่า → คีย์ลูกค้า
  // ดึงจาก: (1) LINE ID ที่เปิดเข้ามาตอนนี้ (2) LINE ID ทุกตัวของลูกค้าที่ผูกไว้
  // เพราะ LINE ให้ ID คนละตัวคอม/มือถือ แต้มเก่าอาจค้างอยู่ใต้ ID ที่ record ย้ายออกไปแล้ว
  if (key.startsWith("C:")) {
    const rawIds = new Set<string>();
    if (key !== lineUserId && lineUserId) rawIds.add(lineUserId);
    try {
      const { getCustomer } = await import("./customers-store");
      const cust = await getCustomer(key.slice(2));
      for (const id of [cust?.lineUserId, ...(cust?.lineUserIds || [])]) {
        if (id && id !== key) rawIds.add(id);
      }
    } catch {
      /* หาลูกค้าไม่ได้ — ใช้แค่ ID ปัจจุบัน */
    }
    for (const raw of rawIds) {
      try {
        await migrateLegacyPoints(raw, key);
      } catch {
        /* รวมแต้มไม่สำเร็จ — อ่านต่อได้ ไม่ให้พังทั้งหน้า */
      }
    }
  } else if (key !== lineUserId) {
    try {
      await migrateLegacyPoints(lineUserId, key);
    } catch {
      /* ไม่ให้พังทั้งหน้า */
    }
  }

  const sb = getSupabase();
  if (sb) {
    const { data: acc } = await sb
      .from("points_accounts")
      .select("*")
      .eq("line_user_id", key)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();

    if (!acc) {
      const points = key === "dev-user" ? 42 : 0;
      await sb.from("points_accounts").insert({
        line_user_id: key,
        tenant_id: requireTenantId(),
        display_name: displayName || key,
        points,
      });
      return { lineUserId: key, displayName: displayName || key, points, history: [] };
    }

    if (displayName && acc.display_name !== displayName) {
      await sb
        .from("points_accounts")
        .update({ display_name: displayName })
        .eq("line_user_id", key)
        .eq("tenant_id", requireTenantId());
    }

    const history = await loadHistory(key);
    return {
      lineUserId: key,
      displayName: displayName || acc.display_name,
      points: acc.points,
      history,
    };
  }

  let account = mem.get(key);
  if (!account) {
    account = seedMem(key, displayName);
    mem.set(key, account);
  }
  if (displayName) account.displayName = displayName;
  return account;
}

/** อ่านจำนวนเงินส่วนลดจากชื่อรางวัล เช่น "คูปองส่วนลด 50 บาท" → 50 (ไม่เจอ = 0) */
function parseDiscountBaht(label: string): number {
  const m = (label || "").replace(/,/g, "").match(/(\d+)\s*บาท/);
  return m ? Number(m[1]) : 0;
}

export async function redeemReward(
  lineUserId: string,
  rewardId: string,
  displayName = "",
  customerId?: string
) {
  const config = await getSiteConfig();
  const tier = config.pointsRewards.find((r) => r.id === rewardId);
  if (!tier) return { ok: false as const, error: "invalid_reward" };

  const acc = await getAccount(lineUserId, displayName, customerId);
  if (acc.points < tier.points) {
    return { ok: false as const, error: "insufficient_points" };
  }

  // ถ้ารางวัลมีมูลค่าส่วนลด (บาท) → ออกเป็นคูปองจริงเก็บในกระเป๋าลูกค้าเลย
  // ลูกค้ากดใช้เองได้ในแอป และหักส่วนลดตอนคิดเงินได้ (ผูกเข้าบิลหลังบ้านอัตโนมัติ)
  // ถ้าไม่ได้ตั้งช่องมูลค่าไว้ ลองอ่านเลข "X บาท" จากชื่อรางวัลให้อัตโนมัติ (เช่น "คูปองส่วนลด 50 บาท")
  const discountAmount =
    tier.discount && tier.discount > 0 ? tier.discount : parseDiscountBaht(tier.reward.th);
  let couponCode = `PETFLOW-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  if (discountAmount > 0) {
    try {
      // ใช้ customerId จาก client ก่อน (แม่นสุด) ถ้าไม่มีค่อยเดาจาก lineUserId
      let custId = customerId;
      if (!custId) {
        const { findCustomerByLine } = await import("./customers-store");
        custId = (await findCustomerByLine(lineUserId))?.id;
      }
      if (custId) {
        const { issueCoupon } = await import("./coupons-store");
        const coupon = await issueCoupon({
          customerId: custId,
          amount: discountAmount,
          reason: `แลกจากแต้ม: ${tier.reward.th}`,
          expiresInDays: 90,
        });
        couponCode = coupon.code; // ใช้โค้ดเดียวกับคูปองจริง ประวัติแต้มกับกระเป๋าคูปองจะตรงกัน
      }
    } catch {
      /* ออกคูปองไม่ได้ (ยังไม่ผูกลูกค้า ฯลฯ) — ยังแลกได้ แต่เป็นโค้ดในประวัติเฉยๆ */
    }
  }
  const entry: PointsHistoryEntry = {
    id: `H${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
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
    // เขียนด้วยคีย์เดียวกับที่ getAccount คืนมา (คีย์ลูกค้า) — ไม่ใช่ LINE ID ดิบ
    await sb
      .from("points_accounts")
      .update({ points: newPoints, display_name: acc.displayName })
      .eq("line_user_id", acc.lineUserId)
      .eq("tenant_id", requireTenantId());
    await sb.from("points_history").insert({
      id: entry.id,
      tenant_id: requireTenantId(),
      line_user_id: acc.lineUserId,
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
  // ยอดแต้มติดลบไม่มีความหมาย — ปรับลดได้มากสุดเท่าที่มีอยู่
  // (พิมพ์ผิดตอนปรับแต้มมือ เคยทำให้ยอดลูกค้าติดลบแล้วต้องมานั่งไล่แก้)
  const applied = Math.max(amount, -acc.points);
  const entry: PointsHistoryEntry = {
    id: `H${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    type: "earn",
    points: applied,
    labelTh,
    labelEn,
    at: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    const newPoints = acc.points + applied;
    // ใช้คีย์ลูกค้าจาก getAccount (acc.lineUserId) ไม่ใช่ LINE ID ดิบที่ส่งเข้ามา
    await sb
      .from("points_accounts")
      .update({ points: newPoints })
      .eq("line_user_id", acc.lineUserId)
      .eq("tenant_id", requireTenantId());
    await sb.from("points_history").insert({
      id: entry.id,
      tenant_id: requireTenantId(),
      line_user_id: acc.lineUserId,
      type: entry.type,
      points: entry.points,
      label_th: entry.labelTh,
      label_en: entry.labelEn,
      created_at: entry.at,
    });
    return { ...acc, points: newPoints, history: [entry, ...acc.history] };
  }

  acc.points += applied;
  acc.history.unshift(entry);
  return acc;
}

export async function getPointsHistory(lineUserId: string) {
  return loadHistory(await resolvePointsKey(lineUserId));
}

/**
 * ลบประวัติแต้ม 1 รายการ + ปรับยอดคงเหลือย้อนกลับให้ตรง
 *
 * entry.points เก็บเป็นเลขมีเครื่องหมายอยู่แล้ว (ได้แต้ม = บวก, แลกแต้ม = ลบ)
 * ลบแล้วแค่หักยอดคงเหลือด้วย entry.points ก็ย้อนกลับสภาพก่อนหน้าได้พอดี
 * (ถ้าเป็นรายการแลกแต้มที่เคยออกคูปองจริงไปแล้ว ลบตรงนี้ไม่ยกเลิกคูปองให้ — ต้องไปจัดการ
 * คูปองแยกต่างหากถ้าจำเป็น กันลบประวัติแล้วคูปองหายตามไปด้วยโดยไม่ตั้งใจ)
 */
export async function deletePointsHistoryEntry(entryId: string) {
  const sb = getSupabase();
  if (sb) {
    const tenantId = requireTenantId();
    const { data: row } = await sb
      .from("points_history")
      .select("*")
      .eq("id", entryId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "not_found" };
    const r = row as HistoryRow;
    const { data: acc } = await sb
      .from("points_accounts")
      .select("points")
      .eq("line_user_id", r.line_user_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    const newPoints = Math.max(0, Number(acc?.points || 0) - Number(r.points));
    await sb
      .from("points_accounts")
      .update({ points: newPoints })
      .eq("line_user_id", r.line_user_id)
      .eq("tenant_id", tenantId);
    await sb.from("points_history").delete().eq("id", entryId).eq("tenant_id", tenantId);
    return { ok: true as const, points: newPoints };
  }

  for (const acc of mem.values()) {
    const idx = acc.history.findIndex((h) => h.id === entryId);
    if (idx >= 0) {
      const [removed] = acc.history.splice(idx, 1);
      acc.points = Math.max(0, acc.points - removed.points);
      return { ok: true as const, points: acc.points };
    }
  }
  return { ok: false as const, error: "not_found" };
}

/** รวมแต้ม 2 บัญชีเข้าด้วยกัน (ใช้ตอนรวมลูกค้าซ้ำ) — ย้ายทุกอย่างจาก from → to */
export async function mergePointsAccount(fromCustomerId: string, toCustomerId: string) {
  if (fromCustomerId === toCustomerId) return;
  await migrateLegacyPoints(`C:${fromCustomerId}`, `C:${toCustomerId}`);
  // เผื่อแต้มเก่ายังค้างใต้ LINE ID ดิบของลูกค้าต้นทาง — ดึงมารวมด้วย (best-effort)
}
