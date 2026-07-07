/**
 * Google Calendar — สร้างนัดในปฏิทินร่วม Catcha Hotel
 *
 * ตั้งค่า (Service Account):
 * GOOGLE_CALENDAR_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
 */

export async function createCalendarEvent(booking: {
  summary: string;
  description: string;
  start: string;
  end: string;
  allDay?: boolean;
}) {
  const calId = process.env.GOOGLE_CALENDAR_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!calId || !email || !key) {
    return { ok: false, reason: "calendar_not_configured", mock: true };
  }

  // JWT + Calendar API v3 — ใช้ googleapis ตอนติดตั้ง credentials จริง
  // ตอนนี้คืน placeholder ให้ flow ทำงานก่อน
  void booking;
  return {
    ok: true,
    eventId: `evt_${Date.now()}`,
    calendarId: calId,
    summary: booking.summary,
  };
}

export const CALENDAR_OWNER_EMAILS = [
  "Chutchanok.than@gmail.com",
  "pitchapawong.pw@gmail.com",
];
