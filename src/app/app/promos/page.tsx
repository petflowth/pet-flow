"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { LangSwitch } from "@/components/LangSwitch";
import { CustomerExclusivePromos } from "@/components/CustomerExclusivePromos";

type Promo = {
  id: string;
  title: { th: string; en: string };
  body: { th: string; en: string };
  until: string;
  imageUrl?: string;
  discountPercent?: number;
};

export default function PromosPage() {
  const { locale } = useLocale();
  const m = t(locale).promos;
  const [promos, setPromos] = useState<Promo[]>([]);

  useEffect(() => {
    fetch("/api/promos?active=1&kind=display")
      .then((r) => r.json())
      .then((data) => setPromos(data.promos || []));
  }, []);

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-catcha-chocolate">🎁 {m.title}</h1>
        <LangSwitch />
      </div>

      <CustomerExclusivePromos />

      <h2 className="mb-3 mt-5 text-sm font-extrabold text-catcha-chocolate">✨ {m.title}</h2>
      <ul className="space-y-3">
        {promos.map((promo) => (
          <li
            key={promo.id}
            className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm"
          >
            {promo.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={promo.imageUrl} alt="" className="h-32 w-full object-cover" />
            ) : (
              <div className="bg-gradient-to-r from-catcha-yellow/50 to-honey/40 px-4 py-2">
                <p className="text-sm font-extrabold text-catcha-chocolate">
                  {promo.title[locale]}
                  {promo.discountPercent ? ` · ${promo.discountPercent}%` : ""}
                </p>
              </div>
            )}
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
        {!promos.length && (
          <li className="rounded-catcha bg-card p-6 text-center text-sm text-brown-soft">
            ยังไม่มีโปรทั่วไปช่วงนี้
          </li>
        )}
      </ul>
    </div>
  );
}
