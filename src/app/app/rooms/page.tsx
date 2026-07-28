"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useConfig } from "@/components/ConfigProvider";
import { BookingOnlyNotice, PageHeader } from "@/components/PageHeader";
import { RoomCard } from "@/components/RoomCard";

export default function RoomsPage() {
  const { locale } = useLocale();
  const { config } = useConfig();
  const m = t(locale).rooms;
  const inv = config.roomInventory;

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        title={`🏠 ${m.title}`}
        subtitle={`${m.total} · ${inv.miniMeow}S + ${inv.midCozy}M + ${inv.catflix} Netflix`}
        back="/app/services"
        backLabel={locale === "th" ? "บริการทั้งหมด" : "All services"}
      />
      <BookingOnlyNotice locale={locale} />
      <div className="grid gap-4">
        {config.rooms.map((room) => (
          <RoomCard key={room.id} room={room} locale={locale} />
        ))}
      </div>
    </div>
  );
}
