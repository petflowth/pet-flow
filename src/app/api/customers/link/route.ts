import { NextRequest, NextResponse } from "next/server";
import {
  getCustomerLinkPreview,
  linkCustomerToLine,
} from "@/lib/customers-store";

/** ดูข้อมูลลูกค้าก่อนผูก LINE (จากลิงก์เชิญ) */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId")?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  const preview = await getCustomerLinkPreview(customerId);
  if (!preview) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, customer: preview });
}

/** ลูกค้าเปิดลิงก์เชิญ → ผูก LINE กับบัญชีที่ร้านสร้างไว้ */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const customerId = String(body.customerId || "").trim();
  const lineUserId = String(body.lineUserId || "").trim();
  const displayName = String(body.displayName || "").trim();

  if (!customerId || !lineUserId) {
    return NextResponse.json(
      { error: "customerId and lineUserId required" },
      { status: 400 }
    );
  }

  const result = await linkCustomerToLine({ customerId, lineUserId, displayName });
  if (!result) {
    return NextResponse.json({ error: "link_failed" }, { status: 500 });
  }
  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: "ไม่พบลูกค้าในระบบ",
      already_linked: "ลูกค้ารายนี้ผูก LINE คนอื่นแล้ว",
      line_in_use: "บัญชี LINE นี้ผูกกับลูกค้าคนอื่นแล้ว",
    };
    return NextResponse.json(
      { error: messages[result.error] || result.error },
      { status: 409 }
    );
  }

  return NextResponse.json({
    ok: true,
    customer: {
      id: result.customer.id,
      name: result.customer.name,
      phone: result.customer.phone,
      cats: result.customer.cats,
      tier: result.customer.tier,
    },
  });
}
