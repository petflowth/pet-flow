import { NextRequest, NextResponse } from "next/server";
import { BUSINESS } from "@/lib/business";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  markInvoiceSent,
} from "@/lib/invoices-store";
import { getCustomer } from "@/lib/customers-store";
import { getPaymentConfig } from "@/lib/payment-config";
import {
  pushLineMessage,
  buildPaymentFlex,
  buildReceiptFlex,
  buildMemberBalanceFlex,
} from "@/lib/line";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const customerId = req.nextUrl.searchParams.get("customerId") || undefined;

  if (id) {
    const inv = await getInvoice(id);
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      invoice: inv,
      payment: getPaymentConfig(),
      mapsUrl: BUSINESS.maps,
    });
  }

  return NextResponse.json({ invoices: await listInvoices(customerId) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (body.action === "create") {
    const invoice = await createInvoice({
      customerId: body.customerId,
      lineUserId: body.lineUserId,
      customerName: body.customerName,
      catName: body.catName,
      items: body.items,
      promoId: body.promoId,
      bookingId: body.bookingId,
    });
    return NextResponse.json({ ok: true, invoice });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, action } = body;
  const inv = await getInvoice(id);
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const payment = getPaymentConfig();

  if (action === "send_payment") {
    if (!inv.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    const payUrl = `${base}/app/pay/${inv.id}`;
    await pushLineMessage(inv.lineUserId, [
      buildPaymentFlex({
        invoiceId: inv.id,
        customerName: inv.customerName,
        catName: inv.catName,
        total: inv.total,
        items: inv.items,
        payUrl,
        bankName: payment.bankName,
        accountNumber: payment.accountNumber,
        accountName: payment.accountName,
      }),
    ]);
    await markInvoiceSent(id);
    return NextResponse.json({ ok: true, payUrl });
  }

  if (action === "mark_paid") {
    const result = await markInvoicePaid(id, body.paymentMethod || "transfer");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const paid = result.invoice!;
    const customer = result.customer;

    if (paid.lineUserId) {
      await pushLineMessage(paid.lineUserId, [
        buildReceiptFlex({
          invoiceId: paid.id,
          customerName: paid.customerName,
          catName: paid.catName,
          total: paid.total,
          pointsEarned: paid.pointsEarned || 0,
          paymentMethod:
            paid.paymentMethod === "member_credit"
              ? "Member Credit"
              : paid.paymentMethod === "cash"
                ? "เงินสด"
                : "โอนเงิน",
          mapsUrl: BUSINESS.maps,
        }),
      ]);

      if (customer?.isMember) {
        await pushLineMessage(paid.lineUserId, [
          buildMemberBalanceFlex({
            customerName: customer.name,
            memberCredit: customer.memberCredit,
            usedToday:
              paid.paymentMethod === "member_credit" ? paid.total : undefined,
            catName: paid.catName,
          }),
        ]);
      }
    }

    await sendTelegram(
      formatBookingTelegram("💰 รับชำระเงินแล้ว", {
        ลูกค้า: paid.customerName,
        น้องแมว: paid.catName,
        ยอด: `${paid.total} บาท`,
        แต้ม: String(paid.pointsEarned || 0),
      })
    );

    return NextResponse.json({ ok: true, invoice: paid });
  }

  if (action === "send_member_balance") {
    const customer = await getCustomer(inv.customerId);
    if (!customer?.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    await pushLineMessage(customer.lineUserId, [
      buildMemberBalanceFlex({
        customerName: customer.name,
        memberCredit: customer.memberCredit,
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
