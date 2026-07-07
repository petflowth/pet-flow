"use client";

import { DEMO_PROMOS } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { LangSwitch } from "@/components/LangSwitch";

export default function PromosPage() {
  const { locale } = useLocale();
  const m = t(locale).promos;

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-catcha-chocolate">🎁 {m.title}</h1>
        <LangSwitch />
      </div>

      <ul className="space-y-3">
        {DEMO_PROMOS.map((promo) => (
          <li
            key={promo.id}
            className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm"
          >
            <div className="bg-gradient-to-r from-catcha-yellow/50 to-honey/40 px-4 py-2">
              <p className="text-sm font-extrabold text-catcha-chocolate">
                {promo.title[locale]}
              </p>
            </div>
            <div className="p-4">
              <p className="text-sm leading-relaxed text-brown-soft">
                {promo.body[locale]}
              </p>
              <p className="mt-3 text-[10px] font-bold text-brown-faint">
                {m.until} {promo.until}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
