import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import {
  getGoogleCredentials,
  getGoogleIds,
  getPlatformRobot,
  isGoogleConfigured,
  parseCalendarId,
  parseServiceAccountJson,
  parseSpreadsheetId,
  testGoogleConnection,
} from "@/lib/google-config";
import { getSecrets, saveGoogleSecrets } from "@/lib/secrets-store";
import { getSupabase } from "@/lib/supabase/server";
import { requireTenantId } from "@/lib/tenant-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, handleGet);
}

async function handleGet() {
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
    // อีเมลกลางที่ร้านต้องกดแชร์ชีต/ปฏิทินให้ (ไม่ใช่ความลับ)
    robotEmail: getPlatformRobot()?.email || null,
    calendarId: ids.calendarId,
    spreadsheetId: ids.spreadsheetId,
    test,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const jsonText = String(body.jsonText || "").trim();
    const robot = getPlatformRobot();
    let serviceAccountEmail: string;
    let privateKey: string;
    let source: "database" | "platform";
    if (jsonText) {
      ({ serviceAccountEmail, privateKey } = parseServiceAccountJson(jsonText));
      source = "database";
    } else if (robot) {
      serviceAccountEmail = robot.email;
      privateKey = robot.privateKey;
      source = "platform";
    } else {
      return NextResponse.json(
        { ok: false, message: "ระบบยังไม่มีอีเมลกลาง — วางไฟล์ JSON จาก Google Cloud ในช่องขั้นสูง" },
        { status: 400 }
      );
    }
    const spreadsheetId = parseSpreadsheetId(String(body.spreadsheetUrl || ""));
    const calendarId = parseCalendarId(String(body.calendarUrl || ""));

    if (!spreadsheetId || !calendarId) {
      return NextResponse.json(
        { ok: false, message: "วางลิงก์ Google Sheet และ Calendar ให้ครบ" },
        { status: 400 }
      );
    }

    // ใช้อีเมลกลางร่วมกันทุกร้าน → กันร้านหนึ่งวางลิงก์ชีต/ปฏิทินที่ร้านอื่นใช้อยู่แล้ว
    const takenBy = await usedByOtherShop(spreadsheetId, calendarId);
    if (takenBy) {
      return NextResponse.json(
        {
          ok: false,
          message: `${takenBy === "sheet" ? "Google Sheet" : "ปฏิทิน"} นี้ถูกร้านอื่นใช้อยู่แล้ว — สร้างอันใหม่ของร้านเอง`,
        },
        { status: 400 }
      );
    }

    const creds = {
      serviceAccountEmail,
      privateKey,
      calendarId,
      spreadsheetId,
      source,
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
      // แบบอีเมลกลาง ไม่เก็บคีย์ต่อร้าน — อ่านจาก env ทุกครั้ง (เปลี่ยนคีย์ที่เดียวได้)
      privateKey: source === "platform" ? "" : privateKey,
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

async function usedByOtherShop(
  spreadsheetId: string,
  calendarId: string
): Promise<"sheet" | "calendar" | null> {
  const tenantId = requireTenantId();
  const envSheet = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  const envCal = process.env.GOOGLE_CALENDAR_ID?.trim();
  const isEnvOwner = (await getGoogleIds()).source === "env";
  if (!isEnvOwner) {
    if (envSheet && envSheet === spreadsheetId) return "sheet";
    if (envCal && envCal === calendarId) return "calendar";
  }
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("site_config")
    .select("id, data")
    .like("id", "secrets:%")
    .neq("id", `secrets:${tenantId}`);
  for (const row of data || []) {
    const g = (row.data as { google?: { spreadsheetId?: string; calendarId?: string } })?.google;
    if (g?.spreadsheetId === spreadsheetId) return "sheet";
    if (g?.calendarId === calendarId) return "calendar";
  }
  return null;
}
