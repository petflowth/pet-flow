import { getLineCredentials } from "./line-config";
import { buildConsentUrl } from "./liff-urls";
import { renderTemplate } from "./messages";
import type { StoredBooking } from "./bookings-store";
import type { InvoiceRecord } from "./invoices-store";
import type { SiteConfig } from "./config-types";

/**
 * ตัวสร้างข้อความเตือนลูกค้า — ใช้ร่วมกันทั้ง "cron อัตโนมัติ" และ "ปุ่มกดส่งเอง"
 * เพื่อให้แก้ข้อความที่เดียว (Settings) แล้วมีผลทุกที่
 */

/** ลิงก์หน้ายอมรับข้อตกลง (คืน "" ถ้ายังไม่ได้ตั้ง LIFF ID) */
export async function getConsentUrl(): Promise<string> {
  const liffId = (await getLineCredentials())?.liffId;
  return liffId ? buildConsentUrl(liffId) : "";
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
