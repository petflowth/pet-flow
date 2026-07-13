"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  type Booking,
} from "@/lib/business";
import { useConfig } from "@/components/ConfigProvider";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { CustomerExclusivePromos } from "@/components/CustomerExclusivePromos";
import { MyCatsSection } from "@/components/MyCatsSection";

export default function CustomerHome() {
  const { locale } = useLocale();
  const { profile, ready } = useLiff();
  const { config } = useConfig();
  const m = t(locale).home;
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [hasPromos, setHasPromos] = useState(false);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    const q = new URLSearchParams({ lineUserId: profile.lineUserId });
    fetch(`/api/bookings?${q}`)
      .then((r) => r.json())
      .then((data) => {
        const list: Booking[] = data.bookings || [];
        const pending = list.find((b) => b.status === "pending");
        setNextBooking(pending || null);
      })
      .catch(() => setNextBooking(null));
  }, [profile?.lineUserId]);

  const points = profile?.points ?? 0;

  return (
    <div className="px-4 pb-6 pt-5">
      <header className="mb-5 flex items-center gap-3">
        {profile?.pictureUrl ? (
          <Image
            src={profile.pictureUrl}
            alt=""
            width={52}
            height={52}
            className="rounded-full border-2 border-honey/50 object-cover"
          />
        ) : (
          <Logo size={52} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-brown-soft">
            {m.greeting}
            {profile ? `, ${profile.displayName}` : ""}
          </p>
          <h1 className="text-lg font-extrabold text-catcha-chocolate">
            CatCha <span className="text-latte-deep">Hotel</span>
          </h1>
        </div>
        <LangSwitch />
      </header>

      <Link
        href="/app/coupons"
        className="mb-3 flex items-center justify-between gap-2 rounded-catcha border border-honey/50 bg-gradient-to-r from-honey/25 to-latte/15 px-4 py-3 shadow-catcha-sm"
      >
        <span className="text-sm font-extrabold text-catcha-chocolate">
          🎁 ชวนเพื่อน รับคูปอง 100฿
        </span>
        <span className="rounded-full bg-latte-deep px-2.5 py-1 text-[10px] font-bold text-card">
          กระเป๋าคูปอง →
        </span>
      </Link>

      <Link
        href="/app/profile"
        className="mb-4 flex items-center justify-center gap-1 rounded-catcha-sm bg-paper/70 px-3 py-2 text-xs font-bold text-brown-soft"
      >
        ✏️ แก้ไขข้อมูลของฉัน / น้องแมว
      </Link>

      {!ready && (
        <p className="mb-4 rounded-catcha-sm bg-paper px-4 py-3 text-sm text-brown-soft">
          {t(locale).common.loading}
        </p>
      )}

      {/* คะแนนสะสม */}
      <section className="mb-4 overflow-hidden rounded-catcha bg-gradient-to-br from-honey/45 via-card to-latte/15 p-5 shadow-catcha">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-brown-soft">{m.yourPoints}</p>
            <p className="mt-1 text-4xl font-extrabold text-latte-deep">
              {points}
              <span className="ml-1 text-sm font-bold text-brown-faint">
                {locale === "th" ? "แต้ม" : "pts"}
              </span>
            </p>
            <p className="mt-1 text-[10px] text-brown-faint">
              {t(locale).points.rate} · {config.business.pointsRate}{" "}
              {locale === "th" ? "บาท" : "THB"}
            </p>
          </div>
          <Link
            href="/app/points"
            className="shrink-0 rounded-full bg-card/80 px-3 py-1.5 text-[10px] font-bold text-catcha-chocolate shadow-catcha-sm"
          >
            {m.pointsHistory} →
          </Link>
        </div>
      </section>

      {/* แมวของฉัน — อัป/แก้รูปเองได้ */}
      <MyCatsSection />

      {/* โปรพิเศษลูกค้า — โผล่เฉพาะตอนมีโปรจริง (ไม่มี = ซ่อนทั้งช่อง) */}
      <CustomerExclusivePromos compact onHasPromos={setHasPromos} />

      {hasPromos && (
        <div className="mb-4 text-right">
          <Link href="/app/promos" className="text-[10px] font-bold text-latte-deep">
            {m.promosNow} · {m.seeAll} →
          </Link>
        </div>
      )}

      {/* คิวถัดไป */}
      {nextBooking ? (
        <section className="mb-4 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-catcha-chocolate">
              📅 {m.nextBooking}
            </h2>
            <span className="rounded-full bg-honey/30 px-2 py-0.5 text-[10px] font-bold text-wait">
              {t(locale).bookings.pending}
            </span>
          </div>
          <p className="text-sm font-bold text-brown">
            {nextBooking.catName} · {nextBooking.customerName}
          </p>
          <p className="text-xs text-brown-soft">
            {nextBooking.date}
            {nextBooking.time ? ` · ${nextBooking.time}` : ""}
          </p>
          <Link
            href="/app/bookings"
            className="mt-3 block rounded-catcha-sm bg-latte/25 py-2.5 text-center text-xs font-extrabold text-catcha-chocolate"
          >
            {m.confirmBooking} →
          </Link>
        </section>
      ) : null}

      <a
        href="https://line.me/R/ti/p/@catchahotel"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 block rounded-catcha-sm border border-catcha-line bg-card py-3 text-center text-xs font-bold text-brown-soft"
      >
        💬 LINE {config.business.lineOa} · {m.chatBook}
      </a>
    </div>
  );
}
