import { getLineCredentials } from "./line-config";
import { buildConsentUrl, buildBookingTimeUrl } from "./liff-urls";
import { renderTemplate } from "./messages";
import type { StoredBooking } from "./bookings-store";
import type { InvoiceRecord } from "./invoices-store";
import type { SiteConfig } from "./config-types";

/**
 * ตัวสร้างข้อความเตือนลูกค้า — ใช้ร่วมกันทั้ง "cron อัตโนมัติ" และ "ปุ่มกดส่งเอง"
 * เพื่อให้แก้ข้อความที่เดียว (Settings) แล้วมีผลทุกที่
 */

/** ข้อความวัน/เวลา ของนัด — อาบน้ำ = วันที่+เวลา · ห้องพัก = ช่วงเข้าพัก */
export function bookingScheduleText(b: {
  service?: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
}): string {
  if (b.service === "room" || b.checkin) {
    return `🏠 เข้าพัก: ${b.checkin || b.date || ""}${b.checkout ? ` → ${b.checkout}` : ""}`;
  }
  return `📅 นัดอาบน้ำ: ${b.date || ""}${b.time ? ` ${b.time}` : ""}`.trim();
}

/** ลิงก์หน้ายอมรับข้อตกลง (คืน "" ถ้ายังไม่ได้ตั้ง LIFF ID) */
export async function getConsentUrl(): Promise<string> {
  const liffId = (await getLineCredentials())?.liffId;
  return liffId ? buildConsentUrl(liffId) : "";
}

/** ลิงก์หน้าเลือกเวลาส่ง/รับน้อง (คืน "" ถ้ายังไม่ได้ตั้ง LIFF ID) */
export async function getBookingTimeUrl(
  bookingId: string,
  type: "checkin" | "checkout"
): Promise<string> {
  const liffId = (await getLineCredentials())?.liffId;
  return liffId ? buildBookingTimeUrl(liffId, bookingId, type) : "";
}

/** เนื้อความการ์ดเลือกเวลาเข้าพัก (เช็คอิน) */
export function buildCheckinBodyText(
  b: Pick<StoredBooking, "catName" | "checkin" | "date" | "room">,
  cfg: SiteConfig
): string {
  return renderTemplate(cfg.messages.checkinReminder, {
    shop: cfg.business.name,
    cat: b.catName,
    checkin: b.checkin || b.date || "",
    room: b.room ? `🏠 ห้อง: ${b.room}` : "",
    litterNote: "",
  });
}

/** เนื้อความการ์ดเลือกเวลารับน้อง (เช็คเอาท์) */
export function buildCheckoutBodyText(
  b: Pick<StoredBooking, "catName" | "checkout">,
  cfg: SiteConfig
): string {
  return renderTemplate(cfg.messages.checkoutReminder, {
    shop: cfg.business.name,
    cat: b.catName,
    checkout: b.checkout || "",
  });
}

/** ข้อความเตือนยอดคงเหลือ/มัดจำ — คืน null ถ้าไม่มียอดต้องโอน */
export function buildDepositReminderText(
  b: Pick<StoredBooking, "catName" | "checkin" | "date">,
  inv: InvoiceRecord,
  cfg: SiteConfig
): string | null {
  const deposit = inv.deposit || 0;
  const remaining = inv.total - deposit;
  if (remaining <= 0) return null;
  return renderTemplate(cfg.messages.depositReminder, {
    shop: cfg.business.name,
    cat: b.catName,
    checkin: b.checkin || b.date || "",
    deposit: deposit.toLocaleString(),
    remaining: remaining.toLocaleString(),
    bank: cfg.payment.bankName,
    accountNumber: cfg.payment.accountNumber,
    accountName: cfg.payment.accountName,
  });
}

/** ข้อความชวนกดยอมรับข้อตกลง (แนบลิงก์) — คืน "" ถ้ายังไม่มีลิงก์ */
export function buildConsentInviteText(
  b: Pick<StoredBooking, "catName">,
  cfg: SiteConfig,
  url: string
): string {
  if (!url) return "";
  return renderTemplate(cfg.messages.consentInvite, {
    shop: cfg.business.name,
    cat: b.catName,
    url,
  });
}

/** ข้อความเตือน "เตรียมทรายมาเอง" ถ้าเข้าพักไม่ถึงเกณฑ์แถมทรายฟรี (คืน "" ถ้าถึงเกณฑ์) */
export function litterNoteFor(
  b: { checkin?: string; checkout?: string; date?: string },
  cfg: SiteConfig
): string {
  const min = cfg.automation?.freeLitterMinNights ?? 3;
  const nights =
    b.checkin && b.checkout
      ? Math.max(
          1,
          Math.round(
            (new Date(`${b.checkout}T12:00:00`).getTime() -
              new Date(`${b.checkin}T12:00:00`).getTime()) /
              86400000
          )
        )
      : 1;
  if (nights >= min) return "";
  return `🐈 รบกวนเตรียม "ทรายแมว" มาด้วยนะคะ (เข้าพักไม่ถึง ${min} คืน ยังไม่รวมทรายฟรีค่ะ)`;
}

/** เนื้อความเตรียมตัวก่อนเข้าพัก (ไม่แนบลิงก์ — ใช้กับการ์ดที่มีปุ่มยอมรับเงื่อนไข) */
export function buildPrestayBodyText(
  b: Pick<StoredBooking, "catName" | "checkin" | "checkout" | "room" | "date">,
  cfg: SiteConfig
): string {
  return renderTemplate(cfg.messages.prestayReminder, {
    shop: cfg.business.name,
    cat: b.catName,
    checkin: b.checkin || b.date || "",
    checkout: b.checkout ? `→ ${b.checkout}` : "",
    room: b.room ? `🏠 ห้อง: ${b.room}` : "",
    litterNote: litterNoteFor(b, cfg),
    consentUrl: "",
  });
}

/** ข้อความแจ้งรายละเอียดก่อนเข้าพัก (+ แนบลิงก์ยอมรับข้อตกลงถ้ามี) */
export function buildPrestayReminderText(
  b: Pick<StoredBooking, "catName" | "checkin" | "checkout" | "room" | "date">,
  cfg: SiteConfig,
  consentUrl: string
): string {
  let text = renderTemplate(cfg.messages.prestayReminder, {
    shop: cfg.business.name,
    cat: b.catName,
    checkin: b.checkin || b.date || "",
    checkout: b.checkout ? `→ ${b.checkout}` : "",
    room: b.room ? `🏠 ห้อง: ${b.room}` : "",
    consentUrl,
  });
  const invite = buildConsentInviteText(b, cfg, consentUrl);
  if (invite && consentUrl && !text.includes(consentUrl)) {
    text += `\n\n${invite}`;
  }
  return text;
}
