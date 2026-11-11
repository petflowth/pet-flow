import { NextRequest, NextResponse } from "next/server";
import { findCustomerByLine, getMemberCreditLedger } from "@/lib/customers-store";
import { withResolvedTenant } from "@/lib/tenant-context";
import { requireCustomerSession, noCustomerSessionResponse } from "@/lib/customer-session";
import { getSiteConfig } from "@/lib/config-store";
import { isFeatureOn } from "@/lib/features";

/** ลูกค้าเปิดดูประวัติเครดิต Member ของตัวเอง — เติมเมื่อไร ตัดไปกับอะไร คงเหลือเท่าไร */
export async function GET(req: NextRequest) {
  return withResolvedTenant(req, () => handleGet(req));
}

async function handleGet(req: NextRequest) {
  const session = await requireCustomerSession(req);
  if (!session) return noCustomerSessionResponse();
  if (!isFeatureOn(await getSiteConfig(), "memberCredit")) {
    return NextResponse.json({ entries: [], balance: 0 });
  }
  const customer = await findCustomerByLine(session.lineUserId);
  if (!customer) return NextResponse.json({ entries: [], balance: 0 });
  const balance = customer.memberCredit || 0;
  const entries = await getMemberCreditLedger(customer.id, balance);
  return NextResponse.json({ entries, balance });
}
