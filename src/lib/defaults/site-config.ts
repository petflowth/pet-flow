import {
  BUSINESS,
  ROOM_INVENTORY,
  ROOMS,
  GROOM_SLOTS,
  TRANSPORT,
  POINTS_REWARDS,
} from "../business";
import {
  GROOM_MENUS,
  GROOM_NOTES,
  GROOM_SIZE_LABELS,
  GROOM_SPECIALS,
} from "../grooming";
import { DEFAULT_MESSAGES } from "../messages";
import { SERVICE_PRESETS } from "../service-presets";
import { BREED_OPTIONS } from "../cat-breeds";
import type { SiteConfig } from "../config-types";

export function getDefaultSiteConfig(): SiteConfig {
  return JSON.parse(
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      crm: {
        inactiveDays: 60,
        followUpCooldownDays: 30,
        followUpMessage:
          "สวัสดีค่ะ {name} จาก CatCha Hotel 🐱\nคิดถึงน้อง{cats} นะคะ มาไม่ได้นาน {days} วันแล้ว มีโปรพิเศษรออยู่ที่แอปนะคะ 💛",
        tierPresets: ["VIP", "Gold", "Silver"],
      },
      messages: { ...DEFAULT_MESSAGES },
      automation: {
        confirmTomorrowEnabled: true,
        confirmDaysBefore: 1,
        depositReminderEnabled: true,
        depositReminderDays: 7,
        prestayReminderEnabled: true,
        prestayReminderDays: 3,
        checkinReminderEnabled: true,
        checkinReminderDays: 1,
        checkoutReminderEnabled: true,
        checkoutReminderDays: 1,
        birthdayEnabled: true,
      },
      business: { ...BUSINESS },
      payment: {
        bankName: process.env.BANK_NAME || "กรุงไทย",
        accountNumber: process.env.BANK_ACCOUNT_NUMBER || "XXX-X-XXXXX-X",
        accountName: process.env.BANK_ACCOUNT_NAME || "CatCha Hotel",
      },
      billing: {
        summaryBookingTitle: "สรุปการจอง",
        summaryDepositTitle: "สรุปการจอง + แจ้งมัดจำ",
        summaryFullTitle: "สรุปการจอง + แจ้งยอดชำระ",
        summaryClosing: "โอนแล้วแจ้งสลิปได้เลยนะคะ 🧡",
      },
      roomInventory: { ...ROOM_INVENTORY },
      rooms: ROOMS,
      groomSlots: [...GROOM_SLOTS],
      transport: {
        th: [...TRANSPORT.th],
        en: [...TRANSPORT.en],
      },
      pointsRewards: POINTS_REWARDS.map((r) => ({
        id: r.id,
        points: r.points,
        reward: { ...r.reward },
      })),
      grooming: {
        menus: JSON.parse(JSON.stringify(GROOM_MENUS)),
        specials: JSON.parse(JSON.stringify(GROOM_SPECIALS)),
        notes: {
          th: [...GROOM_NOTES.th],
          en: [...GROOM_NOTES.en],
        },
        sizeLabels: JSON.parse(JSON.stringify(GROOM_SIZE_LABELS)),
      },
      options: {
        servicePresets: SERVICE_PRESETS.map((s) => ({ ...s })),
        freebies: ["กล้องวงจรปิด (CCTV)", "น้ำพุแมว", "ทรายแมว", "รับ-ส่ง", "ขนม/ทรีท"],
        catBreeds: [...BREED_OPTIONS],
        referralOptions: [
          "Facebook",
          "Instagram",
          "TikTok",
          "Google / ค้นหา",
          "Google Maps",
          "เพื่อนแนะนำ / ผ่านหน้าร้าน",
        ],
      },
    })
  ) as SiteConfig;
}
