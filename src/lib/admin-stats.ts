import { listBookings } from "./bookings-store";
import { todayFinance, monthFinance } from "./finance-store";
import { salesSummary } from "./invoices-store";

export function adminDashboardStats() {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const bookings = listBookings();
  const todayBookings = bookings.filter(
    (b) => b.date === today || b.checkin === today
  );
  const pending = bookings.filter((b) => b.status === "pending");
  const confirmedToday = todayBookings.filter((b) => b.status === "confirmed");

  return {
    today,
    queue: pending.length,
    todayAppointments: todayBookings.length,
    todayConfirmed: confirmedToday.length,
    salesToday: salesSummary(today, today),
    salesMonth: salesSummary(`${ym}-01`, `${ym}-31`),
    financeToday: todayFinance(),
    financeMonth: monthFinance(ym),
  };
}

export function bookingsForMonth(yearMonth: string) {
  const prefix = yearMonth.slice(0, 7);
  return listBookings().filter((b) => {
    const d = b.date || b.checkin || "";
    return d.startsWith(prefix);
  });
}

export function bookingsByDateMap(yearMonth: string) {
  const map = new Map<string, ReturnType<typeof listBookings>>();
  for (const b of bookingsForMonth(yearMonth)) {
    const key = b.date || b.checkin || "";
    if (!key) continue;
    const list = map.get(key) || [];
    list.push(b);
    map.set(key, list);
  }
  return map;
}
