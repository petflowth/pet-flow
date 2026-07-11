import { NextRequest, NextResponse } from "next/server";
import { BUSINESS } from "@/lib/business";
import { storeBroadcastImage } from "@/lib/broadcast-image-store";
import {
  listCustomersByTier,
  getBroadcastAudience,
  type CustomerTier,
} from "@/lib/customers-store";
import { listInactiveCustomers } from "@/lib/customer-crm";
import {
  buildBroadcastButtons,
  type BroadcastActionId,
} from "@/lib/line-broadcast";
import { buildPromoFlex, multicastLineMessage } from "@/lib/line";
import { getLineCredentials, getAppUrlFromEnv } from "@/lib/line-config";
import { TIER_LABELS } from "@/lib/customer-tier";

function checkAdmin(body: { adminCode?: string }) {
  const secret = process.env.NEXT_PUBLIC_ADMIN_CODE;
  return !secret || body.adminCode === secret;
}

async function resolveLineImageUrl(body: {
  imageData?: string;
  imageUrl?: string;
}): Promise<string | undefined> {
  if (body.imageData && body.imageData.startsWith("data:")) {
    const id = await storeBroadcastImage(body.imageData);
    const base = getAppUrlFromEnv() || "https://catcha-hotel-five.vercel.app";
    return `${base}/api/line/broadcast-image/${id}`;
  }
  if (body.imageUrl) {
    return String(body.imageUrl);
  }
  return undefined;
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
  const discountLabel = body.discountLabel
    ? String(body.discountLabel)
    : undefined;
  const actions = Array.isArray(body.actions)
    ? (body.actions as BroadcastActionId[])
    : [];

  if (!title || !message) {
    return NextResponse.json(
      { error: "กรอกหัวข้อและข้อความ" },
      { status: 400 }
    );
  }

  const breed = body.breed ? String(body.breed) : undefined;
  const inactiveDays = Number(body.inactiveDays) || 0;
  let customers = await listCustomersByTier(tier, { breed });
  if (inactiveDays > 0) {
    const inactive = await listInactiveCustomers(inactiveDays);
    const inactiveIds = new Set(inactive.map((r) => r.customer.id));
    customers = customers.filter((c) => inactiveIds.has(c.id));
  }
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

  const creds = await getLineCredentials();
  const base = getAppUrlFromEnv() || "";
  const promoUrl = `${base}/app/promos`;
  const imageUrl = await resolveLineImageUrl(body);
  const buttons = buildBroadcastButtons(actions, creds?.liffId);

  try {
    const flex = buildPromoFlex({
      title,
      body: message,
      imageUrl,
      promoUrl,
      discountLabel,
      buttons: buttons.length ? buttons : undefined,
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
  const breed = req.nextUrl.searchParams.get("breed") || undefined;
  const inactiveDays = Number(req.nextUrl.searchParams.get("inactiveDays")) || 0;
  const audience = await getBroadcastAudience(tier, { breed });
  let recipients = audience.recipients;
  const { skippedNoLine, skippedNoConsent } = audience;
  if (inactiveDays > 0) {
    const inactive = await listInactiveCustomers(inactiveDays);
    const inactiveIds = new Set(inactive.map((r) => r.customer.id));
    recipients = recipients.filter((c) => inactiveIds.has(c.id));
  }

  return NextResponse.json({
    tier,
    count: recipients.length,
    withLine: recipients.length,
    skippedNoLine: skippedNoLine.length,
    skippedNoConsent: skippedNoConsent.length,
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
