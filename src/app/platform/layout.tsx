"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

function PlatformShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (pathname === "/platform/login") {
      setOk(true);
      return;
    }
    let alive = true;
    (async () => {
      const res = await fetch("/api/platform/auth").catch(() => null);
      if (!alive) return;
      if (!res || !res.ok) {
        router.replace("/platform/login");
        return;
      }
      setOk(true);
    })();
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (!ok) return null;

  if (pathname === "/platform/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#1a1d29] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#232637]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-latte-deep text-lg">
            🛡️
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white/50">PetFlow Platform</p>
            <p className="text-sm font-extrabold">ผู้ดูแลระบบ</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/platform/auth", { method: "DELETE" }).catch(() => {});
              router.push("/platform/login");
            }}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-white/60 hover:bg-white/10"
          >
            ออก
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
