"use client";

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

  const posters = [menus.bath?.poster, menus.advance?.poster].filter(
    (src): src is string => Boolean(src)
  );

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader title={`🛁 ${m.title}`} />

      <div className="space-y-4">
        {posters.length === 0 && (
          <div className="flex aspect-[4/3] items-center justify-center rounded-petflow border border-dashed border-petflow-line bg-card text-sm text-brown-soft">
            🐾 ร้านยังไม่ได้อัปโหลดเมนู — ตั้งค่าได้ที่หลังบ้าน
          </div>
        )}
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

      <LineBookingCta locale={locale} />
    </div>
  );
}
