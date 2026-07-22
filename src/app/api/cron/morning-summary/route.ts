import { NextRequest, NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram";
import { buildMorningSummaryMessage } from "@/lib/telegram-commands";
import { withTenant } from "@/lib/tenant-context";
import { listActiveTenantIds } from "@/lib/tenant-directory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron 08:00 น. ไทย (01:00 UTC) — สรุปเช้า: งานของวันนี้ทั้งหมด ส่งเข้า Telegram เจ้าของ — รันแทนทุกร้าน */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
  const msg = await buildMorningSummaryMessage(today);
  const res = await sendTelegram(msg);
  return { ok: res.ok, today };
}
