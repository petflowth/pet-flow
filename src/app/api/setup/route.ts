import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import {
  bootstrapDatabase,
  checkSetupStatus,
  getSchemaSqlForCopy,
} from "@/lib/supabase/bootstrap";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  try {
    if (action === "schema") {
      return new NextResponse(getSchemaSqlForCopy(), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const status = await checkSetupStatus();
    return NextResponse.json({ status });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), message: "ตรวจสอบ env แล้วลองใหม่" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.SETUP_SECRET || process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  // เรียกจากสคริปต์ภายนอกด้วย Bearer หรือจากหลังบ้านที่ล็อกอินแล้ว
  if (secret && auth !== `Bearer ${secret}` && !(await getSessionFrom(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await bootstrapDatabase();
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const status = await checkSetupStatus();
  return NextResponse.json({ ...result, status });
}
