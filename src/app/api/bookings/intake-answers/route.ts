import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getBooking } from "@/lib/bookings-store";
import { bookingIntakeAnswers } from "@/lib/intake-answers";

export const dynamic = "force-dynamic";

/**
 * หลังร้าน: คำตอบทุกข้อที่ลูกค้ากรอกไว้ของนัดนี้ (ก่อนอาบน้ำ / ก่อนเข้าพัก) — โชว์ในการ์ดนัด
 * ข้อมูลสุขภาพน้อง จึงเปิดเฉพาะคนที่ล็อกอินหลังร้าน (path นี้อยู่ใต้ /api/bookings ที่ middleware ปล่อยผ่าน)
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ids = (req.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });
  return withTenant(session.tenantId, async () => {
    const items = [];
    for (const id of ids) {
      const b = await getBooking(id);
      if (!b) continue;
      items.push({ bookingId: b.id, ...(await bookingIntakeAnswers(b)) });
    }
    return NextResponse.json({ items });
  });
}
