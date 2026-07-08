import { getSupabase } from "./supabase/server";

export type GoogleSecrets = {
  serviceAccountEmail: string;
  privateKey: string;
  calendarId: string;
  spreadsheetId: string;
  updatedAt: string;
};

type SecretsPayload = {
  google?: GoogleSecrets;
};

const SECRETS_ID = "secrets";
let memSecrets: SecretsPayload = {};

export async function getSecrets(): Promise<SecretsPayload> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("site_config")
      .select("data")
      .eq("id", SECRETS_ID)
      .maybeSingle();
    if (data?.data) return data.data as SecretsPayload;
  }
  return memSecrets;
}

export async function saveGoogleSecrets(google: Omit<GoogleSecrets, "updatedAt">) {
  const next: SecretsPayload = {
    google: { ...google, updatedAt: new Date().toISOString() },
  };
  const sb = getSupabase();
  if (sb) {
    await sb.from("site_config").upsert({
      id: SECRETS_ID,
      data: next,
      updated_at: new Date().toISOString(),
    });
  } else {
    memSecrets = next;
  }
  return next.google!;
}

export async function clearGoogleSecrets() {
  const sb = getSupabase();
  if (sb) {
    await sb.from("site_config").delete().eq("id", SECRETS_ID);
  }
  memSecrets = {};
}
