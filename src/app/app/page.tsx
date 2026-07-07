"use client";

import Link from "next/link";
import { BUSINESS, GROOM_SLOTS } from "@/lib/business";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useLiff } from "@/components/LiffProvider";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";

export default function CustomerHome() {
  const { locale } = useLocale();
  const { profile, ready } = useLiff();
  const m = t(locale).home;

  return (
    <div className="px-4 pb-6 pt-5">
      <header className="mb-6 flex items-center gap-3">
        <Logo size={52} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-brown-soft">
            {m.greeting}
            {profile ? `, ${profile.displayName}` : ""}
          </p>
          <h1 className="text-xl font-extrabold text-catcha-chocolate">
            CatCha <span className="text-latte-deep">Hotel</span>
          </h1>
          <p className="text-xs font-medium text-brown-soft">{m.subtitle}</p>
        </div>
        <LangSwitch />
      </header>

      {!ready && (
        <p className="mb-4 rounded-catcha-sm bg-paper px-4 py-3 text-sm text-brown-soft">
          {t(locale).common.loading}
        </p>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3">
        <Link
          href="/app/rooms"
          className="rounded-catcha border border-catcha-line bg-gradient-to-br from-honey/30 to-card p-4 shadow-catcha-sm"
        >
          <span className="text-2xl">🛏️</span>
          <p className="mt-2 text-sm font-extrabold text-catcha-chocolate">
            {m.browseRooms}
          </p>
          <p className="mt-1 text-[10px] text-brown-soft">{m.roomsTotal}</p>
        </Link>
        <Link
          href="/app/grooming"
          className="rounded-catcha border border-catcha-line bg-gradient-to-br from-latte/20 to-card p-4 shadow-catcha-sm"
        >
          <span className="text-2xl">🛁</span>
          <p className="mt-2 text-sm font-extrabold text-catcha-chocolate">
            {m.browseGrooming}
          </p>
          <p className="mt-1 text-[10px] text-brown-soft">
            {m.slots}: {GROOM_SLOTS.join(" · ")}
          </p>
        </Link>
      </section>

      <section className="mb-5 rounded-catcha bg-card p-5 shadow-catcha">
        <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">
          {m.contact}
        </h2>
        <p className="mb-3 text-xs text-brown-soft">
          LINE {BUSINESS.lineOa} · {BUSINESS.location[locale]}
        </p>
        <div className="flex flex-wrap gap-2">
          {BUSINESS.phones.map((phone) => (
            <a
              key={phone}
              href={`tel:${phone.replace(/-/g, "")}`}
              className="rounded-full bg-honey/30 px-4 py-2 text-sm font-bold text-catcha-chocolate"
            >
              📞 {phone}
            </a>
          ))}
          <a
            href={BUSINESS.maps}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-latte/25 px-4 py-2 text-sm font-bold text-catcha-chocolate"
          >
            🗺️ {m.map}
          </a>
          <Link
            href="/app/promos"
            className="rounded-full bg-paper px-4 py-2 text-sm font-bold text-brown-soft"
          >
            🎁 {t(locale).nav.promos}
          </Link>
        </div>
      </section>

      <Link
        href="/app/bookings"
        className="block w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-4 text-center text-sm font-extrabold text-catcha-chocolate shadow-catcha-sm"
      >
        📅 {t(locale).nav.bookings}
      </Link>
    </div>
  );
}
