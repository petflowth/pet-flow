"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useConfig } from "@/components/ConfigProvider";
import { BookingOnlyNotice, PageHeader } from "@/components/PageHeader";
import { RoomCard } from "@/components/RoomCard";
import { ContentBlocks } from "@/components/ContentBlocks";
import { RoomSeasonPrices } from "@/components/RoomPriceDetails";

export default function RoomsPage() {
  const { locale } = useLocale();
  const { config } = useConfig();
  const m = t(locale).rooms;
  // จำนวนห้องจริงของร้าน (รวม count ของแต่ละแบบ ไม่นับห้องรวมที่ประกอบจากห้องเดี่ยว)
  // เดิมเขียนตายตัว "ทั้งหมด 13 ห้อง · 6S + 6M + 1 Netflix" ของร้านแมวตัวอย่าง — ทุกร้านเห็นเลขเดียวกันหมด
  const total = config.rooms.reduce(
    (sum, r) => sum + (!r.composedOf?.length && Number(r.count) > 0 ? Number(r.count) : 0),
    0
  );
  const subtitle = total > 0 ? (locale === "th" ? `ทั้งหมด ${total} ห้อง` : `${total} rooms total`) : undefined;

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Rooms"
        title={m.title}
        subtitle={subtitle}
        back="/app/services"
        backLabel={locale === "th" ? "บริการทั้งหมด" : "All services"}
      />
      <BookingOnlyNotice locale={locale} />
      <RoomSeasonPrices raw={config.roomSeasons} rooms={config.rooms} />
      <div className="grid gap-4">
        {config.rooms.map((room) => (
          <RoomCard key={room.id} room={room} locale={locale} />
        ))}
      </div>
      <ContentBlocks blocks={config.roomsPageBlocks} />
    </div>
  );
}
