"use client";

import Image from "next/image";
import Link from "next/link";
import type { RoomType } from "@/lib/business";
import type { Locale } from "@/lib/business";
import { t } from "@/lib/i18n";

export function RoomCard({
  room,
  locale,
}: {
  room: RoomType;
  locale: Locale;
}) {
  const m = t(locale).rooms;

  return (
    <Link
      href={`/app/rooms/${room.id}`}
      className="block overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm transition active:scale-[0.99]"
    >
      <div className="relative aspect-[4/3] w-full bg-paper">
        <Image
          src={room.image}
          alt={room.name}
          fill
          className="object-cover object-top"
          sizes="(max-width: 512px) 100vw, 400px"
        />
        <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-bold text-catcha-chocolate backdrop-blur-sm">
          {room.size}
          {room.count ? ` · ${room.count} ${m.units}` : ` · ${m.suite}`}
        </span>
      </div>
      <div className="p-4">
        <h3 className="font-extrabold text-catcha-chocolate">
          {room.name}
          {room.subtitle ? (
            <span className="block text-xs font-semibold text-brown-soft">
              {room.subtitle[locale]}
            </span>
          ) : null}
        </h3>
        <p className="mt-1 text-xs text-brown-soft">
          {room.cats[locale]} · {room.extra[locale]}
        </p>
        <p className="mt-2 text-lg font-extrabold text-latte-deep">
          {room.price}
          <span className="text-xs font-semibold text-brown-faint">
            {" "}
            {m.perNight}
          </span>
        </p>
        <p className="mt-2 text-[11px] font-bold text-latte-deep">{m.viewDetail} →</p>
      </div>
    </Link>
  );
}
