/**
 * ราคาห้องพักตามฤดูกาล (Low season / High season)
 * ------------------------------------------------
 * บางร้านคิดค่าห้องคนละแบบในแต่ละช่วงของปี เช่น
 *   Low season  — คิดตามน้ำหนักน้อง (0–9.9 กก. 750 · 10–19.9 กก. 850 …) ห้องไหนก็ราคาเดียวกัน
 *   High season — คิดตามประเภทห้อง (Deluxe 950 · VIP 1250)
 * และน้องหลายตัวอยู่ห้องเดียวกัน ตัวที่เพิ่มคิดราคาต่อตัวแยก (Low 450 · High 550)
 *
 * ร้านกรอกช่วงวันเองว่าวันไหนเป็น High / Low — วันที่ไม่อยู่ในช่วงไหนใช้ "ฤดูปกติ" (defaultSeason)
 * คิดราคาเป็นรายคืน: พักคร่อมสองฤดู = แยกบรรทัดตามจำนวนคืนของแต่ละฤดู
 * ไม่เปิดใช้ (enabled = false / ไม่ตั้ง) = คิดราคาห้องแบบเดิมทุกอย่าง
 */

export type Season = "low" | "high";

export type WeightTier = {
  /** น้ำหนักตั้งแต่กี่ กก. (ช่วงนี้ใช้จนถึงก่อนขั้นถัดไป) */
  fromKg: number;
  /** ราคาต่อคืน */
  price: number;
};

export type SeasonRule = {
  /** room = ใช้ราคาของประเภทห้อง · weight = คิดตามน้ำหนักน้อง (ห้องไหนก็ราคาเดียวกัน) */
  mode: "room" | "weight";
  /** ใช้เมื่อ mode = weight */
  weightTiers?: WeightTier[];
  /**
   * น้องตัวที่เพิ่มในห้องเดียวกัน คิดตัวละกี่บาท/คืน
   * ไม่ตั้ง / 0 = (mode room) ใช้ค่าตัวที่เกินของห้องนั้น · (mode weight) คิดตามน้ำหนักของตัวนั้นเต็มราคา
   */
  extraPetPrice?: number;
};

export type SeasonPeriod = {
  /** YYYY-MM-DD (รวมวันนี้) */
  from: string;
  /** YYYY-MM-DD (รวมวันนี้) — คืนของวันนี้ยังนับเป็นฤดูนี้ */
  to: string;
  season: Season;
};

export type RoomSeasonConfig = {
  enabled: boolean;
  /** วันที่ไม่อยู่ในช่วงที่กรอกไว้ ใช้ฤดูนี้ */
  defaultSeason: Season;
  periods: SeasonPeriod[];
  low: SeasonRule;
  high: SeasonRule;
};

export const SEASON_LABEL: Record<Season, string> = { low: "Low season", high: "High season" };

export function defaultRoomSeasons(): RoomSeasonConfig {
  return {
    enabled: false,
    defaultSeason: "low",
    periods: [],
    low: { mode: "room" },
    high: { mode: "room" },
  };
}

/** อ่านค่าที่บันทึกไว้ให้ปลอดภัย (ไม่ตั้ง / ข้อมูลเก่าไม่ครบ) */
export function normalizeRoomSeasons(raw: unknown): RoomSeasonConfig {
  const d = defaultRoomSeasons();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Partial<RoomSeasonConfig>;
  const rule = (x: unknown): SeasonRule => {
    const v = (x && typeof x === "object" ? x : {}) as Partial<SeasonRule>;
    const tiers = Array.isArray(v.weightTiers)
      ? v.weightTiers
          .map((t) => ({ fromKg: Math.max(0, Number(t?.fromKg) || 0), price: Math.max(0, Number(t?.price) || 0) }))
          .sort((a, b) => a.fromKg - b.fromKg)
      : [];
    const extra = Number(v.extraPetPrice);
    return {
      mode: v.mode === "weight" ? "weight" : "room",
      weightTiers: tiers,
      extraPetPrice: Number.isFinite(extra) && extra > 0 ? extra : undefined,
    };
  };
  const iso = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "");
  return {
    enabled: !!r.enabled,
    defaultSeason: r.defaultSeason === "high" ? "high" : "low",
    periods: (Array.isArray(r.periods) ? r.periods : [])
      .map((p) => {
        const a = iso(p?.from);
        const b = iso(p?.to) || a;
        return { from: a <= b ? a : b, to: a <= b ? b : a, season: (p?.season === "high" ? "high" : "low") as Season };
      })
      .filter((p) => p.from),
    low: rule(r.low),
    high: rule(r.high),
  };
}

export function seasonsActive(cfg?: RoomSeasonConfig | null): cfg is RoomSeasonConfig {
  return !!cfg?.enabled;
}

/** ฤดูของ "คืน" วันที่นี้ (YYYY-MM-DD) — ช่วงที่กรอกทีหลังชนะช่วงที่กรอกก่อน */
export function seasonOn(date: string, cfg: RoomSeasonConfig): Season {
  const d = (date || "").slice(0, 10);
  let s: Season = cfg.defaultSeason;
  for (const p of cfg.periods) if (p.from <= d && d <= p.to) s = p.season;
  return s;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * แตกการเข้าพักเป็นช่วงต่อเนื่องตามฤดู — นับเป็นคืน (คืนของวันเช็คเอาท์ไม่นับ)
 * เช่น เข้า 30 ธ.ค. ออก 3 ม.ค. ช่วง High = 1 ม.ค.–2 ม.ค. → [low 2 คืน, high 2 คืน]
 */
export function splitStayBySeason(
  checkin: string,
  checkout: string,
  cfg: RoomSeasonConfig
): { season: Season; from: string; nights: number }[] {
  const out: { season: Season; from: string; nights: number }[] = [];
  if (!checkin || !checkout || checkout <= checkin) return out;
  // กันลูปยาวผิดปกติ (พักเกิน 2 ปี)
  for (let d = checkin.slice(0, 10), i = 0; d < checkout.slice(0, 10) && i < 800; d = addDays(d, 1), i++) {
    const s = seasonOn(d, cfg);
    const last = out[out.length - 1];
    if (last && last.season === s) last.nights++;
    else out.push({ season: s, from: d, nights: 1 });
  }
  return out;
}

/** ราคาต่อคืนของน้อง 1 ตัวตามน้ำหนัก — ไม่รู้น้ำหนัก = ขั้นแรก (ร้านแก้ในบิลได้) */
export function weightTierPrice(tiers: WeightTier[] | undefined, weightKg?: number | null): number {
  const list = (tiers || []).filter((t) => t.price > 0);
  if (!list.length) return 0;
  const w = typeof weightKg === "number" && Number.isFinite(weightKg) ? weightKg : -1;
  let price = list[0].price;
  for (const t of list) if (w >= t.fromKg) price = t.price;
  return price;
}

/**
 * ค่าห้องต่อคืนของ 1 ห้อง ตามฤดู
 * - mode room: ราคาห้อง + ตัวที่เกินจำนวนที่รวมในราคาห้อง × (ราคาตัวเพิ่มของฤดู หรือของห้อง)
 * - mode weight: ตัวที่หนักสุดคิดตามน้ำหนัก + ตัวที่เหลือตัวละ extraPetPrice
 *   (ไม่ได้ตั้ง extraPetPrice = ทุกตัวคิดตามน้ำหนักของตัวเอง)
 */
export function seasonalNightPrice(opts: {
  cfg: RoomSeasonConfig;
  season: Season;
  roomPrice: number;
  pricing: { base: number; extraPrice: number };
  /** น้ำหนักของน้องแต่ละตัวในห้องนี้ (ไม่รู้ = undefined) — ความยาว = จำนวนตัว */
  weights: (number | null | undefined)[];
}): number {
  const { cfg, season, roomPrice, pricing } = opts;
  const rule = cfg[season];
  const n = Math.max(1, opts.weights.length);
  if (rule.mode === "weight" && (rule.weightTiers || []).some((t) => t.price > 0)) {
    const prices = (opts.weights.length ? opts.weights : [undefined])
      .map((w) => weightTierPrice(rule.weightTiers, w))
      .sort((a, b) => b - a);
    if (rule.extraPetPrice) return prices[0] + (prices.length - 1) * rule.extraPetPrice;
    return prices.reduce((s, p) => s + p, 0);
  }
  const extra = rule.extraPetPrice || pricing.extraPrice;
  return roomPrice + Math.max(0, n - pricing.base) * extra;
}

const SEASON_TAG = /\s*\((Low|High) season\)\s*$/i;

/** ป้ายฤดูท้ายชื่อห้องในบิล เช่น "ห้อง VIP (High season)" */
export function withSeasonTag(roomLabel: string, season?: Season): string {
  return season ? `${roomLabel} (${SEASON_LABEL[season]})` : roomLabel;
}

/** แยกชื่อห้องกับฤดูออกจากกัน (ชื่อที่ไม่มีป้าย = season undefined) */
export function splitSeasonTag(label: string): { base: string; season?: Season } {
  const m = SEASON_TAG.exec(label || "");
  if (!m) return { base: label };
  return { base: label.replace(SEASON_TAG, ""), season: m[1].toLowerCase() === "high" ? "high" : "low" };
}
