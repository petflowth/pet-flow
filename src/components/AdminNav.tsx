"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const ADMIN_TABS = [
  { href: "/admin", label: "แดชบอร์ด", icon: "📊" },
  { href: "/admin/schedule", label: "ตารางนัด", icon: "🗓️" },
  { href: "/admin/bookings/new", label: "จองใหม่", icon: "➕" },
  { href: "/admin/customers", label: "ลูกค้า", icon: "👤" },
  { href: "/admin/billing", label: "คิดเงิน", icon: "💳" },
  { href: "/admin/finance", label: "รายรับ-รายจ่าย", icon: "📒" },
  { href: "/admin/insights", label: "สรุปข้อมูล", icon: "📊" },
  { href: "/admin/promos", label: "โปร", icon: "✨" },
  { href: "/admin/coupons", label: "คูปอง", icon: "🎟️" },
  { href: "/admin/cards", label: "ปรับแต่งการ์ด LINE", icon: "🎴" },
  { href: "/admin/articles", label: "บทความหน้าเว็บ", icon: "📝" },
  { href: "/admin/settings", label: "ตั้งค่า", icon: "⚙️" },
  { href: "/admin/trash", label: "ถังขยะ", icon: "🗑️" },
  { href: "/admin/setup", label: "ติดตั้ง", icon: "🚀" },
] as const;

const TABS = ADMIN_TABS;

function isTabActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** เมนูที่ผู้ใช้ปัจจุบันเห็นได้ — null = เจ้าของ (เห็นทุกเมนู) */
export function getAllowedMenus(): string[] | null {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem("catcha-role") !== "staff") return null;
  try {
    const menus = JSON.parse(sessionStorage.getItem("catcha-menus") || "[]");
    return Array.isArray(menus) ? menus : [];
  } catch {
    return [];
  }
}

/** พนักงานเปิดหน้าที่ไม่มีสิทธิ์ได้ไหม — ใช้ทั้ง nav และ guard ใน layout */
export function isPathAllowed(pathname: string, allowed: string[] | null) {
  if (!allowed) return true;
  return allowed.some((href) => isTabActive(pathname, href));
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
      className={`flex items-center gap-3 rounded-catcha-sm font-bold transition ${
        active
          ? "bg-honey/40 text-catcha-chocolate"
          : "text-brown-soft hover:bg-honey/15 hover:text-catcha-chocolate"
      } ${className}`}
    >
      <span aria-hidden className="text-lg leading-none">
        {icon}
      </span>
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
      aria-controls="admin-menu"
      aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-catcha-sm border border-catcha-line bg-paper"
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
  // เมนูของพนักงานถูกกรองตามสิทธิ์ที่เจ้าของตั้งไว้ (เมนูเปิดหลัง mount เสมอ อ่าน sessionStorage ได้เลย)
  const allowed = getAllowedMenus();
  const visibleTabs = TABS.filter((t) => !allowed || allowed.includes(t.href));

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

  if (!menuOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="ปิดเมนู"
        className="fixed inset-0 z-40 bg-catcha-chocolate/25"
        onClick={closeMenu}
      />
      <nav
        id="admin-menu"
        className="absolute left-0 right-0 top-full z-50 border-b border-catcha-line bg-card px-3 py-3 shadow-catcha"
        aria-label="เมนูหลังบ้าน"
      >
        <ul className="mx-auto grid max-w-6xl gap-1 sm:grid-cols-2">
          {visibleTabs.map((tab) => (
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
  );
}
