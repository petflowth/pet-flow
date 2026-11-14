import { bangkokToday } from "@/lib/bangkok-date";
import { loadServices, loadSettings, salonRoute } from "@/lib/salon/server";

/** ข้อมูลตั้งต้นของทุกหน้า: ตั้งค่าร้าน + รายการบริการ */
export const GET = salonRoute(async (_req, { shop, isOwner, by }) => {
  const [settings, services] = await Promise.all([loadSettings(shop), loadServices(shop)]);
  return { settings, services, isOwner, name: by, today: bangkokToday() };
});
