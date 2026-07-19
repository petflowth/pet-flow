import { getDefaultSiteConfig } from "./defaults/site-config";
import type { SiteConfig } from "./config-types";
import { getSupabase } from "./supabase/server";
import { requireTenantId } from "./tenant-context";

/**
 * แถวเดียวต่อร้าน — id เดิมเคยตายตัวเป็น "main" (ร้านเดียว) ตอนนี้ต้องผูกกับ
 * tenant_id แทน ไม่งั้นทุกร้านจะเขียนทับ config ของกันและกัน
 */
function configId() {
  return requireTenantId();
}

let memConfig: SiteConfig | null = null;

function mergeConfig(base: SiteConfig, patch: Partial<SiteConfig>): SiteConfig {
  const next = JSON.parse(JSON.stringify(base)) as SiteConfig;
  for (const key of Object.keys(patch) as (keyof SiteConfig)[]) {
    const val = patch[key];
    if (val === undefined) continue;
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      key !== "rooms" &&
      key !== "groomSlots" &&
      key !== "pointsRewards"
    ) {
      (next as Record<string, unknown>)[key] = {
        ...(next as Record<string, unknown>)[key] as object,
        ...val,
      };
    } else {
      (next as Record<string, unknown>)[key] = val;
    }
  }
  return next;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const defaults = getDefaultSiteConfig();
  const sb = getSupabase();

  if (sb) {
    const { data } = await sb
      .from("site_config")
      .select("data, updated_at")
      .eq("id", configId())
      .maybeSingle();

    if (data?.data) {
      return mergeConfig(defaults, {
        ...(data.data as Partial<SiteConfig>),
        updatedAt: data.updated_at || defaults.updatedAt,
      });
    }
  }

  if (memConfig) return memConfig;
  return defaults;
}

export async function replaceSiteConfig(config: SiteConfig) {
  const next = {
    ...config,
    updatedAt: new Date().toISOString(),
    version: (config.version || 0) + 1,
  };
  const sb = getSupabase();
  if (sb) {
    await sb.from("site_config").upsert({
      id: configId(),
      tenant_id: requireTenantId(),
      data: next,
      updated_at: next.updatedAt,
    });
  } else {
    memConfig = next;
  }
  return next;
}

export async function updateSiteConfig(patch: Partial<SiteConfig>) {
  const current = await getSiteConfig();
  const next = mergeConfig(current, patch);
  next.updatedAt = new Date().toISOString();
  next.version = (current.version || 0) + 1;

  const sb = getSupabase();
  if (sb) {
    await sb.from("site_config").upsert({
      id: configId(),
      tenant_id: requireTenantId(),
      data: next,
      updated_at: next.updatedAt,
    });
  } else {
    memConfig = next;
  }

  return next;
}

export function getRoomFromConfig(config: SiteConfig, id: string) {
  return config.rooms.find((r) => r.id === id);
}
