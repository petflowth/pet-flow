import { NextRequest, NextResponse } from "next/server";
import { BUSINESS } from "@/lib/business";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  markInvoicePaid,
  revertInvoicePaid,
  markInvoiceSent,
  receiveDepositCredit,
  receiveInvoiceDeposit,
  updateInvoice,
  deleteInvoice,
  restoreInvoice,
  listTrashedInvoices,
} from "@/lib/invoices-store";
import { getCustomer } from "@/lib/customers-store";
import { issueCoupon, listCustomerCoupons } from "@/lib/coupons-store";
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
  buildReviewRequestFlex,
} from "@/lib/line";
import { renderTemplate } from "@/lib/messages";
import { redeemCoupon } from "@/lib/coupons-store";
import { consumePackage } from "@/lib/packages-store";
import { getBooking } from "@/lib/bookings-store";
import { bookingScheduleText } from "@/lib/booking-reminders";
import type { InvoiceRecord } from "@/lib/invoices-store";
import type { SiteConfig } from "@/lib/config-types";

type SummaryMode = "booking" | "deposit" | "full" | "remaining";

function summaryFlexFromInvoice(
  inv: InvoiceRecord,
  mode: SummaryMode,
  billing: SiteConfig["billing"],
  payment: { bankName: string; accountNumber: string; accountName: string },
  scheduleText?: string
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
    scheduleText,
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
  const bookingId = req.nextUrl.searchParams.get("bookingId") || undefined;

  if (id) {
    const inv = await getInvoice(id);
    if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      invoice: inv,
      payment: await getPaymentConfig(),
      mapsUrl: BUSINESS.maps,
    });
  }

  if (req.nextUrl.searchParams.get("trash") === "1") {
    return NextResponse.json({ invoices: await listTrashedInvoices() });
  }

  // หาบิลล่าสุดที่ผูกกับนัดนี้ (ใช้จากปุ่มส่งการ์ดในการ์ดนัด)
  if (bookingId) {
    const list = await listInvoices();
    const inv = list.find((i) => i.bookingId === bookingId);
    return NextResponse.json({ invoice: inv || null });
  }

  return NextResponse.json({ invoices: await listInvoices(customerId) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

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
    // ใช้คูปอง — mark used + ผูกกับบิลนี้ (ส่วนลดรวมใน extraDiscount แล้ว)
    if (body.couponId) {
      try {
        await redeemCoupon(String(body.couponId), invoice.id);
      } catch {
        /* คูปองใช้ไม่ได้/ไม่เจอ — ไม่ทำให้บิลพัง */
      }
    }
    // หักคอร์ส 1 ครั้ง (จ่ายไปแล้วตอนซื้อ — บิลนี้ไม่บันทึกรายรับเพิ่ม)
    if (body.packageId) {
      try {
        await consumePackage(String(body.packageId));
      } catch {
        /* คอร์สหมด/ไม่เจอ — ไม่ทำให้บิลพัง */
      }
    }
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
  const body = await req.json().catch(() => ({}));
  const { id, action } = body;
  const inv = await getInvoice(id);
  if (!inv) return NextResponse.json({ error: "not found" }, { status: 404 });

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
    const payment = await getPaymentConfig();

  // วัน/เวลานัด (จากนัดที่ผูกกับบิล) — แสดงในการ์ดสรุป
  const linkedBooking = inv.bookingId ? await getBooking(inv.bookingId) : null;
  const scheduleText = linkedBooking ? bookingScheduleText(linkedBooking) : undefined;

  if (action === "send_payment") {
    if (!inv.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    const deposit = inv.deposit || 0;
    // ถ้ามีมัดจำแล้ว → ส่งการ์ด "ยอดคงเหลือ" (ยอดค้างจริง) ไม่ใช่ยอดเต็มซ้ำ
    if (deposit > 0) {
      const billing = (await getSiteConfig()).billing;
      await pushLineMessage(inv.lineUserId, [
        summaryFlexFromInvoice(inv, "remaining", billing, payment, scheduleText),
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
      summaryFlexFromInvoice(inv, mode, billing, payment, scheduleText),
    ]);
    await markInvoiceSent(id);
    return NextResponse.json({ ok: true, kind: mode });
  }

  if (action === "send_review") {
    if (!inv.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    const cfg = await getSiteConfig();
    const biz = cfg.business;
    const reviewUrl = biz.reviewUrl || biz.maps;
    if (!reviewUrl) {
      return NextResponse.json({ error: "no_review_url" }, { status: 400 });
    }
    await pushLineMessage(inv.lineUserId, [
      buildReviewRequestFlex({
        title: "⭐ ขอบคุณที่ใช้บริการค่ะ",
        body: renderTemplate(cfg.messages.reviewRequest, {
          shop: biz.name,
          cat: inv.catName,
        }),
        reviewUrl,
        reviewLabel: biz.reviewButtonText,
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "unmark_paid") {
    const res = await revertInvoicePaid(id);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    await sendTelegram(
      formatBookingTelegram("↩️ ยกเลิกการชำระ (แก้ไข)", {
        ลูกค้า: inv.customerName,
        น้องแมว: inv.catName,
        บิล: inv.id,
        ยอด: `${inv.total} บาท`,
      })
    );
    return NextResponse.json({ ok: true, invoice: res.invoice });
  }

  if (action === "mark_paid") {
    const result = await markInvoicePaid(id, body.paymentMethod || "transfer");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const paid = result.invoice!;
    const customer = result.customer;
    const biz = (await getSiteConfig()).business;

    // รีวิวเฉพาะเมื่อใช้บริการแล้ว — บิลที่มี "ห้องพัก" (แม้จะพ่วงอาบน้ำ) ให้ยึดแบบโรงแรม
    // = รีวิวได้ต่อเมื่อเช็คเอาท์แล้ว · อาบน้ำล้วน = รีวิวได้เลย (บริการจบวันนั้น)
    const todayStr = new Date().toISOString().slice(0, 10);
    const billHasRoom = (paid.items || []).some((it) => /คืน|ห้อง/.test(it.label));
    let roomCheckout: string | undefined;
    if (paid.bookingId) {
      const linkedBooking = await getBooking(paid.bookingId);
      if (
        linkedBooking &&
        (linkedBooking.service === "room" || linkedBooking.checkin) &&
        linkedBooking.checkout
      ) {
        roomCheckout = linkedBooking.checkout;
      }
    }
    const showReview = billHasRoom
      ? roomCheckout
        ? roomCheckout <= todayStr
        : false
      : true;

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
          showReview,
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

    // ── ชวนเพื่อน: จ่ายคูปอง 100฿ x2 เมื่อเพื่อน "มาใช้บริการครั้งแรก" ──
    // (ตอนสมัครแค่บันทึก referredBy ไว้ ยังไม่จ่าย เพื่อกันปั๊มบัญชีปลอมรับคูปอง)
    if (customer?.referredBy) {
      try {
        const REWARD_TAG = "มาใช้บริการครั้งแรก";
        const mine = await listCustomerCoupons(customer.id);
        const alreadyRewarded = mine.some((c) => c.reason.includes(REWARD_TAG));
        if (!alreadyRewarded) {
          const referrer = await getCustomer(customer.referredBy);
          if (referrer && referrer.id !== customer.id) {
            await issueCoupon({
              customerId: customer.id,
              amount: 100,
              reason: `🎁 ${REWARD_TAG} (เพื่อนแนะนำ)`,
              expiresInDays: 60,
            });
            await issueCoupon({
              customerId: referrer.id,
              amount: 100,
              reason: `🎉 เพื่อนที่คุณชวน (${customer.name}) ${REWARD_TAG}แล้ว`,
              expiresInDays: 60,
            });
            if (referrer.lineUserId) {
              await pushLineMessage(referrer.lineUserId, [
                {
                  type: "text",
                  text: `🎉 เพื่อนที่คุณชวนมาใช้บริการแล้ว!\nคุณได้รับคูปองส่วนลด 100฿ เก็บไว้ในกระเป๋าคูปองแล้วนะคะ 🧡 (ใช้ได้ 60 วัน)`,
                },
              ]);
            }
            await sendTelegram(
              formatBookingTelegram("🎁 ชวนเพื่อนสำเร็จ (จ่ายคูปอง 100฿ x2)", {
                คนชวน: referrer.name,
                เพื่อนที่ชวนมา: customer.name,
                เหตุ: "เพื่อนมาใช้บริการครั้งแรก",
              })
            );
          }
        }
      } catch (e) {
        console.error("referral reward on first visit failed:", e);
      }
    }

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

  if (action === "restore") {
    await restoreInvoice(id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
