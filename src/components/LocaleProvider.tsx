"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Locale } from "@/lib/business";

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({ locale: "th", setLocale: () => {} });

export function LocaleProvider({
  children,
  initial = "th",
}: {
  children: React.ReactNode;
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  useEffect(() => {
    const saved = localStorage.getItem("catcha-locale") as Locale | null;
    if (saved === "th" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("catcha-locale", l);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
