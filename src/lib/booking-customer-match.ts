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

export function isUpcomingBooking(
  booking: { status: Booking["status"]; date: string; checkin?: string },
  today = new Date().toISOString().slice(0, 10)
) {
  if (booking.status === "cancelled") return false;
  const when = booking.checkin || booking.date;
  return Boolean(when && when >= today);
}
