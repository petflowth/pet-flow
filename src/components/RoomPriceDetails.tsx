"use client";

import type { RoomType } from "@/lib/business";
import { normalizeRoomSeasons, seasonsActive, type RoomSeasonConfig, type SeasonRule } from "@/lib/room-seasons";
import { roomPricing } from "@/lib/room-board";
import { useTr, useLocale } from "@/components/LocaleProvider";

const baht = (n: number) => `${n.toLocaleString()}฿`;

function tierRows(rule: SeasonRule, en = false) {
  const tiers = (rule.weightTiers || []).filter((t) => t.price > 0);
  return tiers.map((t, i) => {
    const next = tiers[i + 1];
    const kg = en ? "kg" : "กก.";
    const range = next ? `${t.fromKg}–${(next.fromKg - 0.1).toFixed(1)} ${kg}` : en ? `${t.fromKg} kg +` : `${t.fromKg} กก. ขึ้นไป`;
    return { label: range, price: t.price };
  });
}

function weightRange(rule: SeasonRule): string | null {
  const ps = (rule.weightTiers || []).map((t) => t.price).filter((p) => p > 0);
  if (!ps.length) return null;
  const lo = Math.min(...ps);
  const hi = Math.max(...ps);
  return lo === hi ? baht(lo) : `${lo.toLocaleString()}–${baht(hi)}`;
}

/** ข้อความราคาสั้นๆ ใต้ชื่อห้อง — ร้านที่คิดตามฤดูโชว์ทั้ง Low และ High */
export function roomPriceLine(room: RoomType, raw: unknown, perNight: string, en = false): string {
  const cfg = normalizeRoomSeasons(raw);
  if (!seasonsActive(cfg)) return `${room.price} ${perNight}`;
  const part = (name: string, rule: SeasonRule) =>
    rule.mode === "weight" ? `${name} ${weightRange(rule) || baht(room.price)} ${en ? "(by weight)" : "(ตามน้ำหนัก)"}` : `${name} ${baht(room.price)}`;
  return `${part("Low", cfg.low)} · ${part("High", cfg.high)} ${en ? "/night" : "/คืน"}`;
}

function SeasonBlock({ title, rule, room }: { title: string; rule: SeasonRule; room?: RoomType }) {
  const { locale } = useLocale();
  const tr = useTr();
  const rows =
    rule.mode === "weight"
      ? tierRows(rule, locale === "en")
      : room
        ? [{ label: room.name, price: room.price }]
        : [];
  const extra = rule.extraPetPrice || (rule.mode === "room" && room ? roomPricing(room).extraPrice : 0);
  return (
    <div className="rounded-petflow-sm bg-paper px-3 py-2.5">
      <p className="text-xs font-extrabold text-petflow-chocolate">{title}</p>
      <p className="mb-1 text-[10px] text-brown-faint">
        {rule.mode === "weight" ? tr("คิดตามน้ำหนักน้อง ห้องไหนก็ราคาเดียวกัน", "Priced by your pet's weight, same for every room") : tr("คิดตามประเภทห้อง", "Priced by room type")}
      </p>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between text-xs text-brown">
          <span>{r.label}</span>
          <span className="font-bold">{baht(r.price)}{tr("/คืน", "/night")}</span>
        </div>
      ))}
      {extra > 0 && (
        <div className="mt-1 flex justify-between text-xs text-brown-soft">
          <span>{tr("บ้านเดียวกันพักห้องเดียวกัน", "Extra pet, same household & room")}</span>
          <span className="font-bold">{tr("เริ่มต้น", "from")} {baht(extra)}{tr("/ตัว", "/pet")}</span>
        </div>
      )}
    </div>
  );
}

/**
 * ตารางค่าบริการห้องพักตามฤดู (Low / High) — หน้าห้องพักของลูกค้า
 * room = หน้าห้องเดียว (High แบบตามห้องโชว์ราคาห้องนั้น) · ไม่ส่ง = ทุกห้อง
 */
export function RoomSeasonPrices({
  raw,
  rooms,
  room,
}: {
  raw: unknown;
  rooms: RoomType[];
  room?: RoomType;
}) {
  const tr = useTr();
  const cfg: RoomSeasonConfig = normalizeRoomSeasons(raw);
  if (!seasonsActive(cfg)) return null;
  const list = room ? [room] : rooms.filter((r) => !r.composedOf?.length);
  const block = (title: string, rule: SeasonRule) =>
    rule.mode === "room" && !room ? (
      <div className="rounded-petflow-sm bg-paper px-3 py-2.5">
        <p className="text-xs font-extrabold text-petflow-chocolate">{title}</p>
        <p className="mb-1 text-[10px] text-brown-faint">{tr("คิดตามประเภทห้อง", "Priced by room type")}</p>
        {list.map((r) => (
          <div key={r.id} className="flex justify-between text-xs text-brown">
            <span>{r.name}</span>
            <span className="font-bold">{baht(r.price)}{tr("/คืน", "/night")}</span>
          </div>
        ))}
        {rule.extraPetPrice ? (
          <div className="mt-1 flex justify-between text-xs text-brown-soft">
            <span>{tr("บ้านเดียวกันพักห้องเดียวกัน", "Extra pet, same household & room")}</span>
            <span className="font-bold">{tr("เริ่มต้น", "from")} {baht(rule.extraPetPrice)}{tr("/ตัว", "/pet")}</span>
          </div>
        ) : null}
      </div>
    ) : (
      <SeasonBlock title={title} rule={rule} room={room} />
    );
  return (
    <div className="mb-4 rounded-petflow border border-petflow-line bg-card p-3 shadow-petflow-sm">
      <p className="mb-2 text-sm font-extrabold text-petflow-chocolate">{tr("💰 ค่าบริการห้องพัก", "💰 Room rates")}</p>
      <div className="grid gap-2">
        {block("🌿 Low Season", cfg.low)}
        {block("☀️ High Season", cfg.high)}
      </div>
      <p className="mt-2 text-[10px] text-brown-faint">{tr("ช่วง Low / High ร้านแจ้งตามวันที่เข้าพัก · ทางร้านเป็นผู้จัดห้องให้น้อง", "Low/High season depends on your stay dates · the shop assigns the room")}</p>
    </div>
  );
}
