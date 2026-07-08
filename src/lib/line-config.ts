import { getSecrets } from "./secrets-store";

export type LineCredentials = {
  channelToken: string;
  liffId?: string;
  source: "env" | "database";
};

export function parseLineChannelToken(raw: string) {
  const token = raw.trim();
  if (token.length < 20) {
    throw new Error(
      "Channel Access Token สั้นเกินไป — copy จาก LINE Developers → Messaging API"
    );
  }
  return token;
}

export async function getLineCredentials(): Promise<LineCredentials | null> {
  const secrets = await getSecrets();
  const line = secrets.line;

  if (line?.channelToken) {
    return {
      channelToken: line.channelToken,
      liffId: line.liffId || process.env.NEXT_PUBLIC_LIFF_ID,
      source: "database",
    };
  }

  const envToken = process.env.LINE_CHANNEL_TOKEN?.trim();
  if (envToken) {
    return {
      channelToken: envToken,
      liffId: process.env.NEXT_PUBLIC_LIFF_ID,
      source: "env",
    };
  }

  return null;
}

export async function isLineConfigured() {
  return Boolean((await getLineCredentials())?.channelToken);
}

export async function testLineChannelToken(token: string) {
  const res = await fetch("https://api.line.me/v2/bot/info", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as {
    message?: string;
    displayName?: string;
    basicId?: string;
  };

  if (!res.ok) {
    const hint =
      data.message === "Authentication failed" || res.status === 401
        ? "Token ผิดหรือหมดอายุ — ออก Token ใหม่ใน LINE Developers"
        : data.message || `LINE API HTTP ${res.status}`;
    return { ok: false as const, message: hint };
  }

  return {
    ok: true as const,
    displayName: data.displayName,
    basicId: data.basicId,
  };
}

export function getAppUrlFromEnv() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  );
}

export function bookingConfirmUrl(bookingId: string, liffId?: string) {
  const lid = liffId || process.env.NEXT_PUBLIC_LIFF_ID;
  const base =
    getAppUrlFromEnv() || "https://catcha-hotel-five.vercel.app";
  if (lid) {
    return `https://liff.line.me/${lid}?path=bookings&id=${bookingId}`;
  }
  return `${base}/app/bookings?id=${bookingId}`;
}
