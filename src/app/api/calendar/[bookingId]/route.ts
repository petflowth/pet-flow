import { NextRequest, NextResponse } from "next/server";
import { getBooking } from "@/lib/bookings-store";
import { buildIcsContent } from "@/lib/calendar";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const b = await getBooking(bookingId);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ics = buildIcsContent({
    uid: b.calendarEventId || b.id,
    summary: `🐱 ${b.catName} (${b.customerName}) — CatCha Hotel`,
    description: `${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · ${b.notes || ""}`,
    start: b.date || b.checkin || "",
    end: b.checkout || b.date || b.checkin || "",
    time: b.time,
    allDay: b.service === "room",
  });

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="catcha-${bookingId}.ics"`,
    },
  });
}
