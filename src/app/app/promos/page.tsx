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
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // kind=display เท่านั้น — โปรแบบ "customer" (โปรเด่นเฉพาะคุณ) โชว์ผ่าน
    // CustomerExclusivePromos ด้านบนแล้ว ไม่งั้นจะขึ้นซ้ำสองรอบ
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
            {promo.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={promo.imageUrl} alt="" className="h-32 w-full object-cover" />
            )}
            <div className="p-4">
              <p className="line-clamp-1 text-sm font-extrabold text-catcha-chocolate">
                {promo.title[locale]}
                {promo.discountPercent ? ` · ${promo.discountPercent}%` : ""}
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
