import { listBookings } from "./bookings-store";
import { datesForBooking } from "./booking-customer-match";
import { todayFinance, monthFinance } from "./finance-store";
import { salesSummary, listInvoices } from "./invoices-store";
import { isAwaitingConfirmation } from "./booking-status";

export async function adminDashboardStats() {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const bookings = await listBookings();
  const active = bookings.filter((b) => b.status !== "cancelled");
  const todayBookings = active.filter(
    (b) => b.date === today || b.checkin === today
  );
  // นัดที่ผ่านมาแล้วหรือออกบิลไปแล้ว = ลูกค้ามาแล้ว ไม่ต้องรอยืนยันอีก
  const invoices = await listInvoices();
  const billed = new Set(
    invoices.filter((i) => i.bookingId).map((i) => i.bookingId as string)
  );
  const pending = active.filter((b) => isAwaitingConfirmation(b, today, billed));
  const confirmedToday = todayBookings.filter((b) => b.status === "confirmed");

  return {
    today,
    queue: pending.length,
    todayAppointments: todayBookings.length,
    todayConfirmed: confirmedToday.length,
    salesToday: await salesSummary(today, today),
    salesMonth: await salesSummary(`${ym}-01`, `${ym}-31`),
    financeToday: await todayFinance(),
    financeMonth: await monthFinance(ym),
  };
}

export async function bookingsForMonth(yearMonth: string) {
  const prefix = yearMonth.slice(0, 7);
  const all = await listBookings();
  return all.filter((b) => {
    if (b.status === "cancelled") return false;
    return datesForBooking(b).some((d) => d.startsWith(prefix));
  });
}

export async function bookingsByDateMap(yearMonth: string) {
  const prefix = yearMonth.slice(0, 7);
  const map = new Map<string, Awaited<ReturnType<typeof listBookings>>>();
  for (const b of await bookingsForMonth(yearMonth)) {
    for (const key of datesForBooking(b)) {
      if (!key.startsWith(prefix)) continue;
      const list = map.get(key) || [];
      list.push(b);
      map.set(key, list);
    }
  }
  return map;
}
