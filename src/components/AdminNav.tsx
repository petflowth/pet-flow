"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

const TABS = [
  { href: "/admin", label: "แดชบอร์ด", icon: "📊" },
  { href: "/admin/bookings/new", label: "จองใหม่", icon: "➕" },
  { href: "/admin/customers", label: "ลูกค้า", icon: "👤" },
  { href: "/admin/billing", label: "คิดเงิน", icon: "💳" },
  { href: "/admin/finance", label: "การเงิน", icon: "📒" },
  { href: "/admin/promos", label: "โปร", icon: "✨" },
  { href: "/admin/settings", label: "ตั้งค่า", icon: "⚙️" },
  { href: "/admin/setup", label: "ติดตั้ง", icon: "🚀" },
] as const;

function isTabActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getActiveAdminTabLabel(pathname: string) {
  return TABS.find((t) => isTabActive(pathname, t.href))?.label || "เมนู";
}

function NavLink({
  href,
  label,
  icon,
  active,
  onNavigate,
  className = "",
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-catcha-sm font-bold transition ${
        active
          ? "bg-honey/40 text-catcha-chocolate"
          : "text-brown-soft hover:bg-honey/15 hover:text-catcha-chocolate"
      } ${className}`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function AdminMenuButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="admin-mobile-menu"
      aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-catcha-sm border border-catcha-line bg-paper md:hidden"
    >
      <span className="relative block h-4 w-5">
        <span
          className={`absolute left-0 top-0 block h-0.5 w-5 rounded-full bg-catcha-chocolate transition ${
            open ? "top-[7px] rotate-45" : ""
          }`}
        />
        <span
          className={`absolute left-0 top-[7px] block h-0.5 w-5 rounded-full bg-catcha-chocolate transition ${
            open ? "opacity-0" : ""
          }`}
        />
        <span
          className={`absolute bottom-0 left-0 block h-0.5 w-5 rounded-full bg-catcha-chocolate transition ${
            open ? "bottom-[7px] -rotate-45" : ""
          }`}
        />
      </span>
    </button>
  );
}

export function AdminNav({
  menuOpen,
  setMenuOpen,
}: {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen, setMenuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav
        className="mx-auto hidden max-w-6xl flex-wrap gap-1 px-4 pb-3 md:flex lg:gap-2"
        aria-label="เมนูหลังบ้าน"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.href}
            {...tab}
            active={isTabActive(pathname, tab.href)}
            className="px-3 py-2 text-sm"
          />
        ))}
      </nav>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="ปิดเมนู"
            className="fixed inset-0 z-40 bg-catcha-chocolate/25 md:hidden"
            onClick={closeMenu}
          />
          <nav
            id="admin-mobile-menu"
            className="absolute left-0 right-0 top-full z-50 border-b border-catcha-line bg-card px-3 py-3 shadow-catcha md:hidden"
            aria-label="เมนูหลังบ้าน"
          >
            <ul className="mx-auto max-w-3xl space-y-1">
              {TABS.map((tab) => (
                <li key={tab.href}>
                  <NavLink
                    {...tab}
                    active={isTabActive(pathname, tab.href)}
                    onNavigate={closeMenu}
                    className="w-full px-4 py-3 text-sm"
                  />
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </>
  );
}
