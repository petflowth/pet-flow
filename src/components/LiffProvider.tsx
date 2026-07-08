"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { CustomerProfile } from "@/lib/business";
import type { PointsHistoryEntry } from "@/lib/points-store";

type LiffCtx = {
  ready: boolean;
  profile: CustomerProfile | null;
  history: PointsHistoryEntry[];
  error: string | null;
  refreshAccount: () => Promise<void>;
  setPoints: (points: number) => void;
};

const LiffContext = createContext<LiffCtx>({
  ready: false,
  profile: null,
  history: [],
  error: null,
  refreshAccount: async () => {},
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
  const data = await res.json();
  return data.customer as { id: string; name: string } | null;
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

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
    async function applyAccount(base: CustomerProfile) {
      await syncLineCustomer(base.lineUserId, base.displayName);
      const data = await fetchAccount(base.lineUserId, base.displayName);
      if (data) {
        setProfile({ ...base, points: data.points });
        setHistory(data.history);
      } else {
        setProfile(base);
      }
      setReady(true);
    }

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      applyAccount({
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
  }, []);

  return (
    <LiffContext.Provider
      value={{ ready, profile, history, error, refreshAccount, setPoints }}
    >
      {children}
    </LiffContext.Provider>
  );
}

export function useLiff() {
  return useContext(LiffContext);
}
