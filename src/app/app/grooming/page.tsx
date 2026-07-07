"use client";

import { useState } from "react";
import Image from "next/image";
import { GROOM_SLOTS, TRANSPORT } from "@/lib/business";
import {
  GROOM_MENUS,
  GROOM_NOTES,
  GROOM_SIZE_LABELS,
  GROOM_SPECIALS,
} from "@/lib/grooming";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { LineBookingCta, PageHeader } from "@/components/PageHeader";

export default function GroomingPage() {
  const { locale } = useLocale();
  const m = t(locale).grooming;
  const [tab, setTab] = useState<"bath" | "advance">("bath");
  const [showPoster, setShowPoster] = useState(false);

  const menu = GROOM_MENUS[tab];

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        title={`🛁 ${m.title}`}
        subtitle={`${m.slots}: ${GROOM_SLOTS.join(" · ")} · ${m.private}`}
      />

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "bath" as const, label: m.bath },
            { id: "advance" as const, label: m.advance },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-catcha-sm py-2.5 text-xs font-bold ${
              tab === item.id
                ? "bg-honey/45 text-catcha-chocolate shadow-catcha-sm"
                : "bg-paper text-brown-soft"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="mb-4 overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
        <button
          type="button"
          onClick={() => setShowPoster((v) => !v)}
          className="relative block w-full aspect-[3/4] max-h-72 bg-paper"
        >
          <Image
            src={menu.poster}
            alt={menu.title[locale]}
            fill
            className="object-cover object-top"
            sizes="100vw"
          />
          <span className="absolute bottom-2 right-2 rounded-full bg-card/90 px-3 py-1 text-[10px] font-bold text-catcha-chocolate backdrop-blur-sm">
            {showPoster ? m.hidePoster : m.viewPoster}
          </span>
        </button>
        {showPoster ? (
          <div className="relative aspect-[3/4] w-full bg-paper">
            <Image
              src={menu.poster}
              alt={menu.title[locale]}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
        ) : null}
        <div className="p-4">
          <h2 className="text-sm font-extrabold text-catcha-chocolate">
            {menu.title[locale]}
          </h2>
          <p className="text-xs text-brown-soft">{menu.subtitle[locale]}</p>
        </div>
      </section>

      {tab === "bath" ? (
        <BathTables locale={locale} />
      ) : (
        <AdvanceTable locale={locale} />
      )}

      <section className="mt-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <h3 className="mb-2 text-sm font-extrabold text-catcha-chocolate">
          {m.special}
        </h3>
        <ul className="space-y-2">
          {GROOM_SPECIALS[locale].map((item) => (
            <li
              key={item.name}
              className="flex justify-between gap-2 text-xs text-brown-soft"
            >
              <span>{item.name}</span>
              <span className="shrink-0 font-bold text-latte-deep">
                {item.price} {locale === "th" ? "บาท" : "THB"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-catcha bg-paper/70 p-4">
        <h3 className="mb-2 text-xs font-extrabold text-brown">{m.notes}</h3>
        <ul className="space-y-1.5">
          {GROOM_NOTES[locale].map((note) => (
            <li key={note} className="text-[11px] leading-relaxed text-brown-soft">
              · {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
        <div className="relative aspect-[4/3] w-full bg-paper">
          <Image
            src="/catalog/services/transport.jpg"
            alt="transport"
            fill
            className="object-cover object-top"
            sizes="100vw"
          />
        </div>
        <div className="p-4">
          <h3 className="text-sm font-extrabold text-catcha-chocolate">
            🚗 {m.transport}
          </h3>
          <ul className="mt-2 space-y-1">
            {TRANSPORT[locale].map((line) => (
              <li key={line} className="text-xs text-brown-soft">
                · {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <LineBookingCta locale={locale} />
    </div>
  );
}

function BathTables({ locale }: { locale: "th" | "en" }) {
  const menu = GROOM_MENUS.bath;
  const sizes = GROOM_SIZE_LABELS[locale];

  return (
    <div className="space-y-4">
      {menu.programs.map((program) => (
        <div
          key={program.id}
          className="overflow-x-auto rounded-catcha border border-catcha-line bg-card shadow-catcha-sm"
        >
          <div className="border-b border-catcha-line bg-honey/20 px-3 py-2">
            <p className="text-xs font-extrabold text-catcha-chocolate">
              {program.name[locale]}
            </p>
            {"note" in program && program.note ? (
              <p className="mt-1 text-[10px] leading-relaxed text-brown-soft">
                {program.note[locale]}
              </p>
            ) : null}
          </div>
          <table className="w-full min-w-[280px] text-left text-[11px]">
            <thead>
              <tr className="bg-paper/80 text-brown-soft">
                <th className="px-3 py-2 font-bold">
                  {locale === "th" ? "สายพันธุ์" : "Breed"}
                </th>
                <th className="px-2 py-2 font-bold">{sizes.kitten}</th>
                <th className="px-2 py-2 font-bold">{sizes.m}</th>
                <th className="px-2 py-2 font-bold">{sizes.l}</th>
              </tr>
            </thead>
            <tbody>
              {menu.rows.map((row) => {
                const prices =
                  program.id === "dry" ? row.dry : row.degrease;
                return (
                  <tr
                    key={`${program.id}-${row.breed.th}`}
                    className="border-t border-catcha-line/60"
                  >
                    <td className="px-3 py-2 font-medium text-brown">
                      {row.breed[locale]}
                    </td>
                    <td className="px-2 py-2 text-latte-deep font-bold">
                      {prices.kitten}
                    </td>
                    <td className="px-2 py-2 text-latte-deep font-bold">
                      {prices.m}
                    </td>
                    <td className="px-2 py-2 text-latte-deep font-bold">
                      {prices.l}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function AdvanceTable({ locale }: { locale: "th" | "en" }) {
  const menu = GROOM_MENUS.advance;
  const sizes = GROOM_SIZE_LABELS[locale];

  return (
    <div className="space-y-4">
      {menu.variants.map((variant) => (
        <div
          key={variant.id}
          className="rounded-catcha border border-catcha-line bg-card p-3 shadow-catcha-sm"
        >
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-extrabold text-catcha-chocolate">
              {variant.name[locale]}
            </p>
            {"badge" in variant && variant.badge ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold text-red-700">
                {variant.badge[locale]}
              </span>
            ) : null}
          </div>
          <ul className="mb-3 space-y-1">
            {variant.features[locale].map((f) => (
              <li key={f} className="text-[10px] text-brown-soft">
                · {f}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="overflow-x-auto rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
        <table className="w-full min-w-[260px] text-left text-[11px]">
          <thead>
            <tr className="bg-paper/80 text-brown-soft">
              <th className="px-3 py-2 font-bold">
                {locale === "th" ? "สายพันธุ์" : "Breed"}
              </th>
              <th className="px-2 py-2 font-bold">{sizes.kitten}</th>
              <th className="px-2 py-2 font-bold">{sizes.m}</th>
              <th className="px-2 py-2 font-bold">{sizes.l}</th>
            </tr>
          </thead>
          <tbody>
            {menu.rows.map((row) => (
              <tr
                key={row.breed.th}
                className="border-t border-catcha-line/60"
              >
                <td className="px-3 py-2 font-medium text-brown">
                  {row.breed[locale]}
                </td>
                <td className="px-2 py-2 font-bold text-latte-deep">
                  {row.kitten}
                </td>
                <td className="px-2 py-2 font-bold text-latte-deep">
                  {row.m}
                </td>
                <td className="px-2 py-2 font-bold text-latte-deep">
                  {row.l}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
