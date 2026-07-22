import type { RoomType } from "./business";
import type { GroomFormConfig } from "./groom-form";

export type LocalizedLines = { th: string[]; en: string[] };

export type PointsRewardConfig = {
  id: string;
  points: number;
  reward: { th: string; en: string };
  imageUrl?: string;
  /** มูลค่าส่วนลด (บาท) ของรางวัลนี้ — ถ้าไม่ตั้งไว้ ระบบจะลองอ่านจากชื่อรางวัลแทน */
  discount?: number;
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
  /** เงื่อนไขอัปเกรดระดับลูกค้าอัตโนมัติ (ตั้งเองได้) */
  tierRules: TierRulesConfig;
};

/** เงื่อนไขเลื่อนระดับลูกค้า — ถึงระดับเมื่อ "ครบครั้ง" หรือ "ยอดถึง" (อย่างใดอย่างหนึ่ง) */
export type TierRulesConfig = {
  /** มาใช้บริการกี่ครั้งขึ้นไป = ลูกค้าประจำ */
  regularMinVisits: number;
  /** มาใช้บริการกี่ครั้งขึ้นไป = VIP */
  vipMinVisits: number;
  /** ยอดสะสมรวมกี่บาทขึ้นไป = VIP (0 = ปิด ไม่ใช้เงื่อนไขยอด) */
  vipMinSpend: number;
};

/** ข้อความ (plain text) ที่ส่งหาลูกค้า — แก้ได้ในหน้าตั้งค่า > ข้อความ */
export type MessagesConfig = {
  /** เตือนยอดคงเหลือ 7 วันก่อนเข้าพัก — {shop} {cat} {checkin} {deposit} {remaining} {bank} {accountNumber} {accountName} */
  depositReminder: string;
  /** รายละเอียด 3 วันก่อนเข้าพัก — {shop} {cat} {checkin} {checkout} {room} (เก่า/สำรอง) */
  prestayReminder: string;
  /** การ์ดเข้าพัก — ประโยคทักทายเปิด — {shop} {cat} */
  prestayIntro: string;
  /** การ์ดเข้าพัก — ประโยคเกริ่นก่อนลิสต์ของที่ต้องเตรียม */
  prestayPrepIntro: string;
  /** การ์ดเข้าพัก — รายการของที่ต้องเตรียม (บรรทัดละ 1 ข้อ) */
  prestayPrepItems: string[];
  /** การ์ดเข้าพัก — ประโยคปิดชวนแจ้งการดูแลพิเศษ — {cat} */
  prestayCareNote: string;
  /** การ์ดเข้าพัก — ข้อความเตือนให้เตรียมทราย (เข้าพักสั้นกว่าเกณฑ์แถมฟรี) — {min} */
  prestayLitterNote: string;
  /** เตือนเช็คอิน ก่อนเข้าพัก — {shop} {cat} {checkin} {room} */
  checkinReminder: string;
  /** เตือนเช็คเอาท์ ก่อนออก — {shop} {cat} {checkout} */
  checkoutReminder: string;
  /** ขอรีวิวหลังเช็คเอาท์ — {shop} {cat} */
  reviewRequest: string;
  /** สอบถามประวัติน้องก่อนอาบน้ำ — {shop} {cat} */
  groomInfoIntro: string;
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
  /** แจ้งลูกค้าทันทีที่ร้านกดยืนยันคิว — ยืนยันว่าได้คิววันที่จองมาแล้ว
   * (คนละอันกับ checkinReminder ที่เตือนล่วงหน้าก่อนถึงวันจริง)
   * — {shop} {cat} {when} (วันที่+เวลา+ประเภทนัด จัดรูปแบบมาแล้วจาก bookingScheduleText) */
  bookingApprovedText: string;
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
  /** ขอรีวิวอัตโนมัติ หลังลูกค้าเช็คเอาท์ (ห้องพัก) */
  reviewRequestEnabled: boolean;
  /** ส่งขอรีวิวหลังเช็คเอาท์ (วัน) */
  reviewRequestDaysAfter: number;
  /** ส่งการ์ดสอบถามประวัติน้องก่อนอาบน้ำ (พ่วงกับยืนยันนัด) */
  groomInfoEnabled: boolean;
  /** เข้าพักกี่คืนขึ้นไป ถึงแถมทรายฟรี (ถ้าน้อยกว่านี้ ให้ลูกค้าเตรียมทรายมาเอง) */
  freeLitterMinNights: number;
  /** อวยพรวันเกิดแมวอัตโนมัติ */
  birthdayEnabled: boolean;
  /** แจกคูปองวันเกิดอัตโนมัติ (แมว/เจ้าของ) */
  birthdayCouponEnabled: boolean;
  /** มูลค่าคูปองวันเกิด (บาท) */
  birthdayCouponAmount: number;
  /** ส่งข้อความยืนยันคิวทันทีตอนร้านกดยืนยัน (คนละอันกับเตือนล่วงหน้าก่อนถึงวัน) */
  bookingApprovedEnabled: boolean;
};

/**
 * สไตล์การ์ด LINE ต่อใบ — ตั้งค่าจากหน้า "ปรับแต่งการ์ด LINE" (มีพรีวิวสด)
 * ทุกฟิลด์ optional: ไม่ตั้ง = ใช้หน้าตาเดิมของระบบ
 */
export type CardStyleConfig = {
  /** สีแถบหัวการ์ด */
  headerColor?: string;
  /** สีตัวหนังสือบนแถบหัว */
  headerTextColor?: string;
  /** สีปุ่มกดในการ์ด */
  buttonColor?: string;
  /** สีไฮไลท์ (ยอดเงิน/ตัวเลขเด่น) */
  accentColor?: string;
  /** ข้อความปิดท้ายการ์ด (แทนของเดิม) */
  closing?: string;
  /** ขนาดตัวอักษรหัวข้อการ์ด */
  titleSize?: "sm" | "md" | "lg" | "xl";
  /** เปิด/ปิดส่วนประกอบในการ์ด — key ตามการ์ดแต่ละใบ, ไม่ตั้ง = แสดง */
  show?: Record<string, boolean>;
  /** ข้อความในการ์ดที่แก้เองได้ — key ตามการ์ดแต่ละใบ, ไม่ตั้ง = ใช้ข้อความเดิม */
  texts?: Record<string, string>;
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
    /** เลขประจำตัวผู้เสียภาษี — โชว์บนเอกสารรายได้/ใบสำคัญจ่าย (ไม่บังคับ) */
    taxId?: string;
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
  /** จำนวนคิวที่รับพร้อมกันต่อสล็อต (key = เวลาใน groomSlots) — ไม่ตั้งไว้ = ใช้ groomSlotDefaultCapacity */
  groomSlotCapacity?: Record<string, number>;
  /** จำนวนคิวเริ่มต้นต่อสล็อต เมื่อไม่ได้ตั้งไว้ใน groomSlotCapacity */
  groomSlotDefaultCapacity?: number;
  /** วันหยุดประจำสัปดาห์ (0=อาทิตย์ … 6=เสาร์) — ลูกค้าจองคิวเอง/ห้องพักเองในวันนี้ไม่ได้ */
  closedWeekdays?: number[];
  /** วันหยุดเฉพาะวัน (ปีใหม่, ปิดพักร้อน ฯลฯ) — เพิ่ม/ลบได้ในหลังบ้าน */
  closedDates?: { date: string; note?: string }[];
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
  /** สไตล์การ์ด LINE รายใบ — key: bookingConfirm | billSummary | depositRequest | receipt | review | groomInfo */
  cards?: Record<string, CardStyleConfig>;
  /** คำถาม/ตัวเลือกในฟอร์มประวัติน้องก่อนอาบน้ำ — แก้เองได้ในหลังบ้าน */
  groomForm?: GroomFormConfig;
  /** สีประจำร้าน — แต่ละร้านปรับเองได้ ไม่ตั้ง = ใช้โทนสีเริ่มต้นของ PetFlow */
  branding?: {
    /** สีหลัก (ปุ่ม, ลิงก์เด่น) */
    primary: string;
    /** สีไฮไลท์ (พื้นหลังนุ่ม ๆ, แถบ, badge) */
    accent: string;
    /** สีตัวอักษรหัวข้อ/โลโก้ */
    heading: string;
    /** สีพื้นหลังหลักทั้งเว็บ (ใช้เป็นค่าตั้งต้น/สีทึบเมื่อไม่ได้เปิดไล่เฉด) */
    background: string;
    /** จุดเริ่มไล่สีพื้นหลัง — ใส่คู่กับ backgroundGradientTo เพื่อเปิดพื้นหลังไล่เฉด */
    backgroundGradientFrom?: string;
    /** จุดจบไล่สีพื้นหลัง */
    backgroundGradientTo?: string;
    /** สีพื้นการ์ด/กล่อง (ทับพื้นหลังหลัก) */
    surface: string;
    /** สีตัวอักษรเนื้อหาทั่วไป */
    text: string;
    /** โลโก้ร้าน — data URL หรือ URL รูป, ไม่ตั้ง = ใช้โลโก้ PetFlow เริ่มต้น */
    logoUrl?: string;
  };
};
