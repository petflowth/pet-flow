import { NextRequest, NextResponse } from "next/server";
import {
  listCustomersWithAppointmentCounts,
  searchCustomers,
  getCustomer,
  updateCustomer,
  updateCat,
  addCat,
  deleteCat,
  topupMemberCredit,
  upsertCustomerFromBooking,
  customerSummary,
} from "@/lib/customers-store";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const q = req.nextUrl.searchParams.get("q");

  if (id) {
    const summary = await customerSummary(id);
    if (!summary) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(summary);
  }

  if (q) {
    const customers = await searchCustomers(q);
    return NextResponse.json({ customers });
  }
  const customers = await listCustomersWithAppointmentCounts();
  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customer = await upsertCustomerFromBooking({
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
    const c = await updateCustomer(id, body.patch);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "update_cat") {
    const c = await updateCat(id, body.catId, body.patch);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "add_cat") {
    try {
      const c = await addCat(id, {
        name: String(body.name || ""),
        staffNote: body.staffNote ? String(body.staffNote) : undefined,
      });
      if (!c) {
        return NextResponse.json({ error: "กรอกชื่อน้องแมว" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, customer: c });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "เพิ่มแมวไม่สำเร็จ" },
        { status: 500 }
      );
    }
  }

  if (action === "delete_cat") {
    try {
      const c = await deleteCat(id, String(body.catId || ""));
      if (!c) {
        return NextResponse.json({ error: "ไม่พบน้องแมว" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, customer: c });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" },
        { status: 500 }
      );
    }
  }

  if (action === "topup_member") {
    const paidAmount =
      body.paidAmount != null
        ? Number(body.paidAmount)
        : Number(body.amount) || 0;
    const bonusAmount = Number(body.bonusAmount) || 0;
    const result = await topupMemberCredit(id, {
      paidAmount,
      bonusAmount,
      note: body.note,
    });
    if (!result) {
      return NextResponse.json({ error: "invalid_topup" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      customer: result.customer,
      topup: result.topup,
    });
  }

  if (action === "set_member") {
    const c = await updateCustomer(id, {
      isMember: Boolean(body.isMember),
      memberCredit: Number(body.memberCredit) || 0,
    });
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  const c = await getCustomer(id);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ customer: c });
}
