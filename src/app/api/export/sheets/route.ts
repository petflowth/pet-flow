import { NextRequest, NextResponse } from "next/server";
import { exportToGoogleSheets } from "@/lib/google-sheets-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const adminCode = process.env.NEXT_PUBLIC_ADMIN_CODE;
  if (adminCode && body.adminCode !== adminCode) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await exportToGoogleSheets();

  if (!result.ok) {
    const messages: Record<string, string> = {
      google_not_configured:
        "ยังไม่ได้ใส่ GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY ใน Vercel",
      spreadsheet_not_configured:
        "ยังไม่ได้ใส่ GOOGLE_SPREADSHEET_ID ใน Vercel",
    };
    return NextResponse.json(
      {
        ...result,
        message: messages[result.reason || ""] || result.reason,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ...result,
    message: `ส่งออกแล้ว — ลูกค้า ${result.customers} ราย, การเงิน ${result.finance} รายการ`,
  });
}
