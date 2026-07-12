import { NextRequest, NextResponse } from "next/server";
import { getAccount, redeemReward, addPoints } from "@/lib/points-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage } from "@/lib/line";

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }

  const displayName = req.nextUrl.searchParams.get("displayName") || "";
  const account = await getAccount(lineUserId, displayName);

  return NextResponse.json({
    points: account.points,
    history: account.history,
    displayName: account.displayName,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { lineUserId, rewardId, displayName } = body;

  // เพิ่ม/ปรับแต้มด้วยมือจากหลังบ้าน (เช่น รีวิวแล้วรับแต้มฟรี) — บันทึกเหตุผลในประวัติ
  if (body.action === "admin_add") {
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
    if (amount > 0) {
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

  if (!lineUserId || !rewardId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const result = await redeemReward(lineUserId, rewardId, displayName || "");

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
