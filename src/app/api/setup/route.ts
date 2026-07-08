import { NextRequest, NextResponse } from "next/server";
import {
  bootstrapDatabase,
  checkSetupStatus,
  getSchemaSqlForCopy,
} from "@/lib/supabase/bootstrap";

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");

  if (action === "schema") {
    return new NextResponse(getSchemaSqlForCopy(), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const status = await checkSetupStatus();
  return NextResponse.json({ status });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const secret = process.env.SETUP_SECRET || process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}` && body.adminCode !== process.env.NEXT_PUBLIC_ADMIN_CODE) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await bootstrapDatabase();
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  const status = await checkSetupStatus();
  return NextResponse.json({ ...result, status });
}
