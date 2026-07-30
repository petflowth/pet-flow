import { NextRequest, NextResponse } from "next/server";
import { listAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/** บันทึกว่าใครทำอะไร — หลังบ้านเท่านั้น (middleware กันไว้อีกชั้นแล้ว) */
export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 200;
  return NextResponse.json({ logs: await listAudit(limit) });
}
