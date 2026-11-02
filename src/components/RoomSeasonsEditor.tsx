"use client";

import { NumInput } from "@/components/NumInput";
import { Icon } from "@/components/Icon";
import {
  SEASON_LABEL,
  type RoomSeasonConfig,
  type Season,
  type SeasonRule,
} from "@/lib/room-seasons";

const box = "rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-xs";

/** ตั้งราคาห้องตาม Low / High season — อยู่บนสุดของแท็บห้องพัก บันทึกพร้อมห้องทั้งหมด */
export function RoomSeasonsEditor({
  value,
  onChange,
  petWord = "น้อง",
}: {
  value: RoomSeasonConfig;
  onChange: (v: RoomSeasonConfig) => void;
  petWord?: string;
}) {
  const set = (patch: Partial<RoomSeasonConfig>) => onChange({ ...value, ...patch });
  const setRule = (s: Season, patch: Partial<SeasonRule>) => set({ [s]: { ...value[s], ...patch } });

  return (
    <div className="rounded-petflow border border-petflow-line bg-card p-4">
      <label className="flex items-center gap-2 text-sm font-extrabold text-brown">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
          className="h-4 w-4 accent-latte-deep"
        />
        🌤️ ราคาห้องตาม Low / High season
      </label>
      <p className="mt-1 text-[11px] text-brown-faint">
        เปิดแล้วตอนออกบิลระบบคิดค่าห้องตามฤดูของแต่ละคืนให้เอง (พักคร่อมสองฤดูแยกบรรทัดให้) — แก้ราคาในบิลได้เหมือนเดิม
      </p>

      {value.enabled && (
        <div className="mt-3 space-y-4">
          {/* ช่วงวัน */}
          <div>
            <p className="text-[11px] font-extrabold text-brown-soft">📅 ช่วงวันของแต่ละฤดู</p>
            <label className="mt-1 flex items-center gap-2 text-[11px] text-brown-soft">
              วันที่ไม่ได้กรอกไว้ด้านล่าง ให้เป็น
              <select
                value={value.defaultSeason}
                onChange={(e) => set({ defaultSeason: e.target.value as Season })}
                className={box}
              >
                <option value="low">{SEASON_LABEL.low}</option>
                <option value="high">{SEASON_LABEL.high}</option>
              </select>
            </label>
            <div className="mt-2 space-y-1.5">
              {value.periods.map((p, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={p.season}
                    onChange={(e) =>
                      set({
                        periods: value.periods.map((x, j) =>
                          j === i ? { ...x, season: e.target.value as Season } : x
                        ),
                      })
                    }
                    className={box}
                  >
                    <option value="high">High</option>
                    <option value="low">Low</option>
                  </select>
                  <input
                    type="date"
                    value={p.from}
                    onChange={(e) =>
                      set({ periods: value.periods.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)) })
                    }
                    className={box}
                  />
                  <span className="text-[11px] text-brown-soft">ถึง</span>
                  <input
                    type="date"
                    value={p.to}
                    onChange={(e) =>
                      set({ periods: value.periods.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)) })
                    }
                    className={box}
                  />
                  <button
                    type="button"
                    aria-label="ลบช่วงนี้"
                    onClick={() => set({ periods: value.periods.filter((_, j) => j !== i) })}
                    className="rounded-full p-1 text-wait"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                set({
                  periods: [
                    ...value.periods,
                    { from: "", to: "", season: value.defaultSeason === "low" ? "high" : "low" },
                  ],
                })
              }
              className="mt-2 flex items-center gap-1 rounded-full border border-dashed border-latte-deep/50 px-3 py-1.5 text-[11px] font-extrabold text-latte-deep"
            >
              <Icon name="plus" size={14} />
              เพิ่มช่วงวัน
            </button>
            <p className="mt-1 text-[10px] text-brown-faint">
              นับเป็น “คืน” — ใส่ถึงวันที่ 2 ม.ค. = คืนวันที่ 2 ยังเป็นฤดูนี้ · ช่วงซ้อนกัน ช่วงที่อยู่ล่างสุดชนะ
            </p>
          </div>

          {(["low", "high"] as Season[]).map((s) => {
            const rule = value[s];
            const tiers = rule.weightTiers || [];
            return (
              <div key={s} className="rounded-petflow-sm border border-petflow-line p-3">
                <p className="text-xs font-extrabold text-brown">{SEASON_LABEL[s]} คิดราคาแบบไหน</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["room", "ตามประเภทห้อง"],
                      ["weight", `ตามน้ำหนัก${petWord}`],
                    ] as const
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        setRule(s, {
                          mode: m,
                          weightTiers: m === "weight" && !tiers.length ? [{ fromKg: 0, price: 0 }] : tiers,
                        })
                      }
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                        rule.mode === m ? "bg-latte-deep text-white" : "bg-paper text-brown-soft"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {rule.mode === "room" ? (
                  <p className="mt-1.5 text-[10px] text-brown-faint">
                    ใช้ “ราคา/คืน” ของแต่ละห้องด้านล่าง
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {tiers.map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px] text-brown-soft">
                        ตั้งแต่
                        <NumInput
                          value={t.fromKg}
                          step="0.1"
                          min={0}
                          onChange={(e) =>
                            setRule(s, {
                              weightTiers: tiers.map((x, j) =>
                                j === i ? { ...x, fromKg: Math.max(0, Number(e.target.value) || 0) } : x
                              ),
                            })
                          }
                          className={`${box} w-16`}
                        />
                        กก.{i < tiers.length - 1 ? ` (ถึง ${Math.max(0, tiers[i + 1].fromKg - 0.1).toFixed(1)})` : " ขึ้นไป"}
                        <NumInput
                          value={t.price}
                          min={0}
                          onChange={(e) =>
                            setRule(s, {
                              weightTiers: tiers.map((x, j) =>
                                j === i ? { ...x, price: Math.max(0, Number(e.target.value) || 0) } : x
                              ),
                            })
                          }
                          className={`${box} w-20`}
                        />
                        ฿/คืน
                        <button
                          type="button"
                          aria-label="ลบขั้นนี้"
                          onClick={() => setRule(s, { weightTiers: tiers.filter((_, j) => j !== i) })}
                          className="rounded-full p-1 text-wait"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setRule(s, {
                          weightTiers: [
                            ...tiers,
                            { fromKg: (tiers[tiers.length - 1]?.fromKg ?? -10) + 10, price: 0 },
                          ],
                        })
                      }
                      className="flex items-center gap-1 rounded-full border border-dashed border-latte-deep/50 px-3 py-1 text-[11px] font-extrabold text-latte-deep"
                    >
                      <Icon name="plus" size={13} />
                      เพิ่มช่วงน้ำหนัก
                    </button>
                    <p className="text-[10px] text-brown-faint">
                      ห้องไหนก็ราคาเดียวกัน · {petWord}ที่ยังไม่มีน้ำหนักในระบบ ใช้ขั้นแรก (แก้ในบิลได้)
                    </p>
                  </div>
                )}
                <label className="mt-2 flex items-center gap-1.5 text-[11px] text-brown-soft">
                  บ้านเดียวกันพักห้องเดียวกัน ตัวที่ 2 ขึ้นไป
                  <NumInput
                    value={rule.extraPetPrice ?? 0}
                    min={0}
                    onChange={(e) =>
                      setRule(s, { extraPetPrice: Math.max(0, Number(e.target.value) || 0) || undefined })
                    }
                    className={`${box} w-20`}
                  />
                  ฿/ตัว/คืน
                </label>
                <p className="text-[10px] text-brown-faint">
                  {rule.mode === "weight"
                    ? "เว้นว่าง = แต่ละตัวเริ่มที่ราคาตามน้ำหนักของตัวเอง"
                    : "เว้นว่าง = ใช้ค่าตัวที่เกินของแต่ละห้อง"}
                  {" · ตอนออกบิล ค่าห้องแยกเป็นรายตัว แก้ราคาของแต่ละตัวได้"}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
