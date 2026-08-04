import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getSiteConfig } from "@/lib/config-store";
import { pushLineMessage } from "@/lib/line";
import { getCustomer } from "@/lib/customers-store";
import { issueCoupon, listCustomerCoupons } from "@/lib/coupons-store";
import { buildBirthdayText } from "@/lib/birthday-greeting";
import {
  listPendingBirthdays,
  getBirthdayGreeting,
  markBirthdayStatus,
} from "@/lib/birthday-queue";
import { logAudit } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

/** รายการวันเกิดรอตรวจ พร้อมข้อความตัวอย่าง — ตรวจแล้วค่อยกดส่งจริงที่หน้านี้ */
export async function GET(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return withTenant(session.tenantId, async () => {
    const cfg = await getSiteConfig();
    const rows = await listPendingBirthdays();
    const preview = rows.map((r) => ({
      ...r,
      text: buildBirthdayText(r, cfg),
    }));
    return NextResponse.json({ rows: preview });
  });
}

/** ส่งการ์ดที่เลือก (แจกคูปองพร้อมกันตอนนี้) หรือข้ามใบที่ไม่ต้องการส่ง */
export async function POST(req: NextRequest) {
  const session = await getSessionFrom(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  return withTenant(session.tenantId, () => handlePost(req, session));
}

async function handlePost(
  req: NextRequest,
  session: { tenantId: string; name: string; role: string }
) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "dismiss") {
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await markBirthdayStatus(id, "dismissed");
    return NextResponse.json({ ok: true });
  }

  if (body.action === "send") {
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (ids.length === 0) return NextResponse.json({ error: "ids required" }, { status: 400 });

    const cfg = await getSiteConfig();
    const auto = cfg.automation;
    const year = new Date().toISOString().slice(0, 4);
    let sent = 0;
    let coupons = 0;
    const errors: string[] = [];

    for (const id of ids) {
      const row = await getBirthdayGreeting(id);
      if (!row || row.status !== "pending") continue;

      try {
        const customer = await getCustomer(row.customerId);
        if (!customer?.lineUserId) {
          errors.push(`${id}: ไม่มี LINE ผูกอยู่แล้ว`);
          continue;
        }

        // แจกคูปองวันเกิด (ครั้งเดียวต่อปี) — แจกตอนกดส่งจริงเท่านั้น ไม่ใช่ตอนคัดเข้าคิว
        let couponLine = "";
        const amt = Math.round(auto?.birthdayCouponAmount ?? 100);
        if (auto?.birthdayCouponEnabled !== false && amt > 0) {
          const mine = await listCustomerCoupons(row.customerId);
          const already = mine.some(
            (cp) => /วันเกิด/.test(cp.reason) && cp.createdAt.slice(0, 4) === year
          );
          if (!already) {
            await issueCoupon({
              customerId: row.customerId,
              amount: amt,
              reason: `🎂 ของขวัญวันเกิด ${year}`,
              expiresInDays: 30,
            });
            coupons++;
            couponLine = `\n\n🎁 ร้านมีของขวัญวันเกิดให้ — คูปองส่วนลด ${amt} บาท เก็บไว้ในกระเป๋าคูปองแล้วนะคะ (ใช้ได้ 30 วัน) 🎟️`;
          }
        }

        const text = buildBirthdayText(row, cfg) + couponLine;
        await pushLineMessage(customer.lineUserId, [{ type: "text", text }]);
        await markBirthdayStatus(id, "sent");
        sent++;
      } catch (e) {
        errors.push(`${id}: ${String(e)}`);
      }
    }

    await logAudit({
      tenantId: session.tenantId,
      actorType: "tenant",
      actorId: session.name || session.role || "ไม่ทราบ",
      action: "send_birthday_greetings",
      resourceType: "birthday",
      afterState: { ส่งสำเร็จ: sent, คูปอง: coupons, พลาด: errors.length },
    });

    return NextResponse.json({ ok: errors.length === 0, sent, coupons, errors });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
