"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { PageHeader } from "@/components/PageHeader";

export default function ServicesPage() {
  const { locale } = useLocale();
  const m = t(locale).home;

  // แต่ละหมวดใช้สีต่างกัน (คงที่ ไม่ผูกกับสีแบรนด์ร้าน) ให้ดูมีชีวิตชีวา ไม่ใช่โทนเดียวซ้ำทั้งหน้า
  const cards = [
    {
      href: "/app/rooms",
      icon: "🛏️",
      title: m.room,
      desc:
        locale === "th"
          ? "ห้องพักแมวทุกแบบ + ราคา"
          : "All cat room types + pricing",
      bg: "bg-sky",
      text: "text-sky-deep",
    },
    {
      href: "/app/grooming",
      icon: "🛁",
      title: m.groom,
      desc:
        locale === "th"
          ? "เมนูอาบน้ำ-เป่าขน + รอบเวลา"
          : "Bath & grooming menu + time slots",
      bg: "bg-mint",
      text: "text-mint-deep",
    },
  ];

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader title={`✨ ${m.services}`} />
      <Link
        href="/app/book"
        className="mb-4 flex items-center gap-3 rounded-petflow bg-gradient-to-r from-latte-deep to-petflow-chocolate p-4 text-card shadow-petflow-sm transition active:scale-[0.98]"
      >
        <span className="text-2xl">📅</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">จองคิวเอง</span>
          <span className="block text-[11px] opacity-80">
            เลือกวัน-เวลาว่างเอง ไม่ต้องคุยกับพนักงาน
          </span>
        </span>
        <span>→</span>
      </Link>
      <div className="grid gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`flex items-center gap-4 rounded-petflow p-5 shadow-petflow-sm transition active:scale-[0.98] ${c.bg}`}
          >
            <span className="text-3xl">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-base font-extrabold ${c.text}`}>{c.title}</p>
              <p className="mt-0.5 text-xs text-brown-soft">{c.desc}</p>
            </div>
            <span className={c.text}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
