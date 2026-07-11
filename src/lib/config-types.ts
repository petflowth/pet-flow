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
  /** เตือนเช็คอิน ก่อนเข้าพัก — {shop} {cat} {checkin} {room} */
  checkinReminder: string;
  /** เตือนเช็คเอาท์ ก่อนออก — {shop} {cat} {checkout} */
  checkoutReminder: string;
  /** ข้อความชวนกดยอมรับข้อตกลงก่อนเข้าพัก (แนบลิงก์) — {shop} {cat} {url} */
  consentInvite: string;
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
  /** อวยพรวันเกิดแมวอัตโนมัติ — {shop} {name} {cat} */
  birthdayGreeting: string;
};

/** ตั้งค่าระบบส่งอัตโนมัติ — เปิด/ปิด + กี่วันก่อน (แก้ได้ในหน้าตั้งค่า > อัตโนมัติ) */
export type AutomationConfig = {
  /** ส่งการ์ดยืนยันนัดอัตโนมัติ */
  confirmTomorrowEnabled: boolean;
  /** ส่งการ์ดยืนยันนัด ล่วงหน้ากี่วัน (1 = พรุ่งนี้) */
  confirmDaysBefore: number;
  /** เตือนยอดคงเหลือก่อนเข้าพัก */
  depositReminderEnabled: boolean;
  /** กี่วันก่อนเข้าพัก ที่จะเตือนยอดคงเหลือ */
  depositReminderDays: number;
  /** แจ้งรายละเอียดเข้าพัก + เงื่อนไข ก่อนเข้าพัก */
  prestayReminderEnabled: boolean;
  /** กี่วันก่อนเข้าพัก ที่จะแจ้งรายละเอียด+เงื่อนไข */
  prestayReminderDays: number;
  /** เตือนเช็คอิน ก่อนวันเข้าพัก */
  checkinReminderEnabled: boolean;
  /** กี่วันก่อนเข้าพัก ที่จะเตือนเช็คอิน */
  checkinReminderDays: number;
  /** เตือนเช็คเอาท์ ก่อนวันออก */
  checkoutReminderEnabled: boolean;
  /** กี่วันก่อนเช็คเอาท์ ที่จะเตือน */
  checkoutReminderDays: number;
  /** อวยพรวันเกิดแมวอัตโนมัติ */
  birthdayEnabled: boolean;
};

export type SiteConfig = {
  version: number;
  updatedAt: string;
  crm: CrmConfig;
  messages: MessagesConfig;
  automation: AutomationConfig;
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
  /** ตัวเลือก/รายการที่แก้ได้ในหลังบ้าน (แทนที่การฝังในโค้ด) */
  options: {
    /** บริการเสริมในหน้าคิดเงิน (ชื่อ + ราคา) */
    servicePresets: { label: string; amount: number }[];
    /** ของแถม (ฟรี) — ชื่ออย่างเดียว */
    freebies: string[];
    /** สายพันธุ์แมว (หน้าลงทะเบียน + ตัวกรอง broadcast) */
    catBreeds: string[];
    /** รู้จักร้านจากไหน (referral) — หน้าลงทะเบียน */
    referralOptions: string[];
  };
};
