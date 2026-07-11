import { NextRequest, NextResponse } from "next/server";
import { BUSINESS } from "@/lib/business";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  markInvoiceSent,
  receiveDepositCredit,
  receiveInvoiceDeposit,
  updateInvoice,
  deleteInvoice,
} from "@/lib/invoices-store";
import { getCustomer } from "@/lib/customers-store";
import { getPaymentConfig } from "@/lib/payment-config";
import { getSiteConfig } from "@/lib/config-store";
import {
  pushLineMessage,
  buildPaymentFlex,
  buildBillSummaryFlex,
  buildDepositRequestFlex,
  buildDepositThanksFlex,
  buildReceiptFlex,
  buildMemberBalanceFlex,
} from "@/lib/line";
import { renderTemplate } from "@/lib/messages";
import type { InvoiceRecord } from "@/lib/invoices-store";
import type { SiteConfig } from "@/lib/config-types";

type SummaryMode = "booking" | "deposit" | "full" | "remaining";

function summaryFlexFromInvoice(
  inv: InvoiceRecord,
  mode: SummaryMode,
  billing: SiteConfig["billing"],
  payment: { bankName: string; accountNumber: string; accountName: string }
) {
  const deposit = inv.deposit || 0;
  const remaining = Math.max(0, inv.total - deposit);
  const title =
    mode === "deposit"
      ? billing.summaryDepositTitle
      : mode === "full"
        ? billing.summaryFullTitle
        : mode === "remaining"
          ? "แจ้งยอดคงเหลือที่ต้องโอน"
          : billing.summaryBookingTitle;
  return buildBillSummaryFlex({
    mode,
    title,
    closing: "",
    customerName: inv.customerName,
    catName: inv.catName,
    items: inv.items,
    subtotal: inv.subtotal,
    discount: inv.discount,
    total: inv.total,
    deposit,
    remaining,
    bankName: payment.bankName,
    accountNumber: payment.accountNumber,
    accountName: payment.accountName,
  });
}
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const customerId = req.nextUrl.searchParams.get("customerId") || undefined;

  if (id) {
    const inv = await getInvoice(id);
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      invoice: inv,
      payment: await getPaymentConfig(),
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
      extraDiscount: body.extraDiscount,
      deposit: body.deposit,
      bookingId: body.bookingId,
    });
    return NextResponse.json({ ok: true, invoice });
  }

  if (body.action === "send_deposit_request") {
    const amount = Math.round(Number(body.amount) || 0);
    if (amount <= 0) {
      return NextResponse.json({ error: "bad_amount" }, { status: 400 });
    }
    const customer = await getCustomer(body.customerId);
    if (!customer?.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    const msgs = (await getSiteConfig()).messages;
    const payment = await getPaymentConfig();
    const catName = customer.cats[0]?.name || "น้องแมว";
    const pctNum = Number(body.pct) || 0;
    await pushLineMessage(customer.lineUserId, [
      buildDepositRequestFlex({
        title: msgs.depositRequestTitle,
        body: renderTemplate(msgs.depositRequestBody, {
          name: customer.name,
          cat: catName,
          amount: amount.toLocaleString(),
          pct: pctNum > 0 ? ` ${pctNum}% ของค่าบริการ` : "",
        }),
        amount,
        bankName: payment.bankName,
        accountNumber: payment.accountNumber,
        accountName: payment.accountName,
        note: body.note ? String(body.note) : undefined,
        percentNote: body.percentNote ? String(body.percentNote) : undefined,
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "receive_deposit_credit") {
    const res = await receiveDepositCredit(
      body.customerId,
      Number(body.amount) || 0,
      body.note ? String(body.note) : undefined,
      body.paymentMethod === "cash" ? "cash" : "transfer"
    );
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    const customer = await getCustomer(body.customerId);
    // แจ้ง Telegram เพื่อกระทบยอด + ส่งการ์ดยืนยันรับมัดจำให้ลูกค้า
    await sendTelegram(
      formatBookingTelegram("💰 รับมัดจำล่วงหน้า", {
        ลูกค้า: customer?.name || body.customerId,
        มัดจำ: `${res.amount} บาท`,
        เครดิตมัดจำคงเหลือ: `${res.balance} บาท`,
        ...(body.note ? { หมายเหตุ: String(body.note) } : {}),
      })
    );
    if (customer?.lineUserId) {
      const msgs = (await getSiteConfig()).messages;
      const catName = customer.cats[0]?.name || "น้องแมว";
      await pushLineMessage(customer.lineUserId, [
        buildDepositThanksFlex({
          title: msgs.depositThanksTitle,
          body: renderTemplate(msgs.depositThanksBody, {
            name: customer.name,
            cat: catName,
            amount: res.amount.toLocaleString(),
          }),
          terms: msgs.depositTerms || [],
          amount: res.amount,
          note: body.note ? String(body.note) : undefined,
          percentNote: body.percentNote ? String(body.percentNote) : undefined,
        }),
      ]);
    }
    return NextResponse.json({ ok: true, balance: res.balance, needSql: res.needSql });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, action } = body;
  const inv = await getInvoice(id);
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
    const payment = await getPaymentConfig();

  if (action === "send_payment") {
    if (!inv.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    const deposit = inv.deposit || 0;
    // ถ้ามีมัดจำแล้ว → ส่งการ์ด "ยอดคงเหลือ" (ยอดค้างจริง) ไม่ใช่ยอดเต็มซ้ำ
    if (deposit > 0) {
      const billing = (await getSiteConfig()).billing;
      await pushLineMessage(inv.lineUserId, [
        summaryFlexFromInvoice(inv, "remaining", billing, payment),
      ]);
      await markInvoiceSent(id);
      return NextResponse.json({ ok: true, kind: "remaining" });
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

  if (action === "send_summary") {
    if (!inv.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    const mode = (body.mode as SummaryMode) || "booking";
    const billing = (await getSiteConfig()).billing;
    await pushLineMessage(inv.lineUserId, [
      summaryFlexFromInvoice(inv, mode, billing, payment),
    ]);
    await markInvoiceSent(id);
    return NextResponse.json({ ok: true, kind: mode });
  }

  if (action === "mark_paid") {
    const result = await markInvoicePaid(id, body.paymentMethod || "transfer");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const paid = result.invoice!;
    const customer = result.customer;
    const biz = (await getSiteConfig()).business;

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
          mapsUrl: biz.maps || BUSINESS.maps,
          reviewUrl: biz.reviewUrl,
          reviewLabel: biz.reviewButtonText,
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

    const gotDeposit = (result.alreadyReceived || 0) > 0;
    await sendTelegram(
      formatBookingTelegram(
        gotDeposit ? "💰 รับยอดคงเหลือแล้ว (ปิดบิล)" : "💰 รับชำระเงินแล้ว",
        {
          ลูกค้า: paid.customerName,
          น้องแมว: paid.catName,
          ...(gotDeposit
            ? {
                มัดจำที่รับไปแล้ว: `${result.alreadyReceived} บาท`,
                ยอดคงเหลือรอบนี้: `${result.settleAmount} บาท`,
                รวมทั้งบิล: `${paid.total} บาท`,
              }
            : { ยอด: `${paid.total} บาท` }),
          แต้ม: String(paid.pointsEarned || 0),
        }
      )
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

  if (action === "receive_deposit") {
    const res = await receiveInvoiceDeposit(id);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    await sendTelegram(
      formatBookingTelegram("💰 รับมัดจำแล้ว", {
        ลูกค้า: inv.customerName,
        น้องแมว: inv.catName,
        มัดจำ: `${res.deposit} บาท`,
        คงเหลือ: `${res.remaining} บาท`,
        บิล: inv.id,
      })
    );
    // ส่งการ์ดขอบคุณ + เงื่อนไข ให้ลูกค้า
    if (inv.lineUserId) {
      const msgs = (await getSiteConfig()).messages;
      await pushLineMessage(inv.lineUserId, [
        buildDepositThanksFlex({
          title: msgs.depositThanksTitle,
          body: renderTemplate(msgs.depositThanksBody, {
            name: inv.customerName,
            cat: inv.catName,
            amount: res.deposit.toLocaleString(),
          }),
          terms: msgs.depositTerms || [],
          amount: res.deposit,
        }),
      ]);
    }
    return NextResponse.json({ ok: true, deposit: res.deposit, remaining: res.remaining });
  }

  if (action === "update") {
    const res = await updateInvoice(id, {
      items: body.items,
      deposit: body.deposit,
      extraDiscount: body.extraDiscount,
      promoId: body.promoId,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, invoice: res.invoice });
  }

  if (action === "delete") {
    const res = await deleteInvoice(id);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
