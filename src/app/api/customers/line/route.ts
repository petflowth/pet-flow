import { NextRequest, NextResponse } from "next/server";
import { upsertCustomerFromLine } from "@/lib/customers-store";

/** ลูกค้าเปิดแอปจาก LINE → สร้าง/ผูกบัญชีอัตโนมัติ */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const lineUserId = String(body.lineUserId || "").trim();
  const displayName = String(body.displayName || "").trim();

  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }

  const customer = await upsertCustomerFromLine({ lineUserId, displayName });
  if (!customer) {
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      lineUserId: customer.lineUserId,
      lineDisplayName: customer.lineDisplayName,
      cats: customer.cats,
      isMember: customer.isMember,
      memberCredit: customer.memberCredit,
    },
  });
}
