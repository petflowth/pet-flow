const TH_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

/** ISO date (YYYY-MM-DD) → วันที่ 5 ก.ค. 2569 */
export function formatThaiDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `วันที่ ${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function formatBookingWhen(booking: {
  service: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
}): string {
  if (booking.service === "room" || booking.checkin) {
    const start = formatThaiDate(booking.checkin || booking.date || "");
    const end = booking.checkout ? formatThaiDate(booking.checkout) : "";
    return end ? `${start} → ${end}` : start;
  }
  const date = formatThaiDate(booking.date || "");
  return booking.time ? `${date} · เวลา ${booking.time}` : date;
}
