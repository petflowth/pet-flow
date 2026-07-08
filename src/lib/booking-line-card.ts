import { BUSINESS } from "./business";
import { getSiteConfig } from "./config-store";
import { buildAppointmentConfirmFlex } from "./line";

export function bookingConfirmUrl(bookingId: string) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return liffId
    ? `https://liff.line.me/${liffId}?path=bookings&id=${bookingId}`
    : `${base}/app/bookings?id=${bookingId}`;
}

export async function buildBookingConfirmFlex(
  booking: {
    id: string;
    catName: string;
    customerName: string;
    service: string;
    date?: string;
    time?: string;
    checkin?: string;
    checkout?: string;
    room?: string;
    notes?: string;
  }
) {
  const config = await getSiteConfig();
  const location =
    config.business.location.th || BUSINESS.location.th;
  const mapsUrl = config.business.maps || BUSINESS.maps;

  return buildAppointmentConfirmFlex({
    ...booking,
    confirmUrl: bookingConfirmUrl(booking.id),
    mapsUrl,
    location: `CatCha Hotel · ${location}`,
    businessName: config.business.name,
  });
}
