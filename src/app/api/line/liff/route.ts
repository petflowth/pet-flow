import { NextRequest, NextResponse } from "next/server";
import { withResolvedTenant } from "@/lib/tenant-context";
import { getAppUrlFromEnv, getLineCredentials, isLiffConfigured } from "@/lib/line-config";

// สำคัญมาก — ทุกลูกค้าที่เปิดแอปเรียก route นี้เพื่อรู้ liffId ก่อน init LIFF
// ถ้าไม่บังคับ dynamic, Next/Vercel จะ cache ผลตอนยังไม่ตั้ง LIFF ค้างไว้ถาวร แล้วลูกค้า
// ทุกคนจะตกไปโหมด "dev-user" ปลอมตลอดกาล แม้ร้านตั้ง LIFF ID เสร็จแล้วก็ตาม (บั๊กจริงที่เจอ 2026-07-20)
export const dynamic = "force-dynamic";

/** ค่า LIFF สาธารณะ — ใช้ init แอปลูกค้า (ไม่มี secret)
 * no-store กันเบราว์เซอร์ในแอป LINE (webview) แคช response เก่าไว้เอง —
 * server ฝั่งนี้ dynamic อยู่แล้ว แต่ฝั่ง client ก็ต้องห้ามแคชด้วยเช่นกัน */
async function getHandler() {
  const creds = await getLineCredentials();
  const liffId = creds?.liffId || "";
  const appUrl = getAppUrlFromEnv() || "https://petflow.example.com";

  return NextResponse.json(
    {
      liffId,
      configured: await isLiffConfigured(),
      endpointUrl: `${appUrl}/app`,
      testUrl: liffId ? `https://liff.line.me/${liffId}` : null,
    },
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}

// R1/R3: resolve ร้านจาก request ก่อนอ่าน LINE creds ต่อร้าน
export function GET(req: NextRequest) { return withResolvedTenant(req, () => getHandler()); }
