"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { t } from "@/lib/i18n";
import { promoRewardLabel, type CustomerPromoView } from "@/lib/promos-store";

type Props = {
  compact?: boolean;
  /** แจ้ง parent ว่ามีโปรให้แสดงไหม (ไว้ซ่อนลิงก์ "ดูทั้งหมด" ตามกัน) */
  onHasPromos?: (has: boolean) => void;
};

export function CustomerExclusivePromos({ compact, onHasPromos }: Props) {
  const { locale } = useLocale();
  const { profile, refreshAccount, setPoints } = useLiff();
  const m = t(locale).customerPromos;
  const [promos, setPromos] = useState<CustomerPromoView[]>([]);
  const [loading, setLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedInfo, setClaimedInfo] = useState<{
    title: string;
    code?: string;
    pointsAwarded?: number;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.lineUserId) return;
    setLoading(true);
    const q = new URLSearchParams({
      forCustomer: "1",
      lineUserId: profile.lineUserId,
    });
    const res = await fetch(`/api/promos?${q}`);
    const data = await res.json();
    const list = data.promos || [];
    setPromos(list);
    onHasPromos?.(list.length > 0);
    setLoading(false);
  }, [profile?.lineUserId, onHasPromos]);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (promo: CustomerPromoView) => {
    if (!profile?.lineUserId || !promo.eligible) return;
    setClaimingId(promo.id);
    const res = await fetch("/api/promos/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promoId: promo.id, lineUserId: profile.lineUserId }),
    });
    const data = await res.json();
    setClaimingId(null);
    if (res.ok && data.ok) {
      if (typeof data.newPoints === "number") setPoints(data.newPoints);
      else await refreshAccount();
      setClaimedInfo({
        title: promo.title[locale],
        code: data.couponCode,
        pointsAwarded: data.pointsAwarded,
      });
      load();
    } else {
      alert(data.error || m.claimFail);
    }
  };

  if (!profile?.lineUserId) return null;

  // หน้าแรก (compact): ไม่มีโปร → ซ่อนทั้งช่องไปเลย (ไม่โชว์หัวข้อ/กล่องว่างแม้ตอนโหลด)
  if (compact && promos.length === 0 && !claimedInfo) return null;

  // หน้าแรก: โชว์แค่ teaser สั้นๆ (ไม่เอารายละเอียดเต็ม/ปุ่มกดใช้) — แตะเพื่อไปดูหน้าโปรเต็ม
  if (compact) {
    return (
      <section className="mb-4">
        <h2 className="mb-2 text-sm font-extrabold text-catcha-chocolate">🎁 {m.title}</h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {promos.map((promo) => (
            <Link
              key={promo.id}
              href="/app/promos"
              className="w-28 shrink-0"
            >
              <div className="h-28 w-28 overflow-hidden rounded-catcha border-2 border-honey/50 bg-honey/10 shadow-catcha-sm">
                {promo.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={promo.imageUrl}
                    alt={promo.title[locale]}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-3xl">🎁</div>
                )}
              </div>
              <p className="mt-1 truncate text-center text-[10px] font-bold text-brown">
                {promo.title[locale]}
              </p>
            </Link>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={compact ? "mb-4" : ""}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-catcha-chocolate">🎁 {m.title}</h2>
      </div>

      {loading ? (
        <p className="text-xs text-brown-soft">{t(locale).common.loading}</p>
      ) : promos.length === 0 ? (
        <p className="rounded-catcha bg-card p-4 text-center text-xs text-brown-soft">{m.empty}</p>
      ) : (
        <div className="space-y-3">
          {promos.map((promo, i) => {
            const reward = promoRewardLabel(promo);
            return (
              <div
                key={promo.id}
                className={`overflow-hidden rounded-catcha border bg-card shadow-catcha-sm ${
                  i === 0 ? "border-honey/60" : "border-catcha-line"
                }`}
              >
                {i === 0 && (
                  <div className="bg-gradient-to-r from-catcha-yellow/60 to-honey/50 px-3 py-1 text-[10px] font-extrabold text-catcha-chocolate">
                    ✨ {m.featured}
                  </div>
                )}
                <div className="p-4">
                  <p className="line-clamp-1 text-sm font-extrabold text-catcha-chocolate">
                    {promo.title[locale]}
                    {reward ? ` · ${reward}` : ""}
                  </p>
                  <p
                    className={`mt-1 text-xs leading-relaxed text-brown-soft ${
                      expandedId === promo.id ? "" : "line-clamp-2"
                    }`}
                  >
                    {promo.body[locale]}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId((cur) => (cur === promo.id ? null : promo.id))
                    }
                    className="mt-0.5 text-[10px] font-bold text-latte-deep"
                  >
                    {expandedId === promo.id
                      ? locale === "th"
                        ? "▲ ย่อ"
                        : "▲ Show less"
                      : locale === "th"
                        ? "รายละเอียดเพิ่มเติม ▾"
                        : "More details ▾"}
                  </button>
                  <p className="mt-2 text-[10px] font-bold text-brown-faint">
                    {m.until} {promo.until}
                    {promo.validMonth ? ` · ${m.monthOnly} ${promo.validMonth}` : ""}
                  </p>

                  {promo.claimed ? (
                    <div className="mt-3 rounded-catcha-sm bg-sage/15 px-3 py-2 text-center">
                      <p className="text-xs font-bold text-ok">✅ {m.claimed}</p>
                      {promo.couponCode && (
                        <p className="mt-1 text-sm font-extrabold tracking-wide text-catcha-chocolate">
                          {promo.couponCode}
                        </p>
                      )}
                      {promo.claimedAt && (
                        <p className="mt-1 text-[10px] text-brown-faint">
                          {m.claimedAt} {promo.claimedAt.slice(0, 10)}
                        </p>
                      )}
                    </div>
                  ) : promo.eligible ? (
                    <button
                      type="button"
                      disabled={claimingId === promo.id}
                      onClick={() => claim(promo)}
                      className="mt-3 w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-2.5 text-xs font-extrabold text-catcha-chocolate disabled:opacity-50"
                    >
                      {claimingId === promo.id ? m.claiming : m.claim}
                    </button>
                  ) : (
                    <p className="mt-3 rounded-catcha-sm bg-paper px-3 py-2 text-center text-[10px] font-bold text-brown-soft">
                      {promo.reason || m.notEligible}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {claimedInfo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-catcha bg-card p-5 shadow-catcha">
            <p className="text-center text-sm font-extrabold text-ok">✅ {m.claimOk}</p>
            <p className="mt-2 text-center text-xs text-brown-soft">{claimedInfo.title}</p>
            {claimedInfo.pointsAwarded ? (
              <p className="mt-3 text-center text-2xl font-extrabold text-latte-deep">
                +{claimedInfo.pointsAwarded} {locale === "th" ? "แต้ม" : "pts"}
              </p>
            ) : null}
            {claimedInfo.code && (
              <p className="mt-3 rounded-catcha-sm bg-honey/25 py-3 text-center text-lg font-extrabold tracking-widest text-catcha-chocolate">
                {claimedInfo.code}
              </p>
            )}
            <p className="mt-2 text-center text-[10px] text-brown-faint">{m.showAtShop}</p>
            <button
              type="button"
              onClick={() => setClaimedInfo(null)}
              className="mt-4 w-full rounded-catcha-sm bg-latte/25 py-2.5 text-xs font-bold text-catcha-chocolate"
            >
              {t(locale).points.dismiss}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
