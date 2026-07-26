import { NextRequest, NextResponse } from "next/server";
import { exportToGoogleSheets } from "@/lib/google-sheets-export";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { withTenant } from "@/lib/tenant-context";
import { listActiveTenantIds } from "@/lib/tenant-directory";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Backup อัตโนมัติทุกคืน — ยกข้อมูลทั้งร้านลง Google Sheets
 * ลูกค้า+น้องแมว · รายรับรายจ่าย · การจอง · บิล · แต้มสะสม
 * รันแทนทุกร้านที่ยังใช้งานอยู่ (แต่ละร้านมี Google Sheets ของตัวเอง)
 */
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
  const result = await exportToGoogleSheets();

  if (result.ok) {
    await sendTelegram(
      formatBookingTelegram("💾 Backup อัตโนมัติสำเร็จ", {
        ลูกค้า: String(result.customers),
        การจอง: String(result.bookings),
        บิล: String(result.invoices),
        รายการบัญชี: String(result.finance),
        แต้มสะสม: String(result.points),
        ลิงก์: result.spreadsheetUrl || "-",
      })
    );
  } else if (result.reason !== "google_not_configured") {
    // มีการตั้งค่าแล้วแต่ backup พลาด → เตือน
    await sendTelegram(
      formatBookingTelegram("⚠️ Backup อัตโนมัติล้มเหลว", {
        เหตุผล: result.reason || "unknown",
      })
    );
  }

  return result;
}
