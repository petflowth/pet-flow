import type { Booking } from "./business";
import type { CustomerRecord } from "./customers-store";

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** จับคู่นัดกับลูกค้า — ใช้ LINE ID หรือชื่อลูกค้า+ชื่อแมว */
export function bookingMatchesCustomer(
  booking: Pick<Booking, "customerName" | "catName"> & { lineUserId?: string },
  customer: CustomerRecord
): boolean {
  if (customer.lineUserId && booking.lineUserId === customer.lineUserId) {
    return true;
  }
  if (norm(booking.customerName) !== norm(customer.name)) {
    return false;
  }
  if (!customer.cats.length) return true;
  return customer.cats.some((cat) => norm(cat.name) === norm(booking.catName));
}

export function datesForBooking(
  booking: {
    status: Booking["status"];
    service?: string;
    date: string;
    checkin?: string;
    checkout?: string;
  }
): string[] {
  if (booking.status === "cancelled") return [];
  if (booking.service === "room" || booking.checkin) {
    const start = booking.checkin || booking.date;
    const end = booking.checkout || start;
    if (!start) return [];
    const dates: string[] = [];
    const cur = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    while (cur <= last) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }
  return booking.date ? [booking.date] : [];
}

export function bookingOnDate(
  booking: Parameters<typeof datesForBooking>[0],
  dateKey: string
): boolean {
  return datesForBooking(booking).includes(dateKey);
}

export function isUpcomingBooking(
  booking: Parameters<typeof datesForBooking>[0],
  today = new Date().toISOString().slice(0, 10)
) {
  if (booking.status === "cancelled") return false;
  return datesForBooking(booking).some((d) => d >= today);
}
