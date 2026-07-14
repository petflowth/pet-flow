import { NextResponse } from "next/server";
import { getAppUrlFromEnv, getLineCredentials, isLiffConfigured } from "@/lib/line-config";

/** ค่า LIFF สาธารณะ — ใช้ init แอปลูกค้า (ไม่มี secret) */
export async function GET() {
  const creds = await getLineCredentials();
  const liffId = creds?.liffId || "";
  const appUrl = getAppUrlFromEnv() || "https://catchahotel.com";

  return NextResponse.json({
    liffId,
    configured: await isLiffConfigured(),
    endpointUrl: `${appUrl}/app`,
    testUrl: liffId ? `https://liff.line.me/${liffId}` : null,
  });
}
