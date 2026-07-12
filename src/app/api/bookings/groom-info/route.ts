import { NextRequest, NextResponse } from "next/server";
import { getBooking } from "@/lib/bookings-store";
import { getCatGroomInfo, setCatGroomInfo } from "@/lib/customers-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { parseGroomInfo, groomInfoSummary } from "@/lib/groom-info";

/** ดึงข้อมูลนัดอาบน้ำ + ประวัติที่เคยกรอกไว้ (เก็บถาวรที่แมว) */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const b = await getBooking(id);
  if (!b) return NextResponse.json({ found: false });
  const stored = b.lineUserId
    ? await getCatGroomInfo(b.lineUserId, b.catName)
    : undefined;
  return NextResponse.json({
    found: true,
    booking: { id: b.id, catName: b.catName, service: b.service, date: b.date, time: b.time },
    info: parseGroomInfo(stored),
  });
}

/** ลูกค้ากรอกประวัติน้องก่อนอาบน้ำ — บันทึกถาวรที่แมว */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId || "").trim();
  const info = body.info || {};
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }
  const b = await getBooking(bookingId);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });

  const lineUserId = String(body.lineUserId || b.lineUserId || "").trim();
  if (!lineUserId) {
    return NextResponse.json({ error: "no_line" }, { status: 400 });
  }

  const payload = {
    bathedBefore:
      info.bathedBefore === "yes" ? "yes" : info.bathedBefore === "no" ? "no" : "",
    temperament: Array.isArray(info.temperament) ? info.temperament : [],
    health: Array.isArray(info.health) ? info.health : [],
    allergy: String(info.allergy || "").trim(),
    note: String(info.note || "").trim(),
    submittedAt: new Date().toISOString(),
  };

  const res = await setCatGroomInfo(lineUserId, b.catName, JSON.stringify(payload));
  if (!res.ok && res.error === "not_found") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await sendTelegram(
    formatBookingTelegram("🩺 ประวัติน้องก่อนอาบน้ำ (ลูกค้ากรอก)", {
      น้องแมว: b.catName,
      ลูกค้า: b.customerName,
      ...groomInfoSummary(payload),
    })
  );

  return NextResponse.json({ ok: res.ok, needSql: !res.ok && res.error === "need_sql" });
}
