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
        <h1 className="text-xl font-extrabold text-petflow-chocolate">{title}</h1>
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
      href="https://line.me/R/ti/p/@petflow"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 block rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-center text-sm font-extrabold text-petflow-chocolate shadow-petflow-sm"
    >
      {locale === "th"
        ? "💬 ทัก LINE @petflow เพื่อจอง"
        : "💬 Chat LINE @petflow to book"}
    </a>
  );
}
