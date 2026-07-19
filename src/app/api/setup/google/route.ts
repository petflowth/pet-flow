import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import {
  getGoogleCredentials,
  getGoogleIds,
  isGoogleConfigured,
  parseCalendarId,
  parseServiceAccountJson,
  parseSpreadsheetId,
  testGoogleConnection,
} from "@/lib/google-config";
import { getSecrets, saveGoogleSecrets } from "@/lib/secrets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// สิทธิ์ถูกตรวจที่ middleware ด้วยคุกกี้ที่เซ็นชื่อแล้ว — ตรวจซ้ำที่นี่กันพลาด
// (ของเดิมเทียบกับ NEXT_PUBLIC_ADMIN_CODE ซึ่งถูกฝังไปในไฟล์ JS ฝั่งเบราว์เซอร์)
async function checkAdmin(req: NextRequest) {
  return !!(await getSessionFrom(req));
}

export async function GET() {
  const configured = await isGoogleConfigured();
  const ids = await getGoogleIds();
  const secrets = await getSecrets();
  const hasDb = Boolean(secrets.google?.serviceAccountEmail);

  let test = null;
  if (configured) {
    const creds = await getGoogleCredentials();
    if (creds) test = await testGoogleConnection(creds);
  }

  return NextResponse.json({
    configured,
    source: ids.source || (hasDb ? "database" : "none"),
    serviceAccountEmail: ids.serviceAccountEmail,
    calendarId: ids.calendarId,
    spreadsheetId: ids.spreadsheetId,
    test,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!(await checkAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { serviceAccountEmail, privateKey } = parseServiceAccountJson(
      String(body.jsonText || "")
    );
    const spreadsheetId = parseSpreadsheetId(String(body.spreadsheetUrl || ""));
    const calendarId = parseCalendarId(String(body.calendarUrl || ""));

    if (!spreadsheetId || !calendarId) {
      return NextResponse.json(
        { ok: false, message: "วางลิงก์ Google Sheet และ Calendar ให้ครบ" },
        { status: 400 }
      );
    }

    const creds = {
      serviceAccountEmail,
      privateKey,
      calendarId,
      spreadsheetId,
      source: "database" as const,
    };

    const test = await testGoogleConnection(creds);
    if (!test.ok) {
      return NextResponse.json({
        ok: false,
        test,
        message: test.messages.join("\n"),
      });
    }

    await saveGoogleSecrets({
      serviceAccountEmail,
      privateKey,
      calendarId,
      spreadsheetId,
    });

    return NextResponse.json({
      ok: true,
      test,
      message: "✅ บันทึก Google สำเร็จ — Calendar + Sheets พร้อมใช้งาน",
      serviceAccountEmail,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 400 }
    );
  }
}
