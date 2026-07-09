"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CustomerProfile } from "@/lib/business";
import type { PointsHistoryEntry } from "@/lib/points-store";
import type { CustomerTier } from "@/lib/customer-tier";

type LineCustomer = {
  id: string;
  name: string;
  phone?: string;
  cats: { id: string; name: string }[];
  tier: CustomerTier;
};

type LiffCtx = {
  ready: boolean;
  profile: CustomerProfile | null;
  customer: LineCustomer | null;
  needsRegistration: boolean;
  history: PointsHistoryEntry[];
  error: string | null;
  refreshAccount: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
  setPoints: (points: number) => void;
};

const LiffContext = createContext<LiffCtx>({
  ready: false,
  profile: null,
  customer: null,
  needsRegistration: false,
  history: [],
  error: null,
  refreshAccount: async () => {},
  refreshCustomer: async () => {},
  setPoints: () => {},
});

async function fetchAccount(lineUserId: string, displayName: string) {
  const q = new URLSearchParams({ lineUserId, displayName });
  const res = await fetch(`/api/points?${q}`);
  if (!res.ok) return null;
  return res.json() as Promise<{
    points: number;
    history: PointsHistoryEntry[];
  }>;
}

async function syncLineCustomer(lineUserId: string, displayName: string) {
  const res = await fetch("/api/customers/line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lineUserId, displayName }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    customer: LineCustomer;
    needsRegistration: boolean;
  }>;
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [customer, setCustomer] = useState<LineCustomer | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshCustomer = useCallback(async () => {
    if (!profile?.lineUserId) return;
    const sync = await syncLineCustomer(profile.lineUserId, profile.displayName);
    if (sync) {
      setCustomer(sync.customer);
      setNeedsRegistration(sync.needsRegistration);
    }
  }, [profile?.lineUserId, profile?.displayName]);

  const refreshAccount = useCallback(async () => {
    if (!profile?.lineUserId) return;
    const data = await fetchAccount(profile.lineUserId, profile.displayName);
    if (!data) return;
    setProfile((p) => (p ? { ...p, points: data.points } : p));
    setHistory(data.history);
  }, [profile?.lineUserId, profile?.displayName]);

  const setPoints = useCallback((points: number) => {
    setProfile((p) => (p ? { ...p, points } : p));
  }, []);

  useEffect(() => {
    async function initLiff() {
      async function applyAccount(base: CustomerProfile) {
        // ยิงพร้อมกัน (ไม่เกี่ยวกัน) — เปิดแอปเร็วขึ้น ไม่ต้องรอทีละอัน
        const [sync, data] = await Promise.all([
          syncLineCustomer(base.lineUserId, base.displayName),
          fetchAccount(base.lineUserId, base.displayName),
        ]);
        if (sync) {
          setCustomer(sync.customer);
          setNeedsRegistration(sync.needsRegistration);
        }
        if (data) {
          setProfile({ ...base, points: data.points });
          setHistory(data.history);
        } else {
          setProfile(base);
        }
        setReady(true);
      }

      let liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "";
      if (!liffId) {
        try {
          const res = await fetch("/api/line/liff");
          const data = await res.json();
          liffId = data.liffId || "";
        } catch {
          /* fallback dev */
        }
      }

      if (!liffId) {
        await applyAccount({
          lineUserId: "dev-user",
          displayName: "คุณทดสอบ",
          points: 0,
        });
        return;
      }

      import("@line/liff")
        .then((liff) =>
          liff.default.init({ liffId }).then(async () => {
            if (!liff.default.isLoggedIn()) {
              liff.default.login();
              return;
            }
            const p = await liff.default.getProfile();
            await applyAccount({
              lineUserId: p.userId,
              displayName: p.displayName,
              pictureUrl: p.pictureUrl,
              points: 0,
            });
          })
        )
        .catch((e) => {
          setError(String(e));
          setReady(true);
        });
    }

    initLiff();
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const path = params.get("path");
    const bookingId = params.get("id");

    if (path === "bookings") {
      router.replace(
        bookingId ? `/app/bookings?id=${bookingId}` : "/app/bookings"
      );
      return;
    }
    if (path === "promos") {
      router.replace("/app/promos");
      return;
    }
    if (path === "grooming") {
      router.replace("/app/grooming");
      return;
    }
    if (path === "rooms") {
      router.replace("/app/rooms");
      return;
    }
    if (path === "register") {
      router.replace("/app/register");
      return;
    }
    if (path === "link") {
      const customerId = params.get("customerId");
      router.replace(
        customerId
          ? `/app/link?customerId=${encodeURIComponent(customerId)}`
          : "/app"
      );
      return;
    }

    const skipRegister =
      pathname.startsWith("/app/register") ||
      pathname.startsWith("/app/link") ||
      pathname.startsWith("/app/bookings") ||
      pathname.startsWith("/app/pay") ||
      pathname.startsWith("/app/promos") ||
      pathname.startsWith("/app/grooming") ||
      pathname.startsWith("/app/rooms");

    if (needsRegistration && !skipRegister) {
      router.replace("/app/register");
    }
  }, [ready, needsRegistration, pathname, router]);

  return (
    <LiffContext.Provider
      value={{
        ready,
        profile,
        customer,
        needsRegistration,
        history,
        error,
        refreshAccount,
        refreshCustomer,
        setPoints,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

export function useLiff() {
  return useContext(LiffContext);
}
