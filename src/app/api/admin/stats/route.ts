import { NextResponse } from "next/server";
import { adminDashboardStats, bookingsByDateMap } from "@/lib/admin-stats";

export async function GET() {
  const stats = await adminDashboardStats();
  const ym = stats.today.slice(0, 7);
  const calendar = Object.fromEntries(await bookingsByDateMap(ym));
  return NextResponse.json({ stats, calendarMonth: ym, calendar });
}
