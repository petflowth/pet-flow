import { NextRequest, NextResponse } from "next/server";
import {
  findCustomerByLine,
  upsertCustomerFromLine,
} from "@/lib/customers-store";
import { isProfileComplete } from "@/lib/customer-tier";
import type { CatRecord } from "@/lib/customers-store";

/** ตัด staffPrivateNote (โน้ตลับร้าน) ออกก่อนส่งให้ฝั่งลูกค้าเสมอ */
function catsForCustomer(cats: CatRecord[]) {
  return cats.map((cat) => {
    const rest = { ...cat };
    delete rest.staffPrivateNote;
    return rest;
  });
}

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
      phone: customer.phone,
      lineUserId: customer.lineUserId,
      lineDisplayName: customer.lineDisplayName,
      cats: catsForCustomer(customer.cats),
      isMember: customer.isMember,
      memberCredit: customer.memberCredit,
      tier: customer.tier,
    },
    needsRegistration: !isProfileComplete(customer),
  });
}

export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")?.trim();
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }

  const customer = await findCustomerByLine(lineUserId);
  if (!customer) {
    return NextResponse.json({ found: false, needsRegistration: true });
  }

  return NextResponse.json({
    found: true,
    needsRegistration: !isProfileComplete(customer),
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      cats: catsForCustomer(customer.cats),
      tier: customer.tier,
    },
  });
}
