"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LocaleProvider } from "@/components/LocaleProvider";
import { Logo } from "@/components/Logo";
import Link from "next/link";

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setOk(true);
      return;
    }
    const token = sessionStorage.getItem("catcha-admin");
    if (!token) router.replace("/admin/login");
    else setOk(true);
  }, [pathname, router]);

  if (!ok) return null;

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const tabs = [
    { href: "/admin", label: "แดชบอร์ด", icon: "📊" },
    { href: "/admin/bookings/new", label: "จองใหม่", icon: "➕" },
    { href: "/admin/customers", label: "ลูกค้า", icon: "👤" },
    { href: "/admin/billing", label: "คิดเงิน", icon: "💳" },
    { href: "/admin/finance", label: "การเงิน", icon: "📒" },
    { href: "/admin/promos", label: "โปร", icon: "✨" },
    { href: "/admin/settings", label: "ตั้งค่า", icon: "⚙️" },
    { href: "/admin/setup", label: "ติดตั้ง", icon: "🚀" },
  ];

  return (
    <div className="min-h-screen bg-catcha-gradient">
      <header className="sticky top-0 z-40 border-b border-catcha-line bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Logo size={40} />
          <div className="flex-1">
            <p className="text-xs font-bold text-brown-soft">CatCha Admin</p>
            <p className="text-sm font-extrabold text-catcha-chocolate">หลังบ้าน</p>
          </div>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem("catcha-admin");
              router.push("/admin/login");
            }}
            className="text-xs font-bold text-brown-faint"
          >
            ออก
          </button>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                pathname === tab.href || pathname.startsWith(tab.href + "/")
                  ? "bg-honey/40 text-catcha-chocolate"
                  : "text-brown-soft"
              }`}
            >
              {tab.icon} {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <AdminShell>{children}</AdminShell>
    </LocaleProvider>
  );
}
