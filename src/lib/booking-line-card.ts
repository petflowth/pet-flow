import { BUSINESS } from "./business";
import { getSiteConfig } from "./config-store";
import { bookingConfirmUrl as buildConfirmUrl } from "./line-config";
import { getLineCredentials } from "./line-config";
import { buildAppointmentConfirmFlex } from "./line";

export async function bookingConfirmUrl(bookingId: string) {
  const creds = await getLineCredentials();
  return buildConfirmUrl(bookingId, creds?.liffId);
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
    confirmUrl: await bookingConfirmUrl(booking.id),
    mapsUrl,
    location: `CatCha Hotel · ${location}`,
    businessName: config.business.name,
  }, config.cards?.bookingConfirm);
}
