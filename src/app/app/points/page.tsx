"use client";

import { BUSINESS } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { LangSwitch } from "@/components/LangSwitch";

export default function PointsPage() {
  const { locale } = useLocale();
  const { profile } = useLiff();
  const m = t(locale).points;
  const points = profile?.points ?? 0;

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-catcha-chocolate">⭐ {m.title}</h1>
        <LangSwitch />
      </div>

      <div className="mb-5 rounded-catcha bg-gradient-to-br from-honey/40 via-card to-paper p-6 text-center shadow-catcha">
        <p className="text-sm font-semibold text-brown-soft">{m.balance}</p>
        <p className="mt-2 text-5xl font-extrabold text-latte-deep">{points}</p>
        <p className="mt-3 text-xs text-brown-faint">
          {m.rate} ({BUSINESS.pointsRate} {locale === "th" ? "บาท" : "THB"})
        </p>
      </div>

      <section className="rounded-catcha bg-card p-5 shadow-catcha-sm">
        <h2 className="mb-3 text-sm font-bold text-brown">{m.history}</h2>
        <p className="text-center text-sm text-brown-faint py-6">{m.empty}</p>
      </section>
    </div>
  );
}
