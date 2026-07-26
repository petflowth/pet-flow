"use client";

import { useConfig } from "@/components/ConfigProvider";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { PointsRedeem } from "@/components/PointsRedeem";

export default function PointsPage() {
  const { locale } = useLocale();
  const { profile, history } = useLiff();
  const { config } = useConfig();
  const m = t(locale).points;
  const points = profile?.points ?? 0;

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-petflow-chocolate">⭐ {m.title}</h1>
        <LangSwitch />
      </div>

      <div className="mb-5 rounded-petflow bg-gradient-to-br from-honey/40 via-card to-paper p-6 text-center shadow-petflow">
        <p className="text-sm font-semibold text-brown-soft">{m.balance}</p>
        <p className="mt-2 text-5xl font-extrabold text-latte-deep">{points}</p>
        <p className="mt-3 text-xs text-brown-faint">
          {m.rate} ({config.business.pointsRate} {locale === "th" ? "บาท" : "THB"})
        </p>
      </div>

      <section className="mb-4 rounded-petflow bg-card p-5 shadow-petflow-sm">
        <h2 className="mb-3 text-sm font-bold text-brown">{m.redeemTitle}</h2>
        <PointsRedeem />
      </section>

      <section className="rounded-petflow bg-card p-5 shadow-petflow-sm">
        <h2 className="mb-3 text-sm font-bold text-brown">{m.history}</h2>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-brown-faint">{m.empty}</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="rounded-petflow-sm border border-petflow-line bg-paper/50 px-3 py-2.5 text-xs"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-brown">
                    {locale === "th" ? h.labelTh : h.labelEn}
                  </span>
                  <span
                    className={`shrink-0 font-extrabold ${
                      h.points > 0 ? "text-ok" : "text-latte-deep"
                    }`}
                  >
                    {h.points > 0 ? "+" : ""}
                    {h.points}
                  </span>
                </div>
                {h.couponCode ? (
                  <p className="mt-1 font-mono text-[10px] text-latte-deep">
                    {h.couponCode}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-brown-faint">
                  {new Date(h.at).toLocaleDateString(
                    locale === "th" ? "th-TH" : "en-GB",
                    locale === "th" ? { calendar: "gregory" } : undefined
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
