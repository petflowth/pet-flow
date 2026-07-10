import type { RoomType } from "./business";

export type LocalizedLines = { th: string[]; en: string[] };

export type PointsRewardConfig = {
  id: string;
  points: number;
  reward: { th: string; en: string };
};

export type GroomingConfig = {
  menus: Record<string, unknown>;
  specials: { th: { name: string; price: string }[]; en: { name: string; price: string }[] };
  notes: LocalizedLines;
  sizeLabels: { th: Record<string, string>; en: Record<string, string> };
};

export type CrmConfig = {
  /** จำนวนวันที่ไม่มาใช้บริการ = ถือว่าหายไป */
  inactiveDays: number;
  /** ไม่ส่งตามซ้ำภายในกี่วัน */
  followUpCooldownDays: number;
  /** ข้อความตามลูกค้า — ใช้ {name} {days} {cats} */
  followUpMessage: string;
  /** tier ที่ตั้งเองได้ในโปรไฟล์ลูกค้า */
  tierPresets: string[];
};

/** ข้อความ (plain text) ที่ส่งหาลูกค้า — แก้ได้ในหน้าตั้งค่า > ข้อความ */
export type MessagesConfig = {
  /** เตือนยอดคงเหลือ 7 วันก่อนเข้าพัก — {shop} {cat} {checkin} {deposit} {remaining} {bank} {accountNumber} {accountName} */
  depositReminder: string;
  /** รายละเอียด 3 วันก่อนเข้าพัก — {shop} {cat} {checkin} {checkout} {room} */
  prestayReminder: string;
  /** หัวเรื่องหน้ายอมรับข้อตกลงก่อนเข้าพัก */
  consentTitle: string;
  /** ข้อตกลงก่อนเข้าพัก — บรรทัดละ 1 ข้อ */
  consentTerms: string[];
  /** การ์ดเรียกเก็บมัดจำ (ส่งก่อนลูกค้าโอน) — หัวเรื่อง */
  depositRequestTitle: string;
  /** การ์ดเรียกเก็บมัดจำ — ข้อความ ({name} {cat} {amount}) */
  depositRequestBody: string;
  /** การ์ดขอบคุณตอนรับมัดจำ — หัวเรื่อง */
  depositThanksTitle: string;
  /** การ์ดขอบคุณตอนรับมัดจำ — ข้อความ ({name} {cat} {amount}) */
  depositThanksBody: string;
  /** เงื่อนไขมัดจำในการ์ด — บรรทัดละ 1 ข้อ */
  depositTerms: string[];
};

export type SiteConfig = {
  version: number;
  updatedAt: string;
  crm: CrmConfig;
  messages: MessagesConfig;
  business: {
    name: string;
    tagline: { th: string; en: string };
    lineOa: string;
    phones: string[];
    maps: string;
    facebook: string;
    /** ลิงก์ให้ลูกค้ารีวิว (แยกจากลิงก์แผนที่) */
    reviewUrl: string;
    /** คำในปุ่มรีวิว */
    reviewButtonText: string;
    location: { th: string; en: string };
    pointsRate: number;
  };
  payment: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  /** ข้อความหัวเรื่อง/ปิดท้าย ของสรุปที่ก๊อป/ส่งให้ลูกค้า (แก้ได้ในตั้งค่า) */
  billing: {
    summaryBookingTitle: string;
    summaryDepositTitle: string;
    summaryFullTitle: string;
    summaryClosing: string;
  };
  roomInventory: {
    total: number;
    miniMeow: number;
    midCozy: number;
    catflix: number;
  };
  rooms: RoomType[];
  groomSlots: string[];
  transport: LocalizedLines;
  pointsRewards: PointsRewardConfig[];
  grooming: GroomingConfig;
};
