import { getSupabase } from "./supabase/server";

export type GoogleSecrets = {
  serviceAccountEmail: string;
  privateKey: string;
  calendarId: string;
  spreadsheetId: string;
  updatedAt: string;
};

export type TelegramSecrets = {
  botToken: string;
  ownerChatIds: string;
  appUrl: string;
  updatedAt: string;
};

export type LineSecrets = {
  channelToken: string;
  liffId?: string;
  updatedAt: string;
};

type SecretsPayload = {
  google?: GoogleSecrets;
  telegram?: TelegramSecrets;
  line?: LineSecrets;
};

const SECRETS_ID = "secrets";
let memSecrets: SecretsPayload = {};

async function persistSecrets(next: SecretsPayload) {
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
}

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
  const current = await getSecrets();
  const next: SecretsPayload = {
    ...current,
    google: { ...google, updatedAt: new Date().toISOString() },
  };
  await persistSecrets(next);
  return next.google!;
}

export async function saveTelegramSecrets(
  telegram: Omit<TelegramSecrets, "updatedAt">
) {
  const current = await getSecrets();
  const next: SecretsPayload = {
    ...current,
    telegram: { ...telegram, updatedAt: new Date().toISOString() },
  };
  await persistSecrets(next);
  return next.telegram!;
}

export async function saveLineSecrets(line: Omit<LineSecrets, "updatedAt">) {
  const current = await getSecrets();
  const next: SecretsPayload = {
    ...current,
    line: { ...line, updatedAt: new Date().toISOString() },
  };
  await persistSecrets(next);
  return next.line!;
}

export async function clearGoogleSecrets() {
  const current = await getSecrets();
  const next = { ...current };
  delete next.google;
  await persistSecrets(next);
}
