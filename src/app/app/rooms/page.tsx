"use client";

import { ROOM_INVENTORY, ROOMS } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { PageHeader } from "@/components/PageHeader";
import { RoomCard } from "@/components/RoomCard";

export default function RoomsPage() {
  const { locale } = useLocale();
  const m = t(locale).rooms;

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        title={`🏠 ${m.title}`}
        subtitle={`${m.total} · ${ROOM_INVENTORY.miniMeow}S + ${ROOM_INVENTORY.midCozy}M + ${ROOM_INVENTORY.catflix} Netflix`}
      />
      <div className="grid gap-4">
        {ROOMS.map((room) => (
          <RoomCard key={room.id} room={room} locale={locale} />
        ))}
      </div>
    </div>
  );
}
