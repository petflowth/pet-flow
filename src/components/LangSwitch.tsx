"use client";

import { useLocale } from "./LocaleProvider";
import { t } from "@/lib/i18n";

export function LangSwitch() {
  const { locale, setLocale } = useLocale();
  const next = locale === "th" ? "en" : "th";
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="rounded-full border border-catcha-line bg-card px-3 py-1.5 text-xs font-bold text-brown-soft shadow-catcha-sm"
    >
      {t(locale).common.lang}
    </button>
  );
}
