import { NextRequest, NextResponse } from "next/server";
import { withResolvedTenant } from "@/lib/tenant-context";
import { getAppUrlFromEnv, getLineCredentials, isLiffConfigured } from "@/lib/line-config";

/** ค่า LIFF สาธารณะ — ใช้ init แอปลูกค้า (ไม่มี secret) */
async function getHandler() {
  const creds = await getLineCredentials();
  const liffId = creds?.liffId || "";
  const appUrl = getAppUrlFromEnv() || "https://petflow.example.com";

  return NextResponse.json({
    liffId,
    configured: await isLiffConfigured(),
    endpointUrl: `${appUrl}/app`,
    testUrl: liffId ? `https://liff.line.me/${liffId}` : null,
  });
}

// R1/R3: resolve ร้านจาก request ก่อนอ่าน LINE creds ต่อร้าน
export function GET(req: NextRequest) { return withResolvedTenant(req, () => getHandler()); }
