"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { CustomerProfile } from "@/lib/business";

type LiffCtx = {
  ready: boolean;
  profile: CustomerProfile | null;
  error: string | null;
};

const LiffContext = createContext<LiffCtx>({
  ready: false,
  profile: null,
  error: null,
});

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiffCtx>({
    ready: false,
    profile: null,
    error: null,
  });

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      // โหมด dev ไม่มี LIFF
      setState({
        ready: true,
        profile: {
          lineUserId: "dev-user",
          displayName: "คุณทดสอบ",
          points: 42,
        },
        error: null,
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
          setState({
            ready: true,
            profile: {
              lineUserId: p.userId,
              displayName: p.displayName,
              pictureUrl: p.pictureUrl,
              points: 0,
            },
            error: null,
          });
        })
      )
      .catch((e) =>
        setState({ ready: true, profile: null, error: String(e) })
      );
  }, []);

  return (
    <LiffContext.Provider value={state}>{children}</LiffContext.Provider>
  );
}

export function useLiff() {
  return useContext(LiffContext);
}
