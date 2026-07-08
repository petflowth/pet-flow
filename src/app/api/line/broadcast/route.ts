import { NextRequest, NextResponse } from "next/server";
import { BUSINESS } from "@/lib/business";
import { listCustomersByTier, getBroadcastAudience, type CustomerTier } from "@/lib/customers-store";
import { buildPromoFlex, multicastLineMessage } from "@/lib/line";
import { TIER_LABELS } from "@/lib/customer-tier";

function checkAdmin(body: { adminCode?: string }) {
  const secret = process.env.NEXT_PUBLIC_ADMIN_CODE;
  return !secret || body.adminCode === secret;
}

/** ส่งโปรโมชั่น / ข้อความไปยังกลุ่มลูกค้าตามระดับ */
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!checkAdmin(body)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tier = (body.tier || "all") as CustomerTier | "all";
  const title = String(body.title || "").trim();
  const message = String(body.body || "").trim();
  const imageUrl = body.imageUrl ? String(body.imageUrl) : undefined;
  const discountLabel = body.discountLabel
    ? String(body.discountLabel)
    : undefined;

  if (!title || !message) {
    return NextResponse.json(
      { error: "กรอกหัวข้อและข้อความ" },
      { status: 400 }
    );
  }

  const customers = await listCustomersByTier(tier);
  const lineIds = customers
    .map((c) => c.lineUserId)
    .filter((id): id is string => Boolean(id));

  if (lineIds.length === 0) {
    return NextResponse.json({
      ok: true,
      sent: 0,
      message: "ไม่มีลูกค้าในกลุ่มนี้ที่ผูก LINE",
    });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const promoUrl = `${base}/app/promos`;

  try {
    const flex = buildPromoFlex({
      title,
      body: message,
      imageUrl,
      promoUrl,
      discountLabel,
    });
    const result = await multicastLineMessage(lineIds, [flex]);
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      tier: tier === "all" ? "ทุกระดับ" : TIER_LABELS[tier],
      maps: BUSINESS.maps,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const tier = (req.nextUrl.searchParams.get("tier") || "all") as
    | CustomerTier
    | "all";
  const { recipients, skippedNoLine } = await getBroadcastAudience(tier);

  return NextResponse.json({
    tier,
    count: recipients.length,
    withLine: recipients.length,
    skippedNoLine: skippedNoLine.length,
    recipients: recipients.map((c) => ({
      id: c.id,
      name: c.name,
      lineDisplayName: c.lineDisplayName,
      cats: c.cats.map((cat) => cat.name).join(", ") || "—",
      tier: c.tier,
    })),
    skipped: skippedNoLine.slice(0, 20).map((c) => ({
      id: c.id,
      name: c.name,
      cats: c.cats.map((cat) => cat.name).join(", ") || "—",
      reason: "ยังไม่ผูก LINE",
    })),
  });
}
