import type { Booking, BookingStatus } from "./business";
import { getSupabase } from "./supabase/server";

export type StoredBooking = Booking & {
  lineUserId?: string;
  room?: string;
  checkin?: string;
  notes?: string;
  createdAt: string;
  calendarEventId?: string;
};

type BookingRow = {
  id: string;
  customer_name: string;
  cat_name: string;
  service: string;
  date: string | null;
  time: string | null;
  checkout: string | null;
  checkin: string | null;
  room: string | null;
  line_user_id: string | null;
  notes: string | null;
  status: string;
  checkin_time: string | null;
  calendar_event_id: string | null;
  created_at: string;
};

const mem: StoredBooking[] = [
  {
    id: "B001",
    customerName: "คุณมาย",
    catName: "น้องส้ม",
    service: "groom",
    date: "2026-07-23",
    time: "12:30",
    status: "pending",
    lineUserId: "dev-user",
    createdAt: new Date().toISOString(),
  },
];

function rowToStored(r: BookingRow): StoredBooking {
  return {
    id: r.id,
    customerName: r.customer_name,
    catName: r.cat_name,
    service: r.service as "groom" | "room",
    date: r.date || "",
    time: r.time || undefined,
    checkout: r.checkout || undefined,
    checkin: r.checkin || undefined,
    room: r.room || undefined,
    lineUserId: r.line_user_id || undefined,
    notes: r.notes || undefined,
    status: r.status as BookingStatus,
    checkinTime: r.checkin_time || undefined,
    calendarEventId: r.calendar_event_id || undefined,
    createdAt: r.created_at,
  };
}

function storedToRow(b: Partial<StoredBooking>) {
  return {
    id: b.id,
    customer_name: b.customerName,
    cat_name: b.catName,
    service: b.service,
    date: b.date || null,
    time: b.time || null,
    checkout: b.checkout || null,
    checkin: b.checkin || null,
    room: b.room || null,
    line_user_id: b.lineUserId || null,
    notes: b.notes || null,
    status: b.status,
    checkin_time: b.checkinTime || null,
    calendar_event_id: b.calendarEventId || null,
    created_at: b.createdAt,
  };
}

export async function listBookings(lineUserId?: string) {
  const sb = getSupabase();
  if (sb) {
    let q = sb.from("bookings").select("*").order("created_at", { ascending: false });
    if (lineUserId) q = q.eq("line_user_id", lineUserId);
    const { data } = await q;
    return (data as BookingRow[] | null)?.map(rowToStored) || [];
  }
  if (!lineUserId) return [...mem];
  return mem.filter((b) => b.lineUserId === lineUserId);
}

export async function getBooking(id: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
    return data ? rowToStored(data as BookingRow) : undefined;
  }
  return mem.find((b) => b.id === id);
}

export async function addBooking(
  data: Omit<StoredBooking, "id" | "createdAt" | "status" | "calendarEventId">
) {
  const booking: StoredBooking = {
    ...data,
    id: `B${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("bookings").insert(storedToRow(booking));
    return booking;
  }

  mem.unshift(booking);
  return booking;
}

export async function updateBooking(
  id: string,
  patch: Partial<Pick<StoredBooking, "status" | "checkinTime" | "calendarEventId">>
) {
  const sb = getSupabase();
  if (sb) {
    const row: Record<string, string | undefined> = {};
    if (patch.status) row.status = patch.status;
    if (patch.checkinTime !== undefined) row.checkin_time = patch.checkinTime;
    if (patch.calendarEventId !== undefined) row.calendar_event_id = patch.calendarEventId;
    await sb.from("bookings").update(row).eq("id", id);
    return getBooking(id);
  }

  const b = mem.find((x) => x.id === id);
  if (!b) return null;
  Object.assign(b, patch);
  return b;
}

export async function bookingsForDate(isoDate: string) {
  const all = await listBookings();
  return all.filter((b) => b.date === isoDate || b.checkin === isoDate);
}

export async function bookingsTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = tomorrow.toISOString().slice(0, 10);
  const all = await listBookings();
  return all.filter(
    (b) =>
      b.status === "pending" &&
      (b.date === key || b.checkin === key) &&
      Boolean(b.lineUserId)
  );
}

export function toBooking(b: StoredBooking): Booking {
  return {
    id: b.id,
    customerName: b.customerName,
    catName: b.catName,
    service: b.service,
    date: b.date || b.checkin || "",
    time: b.time,
    checkout: b.checkout,
    roomType: b.room,
    status: b.status as BookingStatus,
    checkinTime: b.checkinTime,
  };
}
