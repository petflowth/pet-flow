import { NextRequest, NextResponse } from "next/server";
import { withResolvedTenant } from "@/lib/tenant-context";
import { addBooking } from "@/lib/bookings-store";
import { findCustomerByLine } from "@/lib/customers-store";
import { getGroomAvailability, getRoomAvailability } from "@/lib/availability";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * ลูกค้าจองคิว/ห้องพักเอง — ไม่ต้องคุยกับพนักงาน
 * สร้างเป็นสถานะ "pending" เสมอ (addBooking ตั้งให้อยู่แล้ว) — พนักงานกดยืนยันอีกทีในหลังบ้าน
 * เช็คความว่างซ้ำที่นี่ก่อนบันทึกจริง กันเคสสองคนจองพร้อมกันแล้วเห็นเลขว่างเก่า
 */
export async function POST(req: NextRequest) {
  return withResolvedTenant(req, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lineUserId = String(body.lineUserId || "").trim();
  const catName = String(body.catName || "").trim();
  const service = body.service === "room" ? "room" : body.service === "groom" ? "groom" : null;

  if (!lineUserId || !catName || !service) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const customer = await findCustomerByLine(lineUserId);
  if (!customer) return NextResponse.json({ error: "customer_not_found" }, { status: 404 });
  if (!customer.cats.some((c) => c.name === catName)) {
    return NextResponse.json({ error: "cat_not_found" }, { status: 404 });
  }

  if (service === "groom") {
    const date = String(body.date || "").trim();
    const time = String(body.time || "").trim();
    if (!date || !time) {
      return NextResponse.json({ error: "date and time required" }, { status: 400 });
    }
    const { closed, slots } = await getGroomAvailability(date);
    if (closed) {
      return NextResponse.json({ error: "shop_closed" }, { status: 409 });
    }
    const slot = slots.find((s) => s.time === time);
    if (!slot || slot.remaining <= 0) {
      return NextResponse.json({ error: "slot_full" }, { status: 409 });
    }
    const booking = await addBooking({
      customerName: customer.name,
      catName,
      service: "groom",
      date,
      time,
      lineUserId,
      selfBooked: true,
    });
    await sendTelegram(
      formatBookingTelegram("🐾 ลูกค้าจองคิวอาบน้ำเอง (รอยืนยัน)", {
        ลูกค้า: customer.name,
        น้อง: catName,
        วันที่: date,
        เวลา: time,
      })
    );
    return NextResponse.json({ ok: true, booking });
  }

  // service === "room"
  const checkin = String(body.checkin || "").trim();
  const checkout = String(body.checkout || "").trim();
  const room = String(body.room || "").trim();
  if (!checkin || !checkout || !room) {
    return NextResponse.json({ error: "checkin, checkout, room required" }, { status: 400 });
  }
  if (checkout <= checkin) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  const avail = await getRoomAvailability(room, checkin, checkout);
  if (!avail) return NextResponse.json({ error: "not_self_bookable" }, { status: 400 });
  if (avail.closed) {
    return NextResponse.json({ error: "shop_closed" }, { status: 409 });
  }
  if (avail.remaining <= 0) {
    return NextResponse.json({ error: "room_full" }, { status: 409 });
  }
  const booking = await addBooking({
    customerName: customer.name,
    catName,
    service: "room",
    date: checkin,
    checkin,
    checkout,
    room,
    lineUserId,
    selfBooked: true,
  });
  await sendTelegram(
    formatBookingTelegram("🏠 ลูกค้าจองห้องพักเอง (รอยืนยัน)", {
      ลูกค้า: customer.name,
      น้อง: catName,
      เข้าพัก: `${checkin} → ${checkout}`,
      ห้อง: room,
    })
  );
  return NextResponse.json({ ok: true, booking });
}
