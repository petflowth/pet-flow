"use client";

import Link from "next/link";
import { BookingCalendar } from "@/components/BookingCalendar";

export default function SchedulePage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-lg font-extrabold text-petflow-chocolate">🗓️ ตารางนัด</h1>
        <Link
          href="/admin/bookings/new"
          className="rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep px-4 py-2 text-xs font-extrabold text-petflow-chocolate shadow-petflow-sm"
        >
          ➕ จองใหม่
        </Link>
      </div>
      <BookingCalendar />
    </div>
  );
}
