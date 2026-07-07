import type { Booking, BookingStatus } from "./business";

export type StoredBooking = Booking & {
  lineUserId?: string;
  room?: string;
  checkin?: string;
  notes?: string;
  createdAt: string;
  calendarEventId?: string;
};

const bookings: StoredBooking[] = [
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

export function listBookings(lineUserId?: string) {
  if (!lineUserId) return [...bookings];
  return bookings.filter((b) => b.lineUserId === lineUserId);
}

export function getBooking(id: string) {
  return bookings.find((b) => b.id === id);
}

export function addBooking(
  data: Omit<StoredBooking, "id" | "createdAt" | "status" | "calendarEventId">
) {
  const booking: StoredBooking = {
    ...data,
    id: `B${Date.now()}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  bookings.unshift(booking);
  return booking;
}

export function updateBooking(
  id: string,
  patch: Partial<Pick<StoredBooking, "status" | "checkinTime">>
) {
  const b = bookings.find((x) => x.id === id);
  if (!b) return null;
  Object.assign(b, patch);
  return b;
}

export function bookingsForDate(isoDate: string) {
  return bookings.filter((b) => b.date === isoDate || b.checkin === isoDate);
}

export function bookingsTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = tomorrow.toISOString().slice(0, 10);
  return bookings.filter(
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
