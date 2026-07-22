import { NextRequest, NextResponse } from "next/server";
import { sendInactiveFollowUps } from "@/lib/customer-crm";
import { sendTelegram } from "@/lib/telegram";
import { getSiteConfig } from "@/lib/config-store";
import { withTenant } from "@/lib/tenant-context";
import { listActiveTenantIds } from "@/lib/tenant-directory";

/** Cron — ส่งข้อความตามลูกค้าที่หายไปนาน (แนะนำ 09:00 น. ไทย) — รันแทนทุกร้าน */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  // fail-closed: ยังไม่ตั้ง CRON_SECRET = ห้ามรัน (ไม่ใช่เปิดโล่งให้คนนอกยิงสแปมลูกค้า/สั่ง export ได้)
  // ตั้ง CRON_SECRET ใน Vercel แล้ว Vercel Cron จะแนบ Bearer ให้เองอัตโนมัติ
  if (!secret || auth !== `Bearer ${secret}`) {
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
  const config = await getSiteConfig();
  const result = await sendInactiveFollowUps({ limit: 30 });

  if (result.sent > 0 || result.eligible > 0) {
    await sendTelegram(
      `😴 <b>ตามลูกค้าที่หายไป</b>\n` +
        `เกณฑ์: ${config.crm.inactiveDays} วัน\n` +
        `ส่งสำเร็จ: ${result.sent}/${result.total}\n` +
        `พร้อมส่ง: ${result.eligible} คน`
    );
  }

  return { ok: true, ...result };
}
