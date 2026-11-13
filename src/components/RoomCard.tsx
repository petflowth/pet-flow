"use client";

import Link from "next/link";
import type { RoomType } from "@/lib/business";
import type { Locale } from "@/lib/business";
import { RoomPoster } from "@/components/RoomPoster";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import { useConfig } from "@/components/ConfigProvider";
import { roomPriceLine } from "@/components/RoomPriceDetails";

export function RoomCard({
  room,
  locale,
}: {
  room: RoomType;
  locale: Locale;
}) {
  const m = t(locale).rooms;
  const { config } = useConfig();

  return (
    <Link
      href={`/app/rooms/${room.id}`}
      className="block overflow-hidden rounded-petflow border border-petflow-line bg-card shadow-petflow-sm transition active:scale-[0.99]"
    >
      <RoomPoster src={room.image} alt={room.name} />
      <div className="flex min-h-[56px] items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-petflow-chocolate">
            {room.name}
          </p>
          <p className="text-[11px] text-brown-soft">
            {roomPriceLine(room, config.roomSeasons, m.perNight, locale === "en")} · {m.tapToView}
          </p>
          {room.note?.th && locale === "th" && (
            <p className="mt-0.5 text-[11px] leading-snug text-brown-faint">{room.note.th}</p>
          )}
        </div>
        <Icon name="chevron" size={18} className="text-brown-faint" />
      </div>
    </Link>
  );
}
