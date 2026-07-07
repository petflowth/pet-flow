"use client";

import Link from "next/link";
import type { RoomType } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { LineBookingCta } from "@/components/PageHeader";
import { RoomPoster } from "@/components/RoomPoster";

export default function RoomDetailClient({ room }: { room: RoomType }) {
  const { locale } = useLocale();
  const m = t(locale).rooms;

  return (
    <div className="pb-6">
      <div className="px-4 pt-4">
        <Link
          href="/app/rooms"
          className="mb-3 inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-catcha-chocolate shadow-catcha-sm"
        >
          ← {m.back}
        </Link>
      </div>

      <div className="px-4">
        <RoomPoster src={room.image} alt={room.name} priority />
        <p className="mt-2 text-center text-[10px] text-brown-faint">
          {m.posterHint}
        </p>
      </div>

      <div className="px-4 pt-4">
        <LineBookingCta locale={locale} />
      </div>
    </div>
  );
}
