"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { PageHeader } from "@/components/PageHeader";

export default function ServicesPage() {
  const { locale } = useLocale();
  const m = t(locale).home;

  const cards = [
    {
      href: "/app/rooms",
      icon: "🛏️",
      title: m.room,
      desc:
        locale === "th"
          ? "ห้องพักแมวทุกแบบ + ราคา"
          : "All cat room types + pricing",
    },
    {
      href: "/app/grooming",
      icon: "🛁",
      title: m.groom,
      desc:
        locale === "th"
          ? "เมนูอาบน้ำ-เป่าขน + รอบเวลา"
          : "Bath & grooming menu + time slots",
    },
  ];

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader title={`✨ ${m.services}`} />
      <div className="grid gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-center gap-4 rounded-petflow border border-petflow-line bg-card p-5 shadow-petflow-sm transition active:scale-[0.98]"
          >
            <span className="text-3xl">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-petflow-chocolate">{c.title}</p>
              <p className="mt-0.5 text-xs text-brown-soft">{c.desc}</p>
            </div>
            <span className="text-brown-faint">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
