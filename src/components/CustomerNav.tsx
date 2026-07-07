"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { t } from "@/lib/i18n";

const tabs = [
  { href: "/app", key: "home" as const, icon: "🏠" },
  { href: "/app/bookings", key: "bookings" as const, icon: "📅" },
  { href: "/app/points", key: "points" as const, icon: "⭐" },
  { href: "/app/promos", key: "promos" as const, icon: "🎁" },
];

export function CustomerNav() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const m = t(locale).nav;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-catcha-line bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg justify-around">
        {tabs.map((tab) => {
          const active =
            tab.href === "/app"
              ? pathname === "/app" || pathname.endsWith("/app")
              : pathname.includes(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-bold transition ${
                active ? "text-latte-deep" : "text-brown-faint"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              {m[tab.key]}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
