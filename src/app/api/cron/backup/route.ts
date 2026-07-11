import { NextRequest, NextResponse } from "next/server";
import { exportToGoogleSheets } from "@/lib/google-sheets-export";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** Backup อัตโนมัติทุกคืน — export ลูกค้า + รายรับรายจ่าย ลง Google Sheets */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await exportToGoogleSheets();

  if (result.ok) {
    await sendTelegram(
      formatBookingTelegram("💾 Backup อัตโนมัติสำเร็จ", {
        ลูกค้า: String(result.customers),
        รายการบัญชี: String(result.finance),
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

  return NextResponse.json(result);
}
