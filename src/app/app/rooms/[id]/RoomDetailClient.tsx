"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useConfig } from "@/components/ConfigProvider";
import { LineBookingCta } from "@/components/PageHeader";
import { RoomPoster } from "@/components/RoomPoster";

export default function RoomDetailClient({ roomId }: { roomId: string }) {
  const { locale } = useLocale();
  const { config, loading } = useConfig();
  const m = t(locale).rooms;
  const room = config.rooms.find((r) => r.id === roomId);

  if (loading) {
    return <p className="p-6 text-center text-sm text-brown-soft">{t(locale).common.loading}</p>;
  }

  if (!room) {
    return <p className="p-6 text-center text-sm text-brown-soft">ไม่พบห้อง</p>;
  }

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
