import { NextRequest, NextResponse } from "next/server";
import { getBooking, setBookingGroomInfo } from "@/lib/bookings-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

const TEMPERAMENT_LABELS: Record<string, string> = {
  gentle: "ใจดี ให้จับง่าย",
  fearful: "ขี้กลัว/ตกใจง่าย",
  aggressive: "ดุ/กัด/ข่วน",
};
const HEALTH_LABELS: Record<string, string> = {
  healthy: "แข็งแรงดี",
  heart: "โรคหัวใจ",
  skin: "โรคผิวหนัง",
  seizure: "ลมชัก/ชัก",
  senior: "สูงอายุ",
  other: "อื่นๆ",
};

/** ดึงข้อมูลนัดอาบน้ำ + ประวัติที่กรอกไว้ (ถ้ามี) */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const b = await getBooking(id);
  if (!b) return NextResponse.json({ found: false });
  let info: unknown = null;
  if (b.groomHealthInfo) {
    try {
      info = JSON.parse(b.groomHealthInfo);
    } catch {
      info = null;
    }
  }
  return NextResponse.json({
    found: true,
    booking: {
      id: b.id,
      catName: b.catName,
      service: b.service,
      date: b.date,
      time: b.time,
    },
    info,
  });
}

/** ลูกค้ากรอกประวัติน้องก่อนอาบน้ำ */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();
  const info = body.info || {};
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }

  const payload = {
    bathedBefore: info.bathedBefore === "yes" ? "yes" : info.bathedBefore === "no" ? "no" : "",
    temperament: Array.isArray(info.temperament) ? info.temperament : [],
    health: Array.isArray(info.health) ? info.health : [],
    allergy: String(info.allergy || "").trim(),
    note: String(info.note || "").trim(),
    submittedAt: new Date().toISOString(),
  };

  const res = await setBookingGroomInfo(
    bookingId,
    JSON.stringify(payload),
    lineUserId || undefined
  );
  if (!res.ok && res.error === "not_found") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!res.ok && res.error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const b = res.booking;
  if (b) {
    await sendTelegram(
      formatBookingTelegram("🩺 ประวัติน้องก่อนอาบน้ำ", {
        น้องแมว: b.catName,
        ลูกค้า: b.customerName,
        เคยอาบที่ร้าน:
          payload.bathedBefore === "yes" ? "เคย" : payload.bathedBefore === "no" ? "ไม่เคย" : "-",
        นิสัย:
          payload.temperament.map((t: string) => TEMPERAMENT_LABELS[t] || t).join(", ") ||
          "-",
        สุขภาพ:
          payload.health.map((h: string) => HEALTH_LABELS[h] || h).join(", ") || "-",
        แพ้: payload.allergy || "-",
        เพิ่มเติม: payload.note || "-",
      })
    );
  }

  return NextResponse.json({ ok: res.ok, needSql: !res.ok && res.error === "need_sql" });
}
