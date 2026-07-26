import { NextRequest, NextResponse } from "next/server";
import { getAccount, redeemReward, addPoints, deletePointsHistoryEntry } from "@/lib/points-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage } from "@/lib/line";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withResolvedTenant, withTenant } from "@/lib/tenant-context";
import { requireCustomerSession } from "@/lib/customer-session";

async function getAdminSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  // แอดมินดูแต้มของลูกค้าคนไหนก็ได้ (มี session หลังบ้านรับรองแล้ว) — เชื่อ query ได้
  if (session) {
    const lineUserId = req.nextUrl.searchParams.get("lineUserId");
    if (!lineUserId) {
      return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
    }
    return withTenant(session.tenantId, () => handleGet(req, lineUserId));
  }
  // ลูกค้าเปิดเอง — ต้องมีคุกกี้เซสชันที่ตรวจกับ LINE แล้วจริง ห้ามเชื่อ query lineUserId
  return withResolvedTenant(req, () => handleCustomerGet(req));
}

async function handleCustomerGet(req: NextRequest) {
  const customerSession = await requireCustomerSession(req);
  if (!customerSession) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return handleGet(req, customerSession.lineUserId);
}

async function handleGet(req: NextRequest, lineUserId: string) {
  const displayName = req.nextUrl.searchParams.get("displayName") || "";
  const customerId = req.nextUrl.searchParams.get("customerId") || undefined;
  const account = await getAccount(lineUserId, displayName, customerId);

  return NextResponse.json({
    points: account.points,
    history: account.history,
    displayName: account.displayName,
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (session) return withTenant(session.tenantId, () => handlePost(req, true));
  return withResolvedTenant(req, () => handlePost(req, false));
}

async function handlePost(req: NextRequest, isAdmin: boolean) {
  const body = await req.json().catch(() => ({}));
  const { rewardId, displayName } = body;
  let lineUserId = String(body.lineUserId || "").trim();

  // ลบประวัติแต้ม 1 รายการ (กดผิด/ลงซ้ำ) — ปรับยอดคงเหลือย้อนกลับให้เอง ต้องเป็นพนักงานเท่านั้น
  if (body.action === "delete_history") {
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const entryId = String(body.entryId || "").trim();
    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }
    const res = await deletePointsHistoryEntry(entryId);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true, points: res.points });
  }

  // เพิ่ม/ปรับแต้มด้วยมือจากหลังบ้าน (เช่น รีวิวแล้วรับแต้มฟรี) — บันทึกเหตุผลในประวัติ
  // route นี้เปิดให้แอปลูกค้าเรียกตรงๆ ได้ (ดูแต้ม/แลกรางวัล) แต่ action นี้ปรับแต้มลูกค้าคนไหนก็ได้
  // ตามใจ ต้องเป็นพนักงานหลังบ้านเท่านั้น ไม่งั้นใครก็เติมแต้มให้ตัวเองฟรีได้
  if (body.action === "admin_add") {
    if (!isAdmin) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const uid = String(lineUserId || "").trim();
    const amount = Math.round(Number(body.amount) || 0);
    const reason = String(body.reason || "").trim() || "แต้มพิเศษจากร้าน";
    if (!uid || amount === 0) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    const label = amount > 0 ? `🎁 ${reason}` : `ปรับแต้ม: ${reason}`;
    const acc = await addPoints(uid, amount, label, label, displayName || "");
    await sendTelegram(
      formatBookingTelegram(
        amount > 0 ? "🎁 เพิ่มแต้มให้ลูกค้า (มือ)" : "➖ ปรับลดแต้มลูกค้า (มือ)",
        {
          ลูกค้า: acc.displayName || uid,
          แต้ม: `${amount > 0 ? "+" : ""}${amount}`,
          เหตุผล: reason,
          แต้มคงเหลือ: String(acc.points),
        }
      )
    );
    // ปกติเงียบ ๆ — เพิ่มแต้มหลังบ้านไม่ต้องรบกวนลูกค้า (และไม่เสียโควตาข้อความ)
    // จะแจ้งก็ต่อเมื่อกดติ๊ก "แจ้งลูกค้าทาง LINE" ในหน้าหลังบ้าน
    if (amount > 0 && body.notify === true) {
      try {
        await pushLineMessage(uid, [
          {
            type: "text",
            text: `🎁 คุณได้รับ ${amount} แต้มฟรี!\nเหตุผล: ${reason}\nแต้มสะสมรวม ${acc.points} แต้ม ขอบคุณนะคะ 🧡`,
          },
        ]);
      } catch {
        /* ไม่มี LINE ก็ไม่เป็นไร — แต้มถูกบันทึกแล้ว */
      }
    }
    return NextResponse.json({ ok: true, points: acc.points });
  }

  // แลกรางวัลเอง — ต้องมีคุกกี้เซสชันที่ตรวจกับ LINE แล้วจริง ห้ามเชื่อ lineUserId จาก body
  // (ไม่งั้นใครก็ใส่ lineUserId ของคนอื่นแล้วแลกแต้มแทนได้)
  if (!isAdmin) {
    const customerSession = await requireCustomerSession(req);
    if (!customerSession) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    lineUserId = customerSession.lineUserId;
  }

  if (!lineUserId || !rewardId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const result = await redeemReward(
    lineUserId,
    rewardId,
    displayName || "",
    body.customerId ? String(body.customerId) : undefined
  );

  if (!result.ok) {
    const msg =
      result.error === "insufficient_points"
        ? "แต้มไม่พอ"
        : "รางวัลไม่ถูกต้อง";
    return NextResponse.json({ error: result.error, message: msg }, { status: 400 });
  }

  await sendTelegram(
    formatBookingTelegram("🎁 ลูกค้าแลกแต้ม", {
      ลูกค้า: result.account.displayName || lineUserId,
      รางวัล: result.reward.reward.th,
      คูปอง: result.couponCode,
      แต้มคงเหลือ: String(result.account.points),
    })
  );

  return NextResponse.json({
    ok: true,
    points: result.account.points,
    couponCode: result.couponCode,
    reward: result.reward,
    history: result.account.history,
  });
}
