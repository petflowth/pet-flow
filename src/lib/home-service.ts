import type { HomeServiceConfig, HomeServiceZone, SiteConfig } from "./config-types";
import { isFeatureOn } from "./features";

/**
 * บริการนอกสถานที่ — ช่างไปอาบน้ำ/นวดให้ที่บ้านลูกค้า
 *
 * - เปิด/ปิดที่ ตั้งค่า › เปิด/ปิดฟีเจอร์ › บริการนอกสถานที่ (ปิดไว้ก่อนทุกร้าน)
 * - ร้านตั้งเองทั้งหมด: ชื่อบริการ, เงื่อนไข/พื้นที่, โซน + ค่าเดินทาง, รอบเวลา, จำนวนทีมต่อรอบ
 * - คิวแยกจากหน้าร้าน: นับเป็น "บ้าน" ต่อรอบ (1 ทีมไป 1 บ้าน ไม่ว่าบ้านนั้นมีกี่ตัว)
 * - นัดเก็บใน bookings.transport ({ atHome: true, homeZone, homeFee, address, mapUrl })
 * - ร้านหลายสาขา: ตั้งแยกสาขาได้ (homeService อยู่ใน BRANCH_OVERRIDE_KEYS)
 */

export const HOME_SERVICE_DEFAULT_LABEL = "บริการที่บ้าน";
export const HOME_FEE_DEFAULT_LABEL = "ค่าบริการนอกสถานที่";

type WithHome = Pick<SiteConfig, "homeService" | "features">;

export function homeServiceOn(config: WithHome | null | undefined): boolean {
  return isFeatureOn(config, "homeService");
}

export function homeServiceConfig(config: WithHome | null | undefined): HomeServiceConfig {
  return config?.homeService || {};
}

export function homeServiceLabel(config: WithHome | null | undefined): string {
  return String(homeServiceConfig(config).label || "").trim() || HOME_SERVICE_DEFAULT_LABEL;
}

export function homeFeeLabel(config: WithHome | null | undefined): string {
  return String(homeServiceConfig(config).feeLabel || "").trim() || HOME_FEE_DEFAULT_LABEL;
}

/** โซนที่ใช้ได้ (ชื่อไม่ว่าง) */
export function homeZones(config: WithHome | null | undefined): HomeServiceZone[] {
  return (homeServiceConfig(config).zones || []).filter((z) => z && z.id && String(z.name || "").trim());
}

/** นวดที่บ้านได้ไหม (ไม่ตั้ง = ได้) */
export function homeMassageAllowed(config: WithHome | null | undefined): boolean {
  return homeServiceConfig(config).massage !== false;
}

/**
 * โซน + ค่าเดินทางที่ใช้กับนัด — ร้านแยกโซนแต่ไม่ได้เลือก/เลือกโซนที่ไม่มี = null (ให้ลูกค้าเลือกใหม่)
 * ไม่แยกโซน = ค่าเดินทางเดียว
 */
export function resolveHomeZone(
  config: WithHome | null | undefined,
  zoneId?: string | null
): { zoneId?: string; zone?: string; fee: number } | null {
  const zones = homeZones(config);
  if (!zones.length) return { fee: Math.max(0, Math.round(Number(homeServiceConfig(config).fee) || 0)) };
  const z = zones.find((x) => x.id === zoneId);
  if (!z) return null;
  return { zoneId: z.id, zone: z.name.trim(), fee: Math.max(0, Math.round(Number(z.fee) || 0)) };
}

/** รอบเวลาออกบริการ — ไม่ตั้ง = รอบเดียวกับอาบน้ำหน้าร้าน */
export function homeSlots(config: Pick<SiteConfig, "homeService" | "groomSlots">): string[] {
  const own = (config.homeService?.slots || []).filter((t) => /^\d{2}:\d{2}$/.test(t));
  return own.length ? [...own].sort() : config.groomSlots || [];
}

export function homeCapacity(config: Pick<SiteConfig, "homeService">): number {
  return Math.max(1, Math.round(Number(config.homeService?.capacity) || 1));
}

/** ข้อความราคาค่าเดินทางสั้น ๆ เช่น "+฿150" หรือ "+฿100–300 ตามโซน" */
export function homeFeeText(config: WithHome | null | undefined): string {
  const zones = homeZones(config);
  const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;
  if (!zones.length) {
    const fee = Math.max(0, Number(homeServiceConfig(config).fee) || 0);
    return fee > 0 ? `+${baht(fee)}` : "";
  }
  const fees = zones.map((z) => Math.max(0, Number(z.fee) || 0));
  const lo = Math.min(...fees);
  const hi = Math.max(...fees);
  if (hi <= 0) return "";
  return lo === hi ? `+${baht(lo)}` : `+${baht(lo)}–${hi.toLocaleString("th-TH")} ตามโซน`;
}

export function newHomeZoneId(): string {
  return `zone-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
