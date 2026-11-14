"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TextSizeSwitch } from "@/components/TextSizeSwitch";
import { BootProvider, ErrorBox, useBoot, useHref } from "./ui";

const TABS = [
  { href: "/salon", label: "วันนี้", icon: "📅" },
  { href: "/salon/customers", label: "ลูกค้า", icon: "👤" },
  { href: "/salon/report", label: "ยอดเงิน", icon: "💰" },
  { href: "/salon/settings", label: "ตั้งค่า", icon: "⚙️" },
];

function Header() {
  const { boot } = useBoot();
  return (
    <header className="sticky top-0 z-30 border-b-2 border-[#d5d9de] bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="truncate text-[24px] font-extrabold">✂️ {boot?.settings.shop_name || "ร้านทำผม"}</div>
        <TextSizeSwitch />
      </div>
    </header>
  );
}

function BottomNav() {
  const pathname = usePathname() || "";
  const href = useHref();
  const path = pathname.replace(/^\/s\/[^/]+/, "");
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-[#d5d9de] bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-3xl grid-cols-4">
        {TABS.map((t) => {
          const active = t.href === "/salon" ? path === "/salon" || path.startsWith("/salon/visit") || path.startsWith("/salon/new") || path.startsWith("/salon/pay") : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={href(t.href)}
              className={`flex min-h-[76px] flex-col items-center justify-center gap-0.5 text-[19px] font-bold ${
                active ? "bg-[#e8eef7] text-[#1f4e8c]" : "text-[#374151]"
              }`}
            >
              <span className="text-[26px] leading-none" aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function Body({ children }: { children: ReactNode }) {
  const { error } = useBoot();
  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-4">
      {error && (
        <ErrorBox
          text={
            error.includes("schema")
              ? "ระบบร้านทำผมยังไม่ได้เปิดในฐานข้อมูล — ติดต่อผู้ดูแลระบบ"
              : error
          }
        />
      )}
      {children}
    </main>
  );
}

export function SalonShell({ children }: { children: ReactNode }) {
  return (
    <BootProvider>
      <div className="min-h-screen bg-[#f6f7f9] text-[20px] leading-snug text-[#1a1a1a]">
        <Header />
        <Body>{children}</Body>
        <BottomNav />
      </div>
    </BootProvider>
  );
}
