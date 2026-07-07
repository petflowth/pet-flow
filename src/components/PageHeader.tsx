"use client";

import { LangSwitch } from "@/components/LangSwitch";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold text-catcha-chocolate">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-xs text-brown-soft">{subtitle}</p>
        ) : null}
      </div>
      <LangSwitch />
    </div>
  );
}

export function LineBookingCta({ locale }: { locale: "th" | "en" }) {
  return (
    <a
      href="https://line.me/R/ti/p/@catchahotel"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 block rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-center text-sm font-extrabold text-catcha-chocolate shadow-catcha-sm"
    >
      {locale === "th"
        ? "💬 ทัก LINE @catchahotel เพื่อจอง"
        : "💬 Chat LINE @catchahotel to book"}
    </a>
  );
}
