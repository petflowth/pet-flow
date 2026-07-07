"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { SiteConfig } from "@/lib/config-types";
import { getDefaultSiteConfig } from "@/lib/defaults/site-config";

type ConfigCtx = {
  config: SiteConfig;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ConfigContext = createContext<ConfigCtx>({
  config: getDefaultSiteConfig(),
  loading: true,
  refresh: async () => {},
});

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SiteConfig>(getDefaultSiteConfig());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.config) setConfig(data.config);
    } catch {
      /* ใช้ default */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ConfigContext.Provider value={{ config, loading, refresh }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  return useContext(ConfigContext);
}
