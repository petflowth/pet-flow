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
  locked = false,
}: {
  children: React.ReactNode;
  initial?: Locale;
  /** ล็อกภาษา (หลังบ้านใช้ภาษาไทยเสมอ ไม่ตามที่เลือกไว้ในแอปลูกค้าบนเครื่องเดียวกัน) */
  locked?: boolean;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);

  useEffect(() => {
    if (locked) return;
    const saved = localStorage.getItem("petflow-locale") as Locale | null;
    if (saved === "th" || saved === "en") setLocaleState(saved);
  }, [locked]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("petflow-locale", l);
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

/**
 * ข้อความ 2 ภาษาแบบสั้น — `const tr = useTr(); tr("ไทย", "English")`
 * ใช้ในหน้าลูกค้า: ลูกค้าเลือก EN แล้วต้องเห็นภาษาอังกฤษทั้งหน้า
 */
export function useTr() {
  const { locale } = useContext(LocaleContext);
  return (th: string, en: string) => (locale === "en" ? en : th);
}
