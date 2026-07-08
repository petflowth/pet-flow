import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** รองรับค่าที่ใส่แค่ project ref หรือลืม https:// */
export function normalizeSupabaseUrl(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return null;

  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    if (/^[a-z0-9-]+\.supabase\.co$/i.test(url)) {
      url = `https://${url}`;
    } else if (/^[a-z0-9-]{10,}$/i.test(url)) {
      url = `https://${url}.supabase.co`;
    } else {
      return null;
    }
  }

  try {
    return new URL(url).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function getSupabaseUrl() {
  return normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function getSupabase() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
