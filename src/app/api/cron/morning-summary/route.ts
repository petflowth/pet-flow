import { NextRequest, NextResponse } from "next/server";
import { sendTelegram, SHOP_NAME_TOKEN } from "@/lib/telegram";
import { buildMorningSummaryMessage, sendPerBranch } from "@/lib/telegram-commands";
import { withTenant } from "@/lib/tenant-context";
import { listActiveTenantIds } from "@/lib/tenant-directory";
import { verifyCronSecret } from "@/lib/cron-auth";
import { buildTransportSummaryMessage } from "@/lib/transport-summary";
import { listBookings } from "@/lib/bookings-store";
import { listCustomers } from "@/lib/customers-store";
import { getSiteConfig } from "@/lib/config-store";
import { isFeatureOn } from "@/lib/features";
import { bookingIntakeAnswers, formatIntakeTelegram, intakeBookingsForDate } from "@/lib/intake-answers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron 08:00 น. ไทย (01:00 UTC) — สรุปเช้า: งานของวันนี้ทั้งหมด ส่งเข้า Telegram เจ้าของ — รันแทนทุกร้าน */
export async function GET(req: NextRequest) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;

  const tenantIds = await listActiveTenantIds();
  const results = await Promise.all(
    tenantIds.map(async (tenantId) => {
      try {
        return { tenantId, ...(await withTenant(tenantId, runForTenant)) };
      } catch (e) {
        return { tenantId, ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    })
  );
  return NextResponse.json({ ok: true, tenants: results.length, results });
}

async function runForTenant() {
  const today = new Date().toISOString().slice(0, 10);
  // ร้านหลายสาขา: สรุปแยกสาขาละข้อความ (เข้ากลุ่มของร้าน + กลุ่มของสาขานั้นถ้าตั้งไว้)
  const res = await sendPerBranch((branchId) => buildMorningSummaryMessage(today, branchId));
  // แยกข้อความรับ-ส่งไว้อีกข้อความ ส่งต่อให้คนขับได้ทั้งก้อน — ไม่มีเที่ยว = ไม่ส่ง
  const transport = await buildTransportSummaryMessage(today, {
    heading: `🚗 รับ-ส่งวันนี้ (${today})`,
  });
  if (transport) await sendTelegram(transport);
  const intake = await sendIntakeAnswers(today).catch(() => 0);
  return { ok: res.ok, today, intake };
}

/**
 * คำตอบทุกข้อที่ลูกค้ากรอกไว้ (ก่อนอาบน้ำ / ก่อนเข้าพัก) — 1 ข้อความต่อ 1 นัดของวันนี้
 * ร้านไม่ต้องย้อนหาข้อความตอนลูกค้าตอบ · ร้านปิดได้ที่ ตั้งค่า › เปิด/ปิดฟีเจอร์
 */
async function sendIntakeAnswers(today: string) {
  const config = await getSiteConfig();
  if (!isFeatureOn(config, "intakeDaySummary")) return 0;
  if (!isFeatureOn(config, "groomInfo") && !isFeatureOn(config, "stayInfo")) return 0;
  const list = await listBookings();
  const todays = intakeBookingsForDate(list, today);
  if (!todays.length) return 0;
  const customers = await listCustomers().catch(() => undefined);
  let sent = 0;
  for (const b of todays) {
    const answers = await bookingIntakeAnswers(b, { list, customers, config });
    if (!answers.sections.length) continue;
    const r = await sendTelegram(`🐾 <b>${SHOP_NAME_TOKEN}</b>\n${formatIntakeTelegram(b, answers, today)}`, { booking: b });
    if (r.ok) sent++;
    // กลุ่ม Telegram รับได้ ~20 ข้อความ/นาที — เว้นจังหวะกันโดนบล็อก
    await new Promise((res) => setTimeout(res, 1100));
  }
  return sent;
}
