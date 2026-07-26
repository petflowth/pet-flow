import { NextRequest, NextResponse } from "next/server";
import { withResolvedTenant } from "@/lib/tenant-context";
import { getBooking } from "@/lib/bookings-store";
import { getCatGroomInfo, setCatGroomInfo } from "@/lib/customers-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { parseGroomInfo, groomInfoSummary } from "@/lib/groom-info";
import { getSiteConfig } from "@/lib/config-store";
import { resolveGroomForm } from "@/lib/groom-form";
import { requireCustomerSession } from "@/lib/customer-session";

/**
 * ดึงข้อมูลนัดอาบน้ำ + ประวัติที่เคยกรอกไว้ (เก็บถาวรที่แมว) — มีข้อมูลสุขภาพน้อง
 * ต้องเป็นเจ้าของนัดจริง (ตรวจจากคุกกี้เซสชัน) ไม่ใช่แค่รู้ bookingId
 */
async function getHandler(req: NextRequest) {
  const session = await requireCustomerSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const b = await getBooking(id);
  if (!b) return NextResponse.json({ found: false });
  if (b.lineUserId && b.lineUserId !== session.lineUserId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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
async function postHandler(req: NextRequest) {
  const session = await requireCustomerSession(req);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const bookingId = String(body.bookingId || "").trim();
  const info = body.info || {};
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId required" }, { status: 400 });
  }
  const b = await getBooking(bookingId);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (b.lineUserId && b.lineUserId !== session.lineUserId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const lineUserId = session.lineUserId;

  // เก็บตามคำถามที่ร้านตั้งไว้จริง (ร้านเพิ่ม/แก้ตัวเลือกเองได้) — sanitize ตามชนิดของคำถาม
  const cfg = await getSiteConfig();
  const fields = resolveGroomForm(cfg.groomForm);
  const payload: Record<string, unknown> = { submittedAt: new Date().toISOString() };
  for (const f of fields) {
    const raw = (info as Record<string, unknown>)[f.key];
    if (f.type === "multi") {
      payload[f.key] = Array.isArray(raw)
        ? raw.map((v) => String(v).slice(0, 120))
        : raw
          ? [String(raw).slice(0, 120)] // ข้อมูลเก่าที่เคยเก็บเป็น string เดี่ยว
          : [];
    } else {
      payload[f.key] = String(raw ?? "").trim().slice(0, 500);
    }
  }

  const res = await setCatGroomInfo(lineUserId, b.catName, JSON.stringify(payload));
  if (!res.ok && res.error === "not_found") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await sendTelegram(
    formatBookingTelegram("🩺 ประวัติน้องก่อนอาบน้ำ (ลูกค้ากรอก)", {
      น้องแมว: b.catName,
      ลูกค้า: b.customerName,
      ...groomInfoSummary(payload, fields),
    })
  );

  return NextResponse.json({ ok: res.ok, needSql: !res.ok && res.error === "need_sql" });
}

// R1/R3: resolve ร้านจาก request (header/cookie) ก่อนเข้า handler
export function GET(req: NextRequest) { return withResolvedTenant(req, () => getHandler(req)); }
export function POST(req: NextRequest) { return withResolvedTenant(req, () => postHandler(req)); }
