"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useConfig } from "@/components/ConfigProvider";
import { LineBookingCta, PageHeader } from "@/components/PageHeader";

export default function GroomingPage() {
  const { locale } = useLocale();
  const { config } = useConfig();
  const m = t(locale).grooming;

  const menus = config.grooming.menus as {
    bath?: { poster?: string };
    advance?: { poster?: string };
  };

  const posters = [
    menus.bath?.poster || "/catalog/grooming/bath-menu.jpg",
    menus.advance?.poster || "/catalog/grooming/advance-menu.jpg",
  ].filter(Boolean);

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader title={`🛁 ${m.title}`} />

      <div className="space-y-4">
        {posters.map((src) => (
          <div
            key={src}
            className="overflow-hidden rounded-petflow border border-petflow-line bg-card shadow-petflow-sm"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="block w-full h-auto" />
          </div>
        ))}
      </div>

      <Link
        href="/app/book?service=groom"
        className="mt-5 block rounded-petflow-sm bg-latte-deep py-3.5 text-center text-sm font-extrabold text-white shadow-petflow-sm"
      >
        📅 จองคิวอาบน้ำเอง
      </Link>
      <LineBookingCta locale={locale} />
    </div>
  );
}
