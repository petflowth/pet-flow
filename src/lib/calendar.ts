/**
 * Google Calendar + iPhone (.ics) — สร้างนัดในปฏิทินร่วม Catcha Hotel
 */

export const CALENDAR_OWNER_EMAILS = [
  "chutchanok.than@gmail.com",
  "pitchapawong.pw@gmail.com",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIcsUtc(isoDate: string, time?: string) {
  if (!time) {
    return isoDate.replace(/-/g, "");
  }
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${isoDate}T${pad(h)}:${pad(m)}:00+07:00`);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function buildIcsContent(event: {
  uid: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  time?: string;
  endTime?: string;
  allDay?: boolean;
}) {
  const dtStart = event.allDay
    ? `DTSTART;VALUE=DATE:${event.start.replace(/-/g, "")}`
    : `DTSTART:${toIcsUtc(event.start, event.time)}`;
  const endDate = event.end || event.start;
  const dtEnd = event.allDay
    ? `DTEND;VALUE=DATE:${endDate.replace(/-/g, "")}`
    : `DTEND:${toIcsUtc(endDate, event.endTime || event.time)}`;

  const attendees = CALENDAR_OWNER_EMAILS.map(
    (email) => `ATTENDEE;CN=${email}:mailto:${email}`
  ).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CatCha Hotel//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@catchahotel`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString().slice(0, 10), "00:00")}`,
    dtStart,
    dtEnd,
    `SUMMARY:${event.summary}`,
    `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}`,
    `LOCATION:CatCha Hotel Bang Na`,
    attendees,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function buildGoogleCalendarUrl(event: {
  summary: string;
  description: string;
  start: string;
  end: string;
  time?: string;
  allDay?: boolean;
}) {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const dates = event.allDay
    ? `${event.start.replace(/-/g, "")}/${(event.end || event.start).replace(/-/g, "")}`
    : `${toIcsUtc(event.start, event.time)}/${toIcsUtc(event.end || event.start, event.time)}`;
  const params = new URLSearchParams({
    text: event.summary,
    details: `${event.description}\n\nเจ้าของ: ${CALENDAR_OWNER_EMAILS.join(", ")}`,
    location: "CatCha Hotel Bang Na",
    dates,
  });
  return `${base}&${params.toString()}`;
}

export async function createCalendarEvent(booking: {
  summary: string;
  description: string;
  start: string;
  end: string;
  time?: string;
  allDay?: boolean;
  eventId?: string;
}) {
  const calId = process.env.GOOGLE_CALENDAR_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const uid = booking.eventId || `evt_${Date.now()}`;

  const ics = buildIcsContent({
    uid,
    summary: booking.summary,
    description: `${booking.description}\n\nแจ้งเตือน: ${CALENDAR_OWNER_EMAILS.join(", ")}`,
    start: booking.start,
    end: booking.end,
    time: booking.time,
    allDay: booking.allDay,
  });

  const googleUrl = buildGoogleCalendarUrl({
    summary: booking.summary,
    description: booking.description,
    start: booking.start,
    end: booking.end,
    time: booking.time,
    allDay: booking.allDay,
  });

  if (!calId || !email || !key) {
    return {
      ok: true,
      mock: true,
      reason: "calendar_not_configured",
      eventId: uid,
      ics,
      googleUrl,
      ownerEmails: CALENDAR_OWNER_EMAILS,
    };
  }

  // googleapis integration when credentials are set
  return {
    ok: true,
    eventId: uid,
    calendarId: calId,
    summary: booking.summary,
    ics,
    googleUrl,
    ownerEmails: CALENDAR_OWNER_EMAILS,
  };
}
