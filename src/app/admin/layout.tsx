"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LocaleProvider } from "@/components/LocaleProvider";
import { Logo } from "@/components/Logo";
import {
  AdminMenuButton,
  AdminNav,
  getActiveAdminTabLabel,
  getAllowedMenus,
  isPathAllowed,
} from "@/components/AdminNav";
import { Toaster } from "@/components/Toast";

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setOk(true);
      return;
    }
    // สิทธิ์จริงถูกตรวจที่ middleware แล้ว (คุกกี้เซ็นชื่อ) — ตรงนี้แค่ยืนยันกับเซิร์ฟเวอร์
    // ว่ายังล็อกอินอยู่ไหม แล้วซิงก์บทบาท/เมนูให้ตรงกับของจริง
    let alive = true;
    (async () => {
      const res = await fetch("/api/auth/login").catch(() => null);
      if (!alive) return;
      if (!res || !res.ok) {
        sessionStorage.removeItem("catcha-role");
        sessionStorage.removeItem("catcha-menus");
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const me = await res.json().catch(() => null);
      if (!alive || !me?.ok) return;
      sessionStorage.setItem("catcha-role", me.role);
      sessionStorage.setItem("catcha-staff-name", me.name || "พนักงาน");
      if (me.role === "staff") {
        sessionStorage.setItem("catcha-menus", JSON.stringify(me.menus || []));
      } else {
        sessionStorage.removeItem("catcha-menus");
      }
      // พนักงาน — เข้าได้เฉพาะเมนูที่เจ้าของอนุญาต ถ้าหลุดมาหน้าอื่นเด้งกลับเมนูแรกที่มีสิทธิ์
      const allowed = getAllowedMenus();
      if (!isPathAllowed(pathname, allowed)) {
        router.replace(allowed && allowed[0] ? allowed[0] : "/admin/login");
        return;
      }
      setOk(true);
      // อัปเดตฐานข้อมูลอัตโนมัติครั้งเดียวต่อ session (idempotent, ไม่บล็อก UI)
      if (!sessionStorage.getItem("catcha-migrated")) {
        sessionStorage.setItem("catcha-migrated", "1");
        fetch("/api/admin/migrate", { method: "POST" }).catch(() => {});
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (!ok) return null;

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-catcha-gradient">
      <Toaster />
      <header className="sticky top-0 z-50 border-b border-catcha-line bg-card/90 backdrop-blur-md">
        <div className="relative mx-auto max-w-3xl lg:max-w-6xl">
          <div className="flex items-center gap-3 px-4 py-3">
            <Logo size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-brown-soft">CatCha Admin</p>
              <p className="truncate text-sm font-extrabold text-catcha-chocolate lg:text-base">
                หลังบ้าน
              </p>
              <p className="truncate text-[10px] font-bold text-latte-deep sm:text-xs">
                {getActiveAdminTabLabel(pathname)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <AdminMenuButton
                open={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              />
              <button
                type="button"
                onClick={async () => {
                  // ต้องล้างคุกกี้ที่เซิร์ฟเวอร์ด้วย ไม่ใช่แค่ล้างใน sessionStorage
                  await fetch("/api/auth/login", { method: "DELETE" }).catch(() => {});
                  sessionStorage.clear();
                  router.push("/admin/login");
                }}
                className="rounded-catcha-sm px-2 py-1.5 text-xs font-bold text-brown-faint hover:bg-honey/15 lg:text-sm"
              >
                ออก
              </button>
            </div>
          </div>
          <AdminNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5 lg:max-w-6xl lg:px-6 lg:py-8">
        {children}
      </main>
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
