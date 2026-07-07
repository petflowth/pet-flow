import { NextRequest, NextResponse } from "next/server";
import { getAccount, redeemReward } from "@/lib/points-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

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
  const body = await req.json();
  const { lineUserId, rewardId, displayName } = body;

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
