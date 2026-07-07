"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { t } from "@/lib/i18n";

const tabs = [
  { href: "/app", key: "home" as const, icon: "🏠", match: (p: string) => p === "/app" },
  { href: "/app/rooms", key: "rooms" as const, icon: "🛏️", match: (p: string) => p.startsWith("/app/rooms") },
  { href: "/app/grooming", key: "grooming" as const, icon: "🛁", match: (p: string) => p.startsWith("/app/grooming") },
  { href: "/app/bookings", key: "bookings" as const, icon: "📅", match: (p: string) => p.startsWith("/app/bookings") },
  { href: "/app/points", key: "points" as const, icon: "⭐", match: (p: string) => p.startsWith("/app/points") || p.startsWith("/app/promos") },
];

export function CustomerNav() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const m = t(locale).nav;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-catcha-line bg-card/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg justify-between">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-bold transition ${
                active ? "text-latte-deep" : "text-brown-faint"
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span className="truncate">{m[tab.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
