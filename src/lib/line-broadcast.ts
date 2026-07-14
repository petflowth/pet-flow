import { BUSINESS } from "@/lib/business";
import { getAppUrlFromEnv } from "@/lib/line-config";
import { buildLiffUrl } from "@/lib/liff-urls";

export type BroadcastActionId =
  | "promos"
  | "grooming"
  | "rooms"
  | "bookings"
  | "line_chat"
  | "maps";

export type BroadcastAction = {
  id: BroadcastActionId;
  label: string;
  description: string;
};

export const BROADCAST_ACTIONS: BroadcastAction[] = [
  { id: "promos", label: "🎁 รับโปร", description: "เปิดหน้าโปรในแอป" },
  { id: "grooming", label: "🛁 จองอาบน้ำ", description: "ไปหน้าจองอาบน้ำ" },
  { id: "rooms", label: "🏠 จองห้องพัก", description: "ไปหน้าจองห้อง" },
  { id: "bookings", label: "📅 ดูนัดของฉัน", description: "เปิดรายการนัด" },
  { id: "line_chat", label: "💬 สนใจ / ทักแชท", description: "เปิดแชท LINE OA" },
  { id: "maps", label: "📍 ดูแผนที่", description: "เปิด Google Maps" },
];

export type BroadcastTemplate = {
  label: string;
  title: string;
  body: string;
  suggestedActions: BroadcastActionId[];
};

export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  {
    label: "โปร Member",
    title: "💎 โปรพิเศษ Member",
    body:
      "เติมเครดิตวันนี้ รับสิทธิพิเศษสำหรับสมาชิก\n" +
      "ทักจองคิวอาบน้ำหรือห้องพักได้เลยค่ะ 🐱",
    suggestedActions: ["promos", "line_chat"],
  },
  {
    label: "ลดราคาอาบน้ำ",
    title: "🛁 โปรอาบน้ำ & กรูมมิ่ง",
    body:
      "น้องแมวสดชื่น หอมปราดเปรียะ\n" +
      "จองคิวอาบน้ำวันนี้ — รับสิทธิพิเศษสำหรับลูกค้า CatCha",
    suggestedActions: ["grooming", "line_chat"],
  },
  {
    label: "ห้องพักโปร",
    title: "🏠 โปรห้องพักน้องแมว",
    body:
      "ฝากน้องพักสบาย มี CCTV ดูแลตลอด\n" +
      "จองห้องพักล่วงหน้าได้เลย — ที่ว่างจำกัด",
    suggestedActions: ["rooms", "maps"],
  },
  {
    label: "ทักทายลูกค้าเก่า",
    title: "🐱 คิดถึงน้องแมว",
    body:
      "สวัสดีจาก CatCha Hotel\n" +
      "นานแล้วที่ไม่ได้เจอน้อง — มีโปรพิเศษรออยู่\n" +
      "ทักแชทหรือกดปุ่มด้านล่างเพื่อจองคิว",
    suggestedActions: ["line_chat", "grooming"],
  },
];

export function resolveBroadcastActionUri(
  actionId: BroadcastActionId,
  liffId?: string
): string {
  const appBase = getAppUrlFromEnv() || "https://catchahotel.com";
  const lid = liffId?.trim();

  switch (actionId) {
    case "promos":
      return lid
        ? buildLiffUrl(lid, { path: "promos" })
        : `${appBase}/app/promos`;
    case "grooming":
      return lid
        ? buildLiffUrl(lid, { path: "grooming" })
        : `${appBase}/app/grooming`;
    case "rooms":
      return lid
        ? buildLiffUrl(lid, { path: "rooms" })
        : `${appBase}/app/rooms`;
    case "bookings":
      return lid
        ? buildLiffUrl(lid, { path: "bookings" })
        : `${appBase}/app/bookings`;
    case "line_chat":
      return `https://line.me/R/ti/p/${BUSINESS.lineOa}`;
    case "maps":
      return BUSINESS.maps;
    default:
      return `${appBase}/app`;
  }
}

export function buildBroadcastButtons(
  actionIds: BroadcastActionId[],
  liffId?: string
) {
  return actionIds.slice(0, 3).map((id) => {
    const preset = BROADCAST_ACTIONS.find((a) => a.id === id);
    return {
      label: preset?.label || id,
      uri: resolveBroadcastActionUri(id, liffId),
    };
  });
}
