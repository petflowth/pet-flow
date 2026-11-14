import { bangkokToday } from "@/lib/bangkok-date";
import { availability, isDay, isUuid, salonRoute, servicesFromIds, getVisit } from "@/lib/salon/server";

/**
 * เวลาว่าง ?day=&services=id,id (หรือ &visit=id ใช้บริการของคิวนั้น ตอนเลื่อนนัด)
 */
export const GET = salonRoute(async (req, { shop }) => {
  const sp = req.nextUrl.searchParams;
  const d = sp.get("day");
  const day = isDay(d) ? d : bangkokToday();
  const visitId = sp.get("visit");
  let services;
  if (isUuid(visitId)) services = (await getVisit(shop, visitId)).services;
  else services = (await servicesFromIds(shop, (sp.get("services") || "").split(","))).items;
  if (!services.length) services = [{ duration_min: 30, wait_min: 0, wait_after_min: 0 }];
  return availability(shop, day, services, { excludeVisit: isUuid(visitId) ? visitId : undefined });
});
