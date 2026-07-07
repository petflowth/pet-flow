import { NextRequest, NextResponse } from "next/server";
import {
  listCustomers,
  searchCustomers,
  getCustomer,
  updateCustomer,
  updateCat,
  addMemberCredit,
  upsertCustomerFromBooking,
  customerSummary,
} from "@/lib/customers-store";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const q = req.nextUrl.searchParams.get("q");

  if (id) {
    const summary = customerSummary(id);
    if (!summary) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(summary);
  }

  const list = q ? searchCustomers(q) : listCustomers();
  return NextResponse.json({ customers: list });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customer = upsertCustomerFromBooking({
    customerName: body.customerName,
    catName: body.catName,
    lineUserId: body.lineUserId,
    phone: body.phone,
    staffNote: body.staffNote,
  });
  return NextResponse.json({ ok: true, customer });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, action } = body;

  if (action === "update_customer") {
    const c = updateCustomer(id, body.patch);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "update_cat") {
    const c = updateCat(id, body.catId, body.patch);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "topup_member") {
    const c = addMemberCredit(id, Number(body.amount) || 0);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "set_member") {
    const c = updateCustomer(id, {
      isMember: Boolean(body.isMember),
      memberCredit: Number(body.memberCredit) || 0,
    });
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  const c = getCustomer(id);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ customer: c });
}
