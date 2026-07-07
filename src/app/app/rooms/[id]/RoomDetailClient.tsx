"use client";

import Image from "next/image";
import Link from "next/link";
import type { RoomType } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { LineBookingCta } from "@/components/PageHeader";

export default function RoomDetailClient({ room }: { room: RoomType }) {
  const { locale } = useLocale();
  const m = t(locale).rooms;

  return (
    <div className="pb-6">
      <div className="relative aspect-[3/4] w-full bg-paper">
        <Image
          src={room.image}
          alt={room.name}
          fill
          className="object-cover object-top"
          priority
          sizes="100vw"
        />
        <Link
          href="/app/rooms"
          className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1.5 text-xs font-bold text-catcha-chocolate backdrop-blur-sm"
        >
          ← {m.back}
        </Link>
      </div>

      <div className="px-4 pt-4">
        <p className="text-xs font-bold text-latte-deep">
          {room.size}
          {room.count
            ? ` · ${room.count} ${m.units}`
            : room.config
              ? ` · ${room.config[locale]}`
              : ` · ${m.suite}`}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-catcha-chocolate">
          {room.name}
        </h1>
        {room.subtitle ? (
          <p className="text-sm font-semibold text-brown-soft">
            {room.subtitle[locale]}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-honey/35 px-3 py-1.5 text-sm font-extrabold text-catcha-chocolate">
            {room.price} {m.perNight}
          </span>
          <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-brown-soft">
            {room.cats[locale]}
          </span>
          <span className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-brown-soft">
            {room.extra[locale]}
          </span>
        </div>

        {room.dimensions ? (
          <p className="mt-3 text-xs text-brown-soft">
            📐 {m.sizeLabel}: {room.dimensions[locale]}
          </p>
        ) : null}
        {room.note ? (
          <p className="mt-2 rounded-catcha-sm bg-latte/15 px-3 py-2 text-xs font-medium text-brown">
            💡 {room.note[locale]}
          </p>
        ) : null}

        <section className="mt-5 rounded-catcha bg-card p-4 shadow-catcha-sm">
          <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">
            {m.amenities}
          </h2>
          <ul className="space-y-2">
            {room.amenities[locale].map((item) => (
              <li
                key={item}
                className="flex gap-2 text-xs leading-relaxed text-brown-soft"
              >
                <span className="text-honey-deep">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <LineBookingCta locale={locale} />
      </div>
    </div>
  );
}
