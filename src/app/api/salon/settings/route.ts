import { mergeSettings } from "@/lib/salon/shared";
import { body, check, salonRoute, sdb } from "@/lib/salon/server";
import { cleanPromptpayId } from "@/lib/promptpay";

/** บันทึกตั้งค่าร้าน (เจ้าของเท่านั้น) */
export const PUT = salonRoute(
  async (req, { shop, by }) => {
    const b = await body(req);
    const settings = mergeSettings(b.settings);
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!hhmm.test(settings.open) || !hhmm.test(settings.close) || settings.open >= settings.close) {
      settings.open = "10:00";
      settings.close = "20:00";
    }
    settings.shop_name = String(settings.shop_name || "").slice(0, 80) || "ร้านทำผม";
    settings.pay.promptpay_id = cleanPromptpayId(settings.pay.promptpay_id) || "";
    check(
      await sdb()
        .from("settings")
        .upsert({ shop_id: shop, data: settings, updated_at: new Date().toISOString(), updated_by: by })
    );
    return { settings };
  },
  { owner: true }
);
