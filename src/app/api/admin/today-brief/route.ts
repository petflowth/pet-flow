import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { bangkokToday } from "@/lib/bangkok-date";
import { withTenant } from "@/lib/tenant-context";
import { buildTodayBrief } from "@/lib/today-brief";

export const dynamic = "force-dynamic";

/**
 * หน้าแรกหลังร้าน › ลูกค้าวันนี้ — ต้องระวัง / ต้องทำ / การดูแล ของแต่ละบ้าน
 * มีข้อมูลสุขภาพน้อง จึงต้องล็อกอินหลังร้าน และอ่านเฉพาะร้านของตัวเอง
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams.get("date") || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : bangkokToday();
  return withTenant(session.tenantId, async () => {
    const items = await buildTodayBrief(date);
    return NextResponse.json({ date, items });
  });
}
