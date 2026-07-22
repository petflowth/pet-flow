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
  linkInvoiceToBooking,
} from "@/lib/invoices-store";
import {
  getCustomer,
  adjustDepositCredit,
  findCustomerForBooking,
} from "@/lib/customers-store";
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
  reviewMessageFor,
} from "@/lib/line";
import { renderTemplate } from "@/lib/messages";
import { redeemCoupon } from "@/lib/coupons-store";
import { consumePackage } from "@/lib/packages-store";
import { getBooking } from "@/lib/bookings-store";
import { bookingScheduleText } from "@/lib/booking-reminders";
import type { InvoiceRecord } from "@/lib/invoices-store";
import type { SiteConfig, CardStyleConfig } from "@/lib/config-types";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withResolvedTenant, withTenant } from "@/lib/tenant-context";

async function getAdminSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

type SummaryMode = "booking" | "deposit" | "full" | "remaining";

/**
 * ส่งการ์ดให้ลูกค้าแบบ "ส่งไม่ได้ก็ไม่ล้มรายการเงิน"
 *
 * เมื่อก่อนถ้ายังไม่ได้ตั้ง LINE (หรือ LINE ล่ม) การ push จะ throw ออกไปเป็น 500
 * ทั้งที่เงินถูกบันทึกไปแล้ว → ร้านเห็น error เลยกดซ้ำ กลายเป็นรับเงิน/หักเครดิตซ้ำ
 * ตอนนี้คืน error กลับไปเป็นข้อความเตือนแทน รายการเงินยังสำเร็จเสมอ
 */
async function notifyCustomer(
  lineUserId: string | undefined | null,
  messages: object[]
): Promise<string | undefined> {
  if (!lineUserId) return undefined;
  try {
    await pushLineMessage(lineUserId, messages);
    return undefined;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

function summaryFlexFromInvoice(
  inv: InvoiceRecord,
  mode: SummaryMode,
  billing: SiteConfig["billing"],
  payment: { bankName: string; accountNumber: string; accountName: string },
  scheduleText?: string,
  cardStyle?: CardStyleConfig
) {
  const deposit = inv.deposit || 0;
  const remaining = Math.max(0, inv.total - deposit);
  const title =
    mode === "deposit"
      ? billing.summaryDepositTitle
      : mode === "full"
        ? billing.summaryFullTitle
        : mode === "remaining"
          ? cardStyle?.texts?.remainingTitle || "แจ้งยอดคงเหลือที่ต้องโอน"
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
  }, cardStyle);
}
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const session = await getAdminSession(req);
  // ไม่ได้ล็อกอิน = แอปลูกค้า (หน้าจ่ายเงิน) → ดูได้เฉพาะบิลที่ระบุ id เท่านั้น
  if (!session && !id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (session) return withTenant(session.tenantId, () => handleGet(req, id));
  return withResolvedTenant(req, () => handleGet(req, id));
}

async function handleGet(req: NextRequest, id: string | null) {
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

  // หาบิลที่ผูกกับนัดนี้ (ใช้จากปุ่มส่งการ์ดในการ์ดนัด)
  // ถ้านัดนี้มีหลายบิล (เช่นออกบิลใหม่ทับของเดิม) ให้เอาบิลที่ยังไม่จ่ายก่อนเสมอ
  // ไม่งั้นมัดจำที่เรียกเก็บจะไปผูกกับบิลเก่าที่จ่ายจบไปแล้ว แล้วบิลใหม่จะไม่เห็นมัดจำนั้นเลย
  if (bookingId) {
    const list = await listInvoices();
    const matches = list.filter((i) => i.bookingId === bookingId);
    const inv = matches.find((i) => i.status !== "paid") || matches[0];
    return NextResponse.json({ invoice: inv || null });
  }

  return NextResponse.json({ invoices: await listInvoices(customerId) });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body.action === "create") {
    // หักคอร์สก่อนออกบิล — ต้องรู้ให้แน่ว่าหักได้จริงถึงจะผูกคอร์สกับบิลใบนี้
    // consumePackage คืนผลลัพธ์ ไม่ได้ throw ถ้าคอร์สหมด ถ้าเช็คแค่ try/catch
    // คอร์สที่ใช้ครบแล้วจะยังออกบิลฟรีให้ได้อยู่
    let consumedPackageId: string | undefined;
    if (body.packageId) {
      try {
        const used = await consumePackage(String(body.packageId));
        if (used.ok) consumedPackageId = String(body.packageId);
      } catch {
        /* คอร์สไม่เจอ — ออกบิลต่อได้ แต่ไม่ผูกคอร์ส */
      }
      if (!consumedPackageId) {
        return NextResponse.json({ error: "package_unavailable" }, { status: 400 });
      }
    }

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
      packageId: consumedPackageId,
    });
    // ใช้คูปอง — mark used + ผูกกับบิลนี้ (ส่วนลดรวมใน extraDiscount แล้ว)
    if (body.couponId) {
      try {
        await redeemCoupon(String(body.couponId), invoice.id);
      } catch {
        /* คูปองใช้ไม่ได้/ไม่เจอ — ไม่ทำให้บิลพัง */
      }
    }
    if (invoice.autoAppliedCredit > 0) {
      await sendTelegram(
        formatBookingTelegram("💰 หักมัดจำล่วงหน้าเข้าบิลอัตโนมัติ", {
          ลูกค้า: invoice.customerName,
          น้องแมว: invoice.catName,
          มัดจำที่หักให้: `${invoice.autoAppliedCredit} บาท`,
          บิล: invoice.id,
          หมายเหตุ: "เคยเรียกเก็บมัดจำไว้ก่อนออกบิล — ระบบหักให้แล้ว",
        })
      );
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
    // ผูกมัดจำให้ทันทีที่เรียกเก็บ ไม่ว่าจะกดจากที่ไหน:
    // - มีบิลอยู่แล้ว → ผูกเข้าบิลนั้นเลย (โผล่ปุ่ม "รับมัดจำแล้ว" + หักยอดคงเหลือถูกต้อง)
    // - ยังไม่มีบิล → พักไว้เป็นเครดิตมัดจำล่วงหน้าของลูกค้า จะหักอัตโนมัติตอนออกบิลถัดไป
    const linkInvoiceId = body.invoiceId ? String(body.invoiceId) : undefined;
    if (linkInvoiceId) {
      await updateInvoice(linkInvoiceId, { deposit: amount });
    } else {
      await adjustDepositCredit(body.customerId, amount);
    }
    const cfgDep = await getSiteConfig();
    const msgs = cfgDep.messages;
    const payment = await getPaymentConfig();
    const catName = customer.cats[0]?.name || "น้องแมว";
    const pctNum = Number(body.pct) || 0;
    const notifyErr = await notifyCustomer(customer.lineUserId, [
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
      }, cfgDep.cards?.depositRequest),
    ]);
    return NextResponse.json({ ok: true, notifyError: notifyErr });
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
    let dtNotifyErr: string | undefined;
    if (customer?.lineUserId) {
      const cfgDt = await getSiteConfig();
      const msgs = cfgDt.messages;
      const catName = customer.cats[0]?.name || "น้องแมว";
      dtNotifyErr = await notifyCustomer(customer.lineUserId, [
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
        }, cfgDt.cards?.depositThanks),
      ]);
    }
    return NextResponse.json({
      ok: true,
      balance: res.balance,
      needSql: res.needSql,
      notifyError: dtNotifyErr,
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePatch(req));
}

async function handlePatch(req: NextRequest) {
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
      const cfgRem = await getSiteConfig();
      await pushLineMessage(inv.lineUserId, [
        summaryFlexFromInvoice(inv, "remaining", cfgRem.billing, payment, scheduleText, cfgRem.cards?.billSummary),
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
      }, (await getSiteConfig()).cards?.payment),
    ]);
    await markInvoiceSent(id);
    return NextResponse.json({ ok: true, payUrl });
  }

  if (action === "send_summary") {
    if (!inv.lineUserId) {
      return NextResponse.json({ error: "no_line" }, { status: 400 });
    }
    const mode = (body.mode as SummaryMode) || "booking";
    const cfgSum = await getSiteConfig();
    await pushLineMessage(inv.lineUserId, [
      summaryFlexFromInvoice(inv, mode, cfgSum.billing, payment, scheduleText, cfgSum.cards?.billSummary),
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
    const hasGroom = (inv.items || []).some(
      (it) =>
        it.kind === "grooming" || /อาบน้ำ|กรูม|premium|malaseb/i.test(it.label)
    );
    const hasRoom = (inv.items || []).some((it) => /คืน|ห้อง/.test(it.label));
    const msg = reviewMessageFor(hasGroom, hasRoom, biz.name, cfg.cards?.review);
    await pushLineMessage(inv.lineUserId, [
      buildReviewRequestFlex({
        title: msg.title,
        body: msg.body,
        reviewUrl,
        reviewLabel: biz.reviewButtonText,
      }, cfg.cards?.review),
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
    let paidNotifyErr: string | undefined;

    if (paid.lineUserId) {
      const cfgRc = await getSiteConfig();
      const receiptMsgs: object[] = [
        buildReceiptFlex({
          invoiceId: paid.id,
          customerName: paid.customerName,
          catName: paid.catName,
          total: paid.total,
          pointsEarned: paid.pointsEarned || 0,
          shopName: cfgRc.business.name,
          paymentMethod:
            paid.paymentMethod === "member_credit"
              ? "Member Credit"
              : paid.paymentMethod === "cash"
                ? "เงินสด"
                : "โอนเงิน",
        }, cfgRc.cards?.receipt),
      ];
      // ใบเสร็จ + ขอรีวิว รวมใน push เดียว (LINE นับเป็น 1 ข้อความ — ประหยัดโควตา)
      // ปิดได้จากหน้าปรับแต่งการ์ด (ใบเสร็จ → ติ๊กออก "แนบการ์ดขอรีวิว")
      const bundleReview = cfgRc.cards?.receipt?.show?.reviewBundle !== false;
      const reviewUrlRc = cfgRc.business.reviewUrl || cfgRc.business.maps;
      if (bundleReview && reviewUrlRc) {
        const hasGroomRc = (paid.items || []).some(
          (it) =>
            it.kind === "grooming" || /อาบน้ำ|กรูม|premium|malaseb/i.test(it.label)
        );
        const hasRoomRc = (paid.items || []).some((it) => /คืน|ห้อง/.test(it.label));
        const msgRc = reviewMessageFor(hasGroomRc, hasRoomRc, cfgRc.business.name, cfgRc.cards?.review);
        receiptMsgs.push(
          buildReviewRequestFlex({
            title: msgRc.title,
            body: msgRc.body,
            reviewUrl: reviewUrlRc,
            reviewLabel: cfgRc.business.reviewButtonText,
          }, cfgRc.cards?.review)
        );
      }
      // ยอด Member ก็แนบไปในข้อความเดียวกัน — เมื่อก่อนยิงแยกทำให้เสียโควตาเพิ่มอีก 1
      if (customer?.isMember) {
        receiptMsgs.push(
          buildMemberBalanceFlex({
            customerName: customer.name,
            memberCredit: customer.memberCredit,
            usedToday:
              paid.paymentMethod === "member_credit" ? paid.total : undefined,
            catName: paid.catName,
          }, cfgRc.cards?.memberBalance)
        );
      }
      paidNotifyErr = await notifyCustomer(paid.lineUserId, receiptMsgs);
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

    return NextResponse.json({ ok: true, invoice: paid, notifyError: paidNotifyErr });
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
      }, (await getSiteConfig()).cards?.memberBalance),
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
    let rdNotifyErr: string | undefined;
    if (inv.lineUserId) {
      const cfgRd = await getSiteConfig();
      const msgs = cfgRd.messages;
      rdNotifyErr = await notifyCustomer(inv.lineUserId, [
        buildDepositThanksFlex({
          title: msgs.depositThanksTitle,
          body: renderTemplate(msgs.depositThanksBody, {
            name: inv.customerName,
            cat: inv.catName,
            amount: res.deposit.toLocaleString(),
          }),
          terms: msgs.depositTerms || [],
          amount: res.deposit,
        }, cfgRd.cards?.depositThanks),
      ]);
    }
    return NextResponse.json({
      ok: true,
      deposit: res.deposit,
      remaining: res.remaining,
      notifyError: rdNotifyErr,
    });
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

  // ผูกบิลเข้ากับนัดด้วยมือ — ใช้ตอนปุ่มส่งการ์ดหาย เพราะบิลไม่มีนัดผูกอยู่
  if (action === "link_booking") {
    const bookingId = String(body.bookingId || "").trim();
    if (!bookingId) {
      return NextResponse.json({ error: "bookingId required" }, { status: 400 });
    }
    // กันกดผิดคน — ผูกได้เฉพาะนัดของลูกค้าเจ้าของบิลเท่านั้น
    // ถ้าผูกข้ามคน การ์ด/ข้อความจะถูกส่งไปหาลูกค้าผิดคนทันที
    const targetBooking = await getBooking(bookingId);
    if (!targetBooking) {
      return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
    }
    const bookingCustomer = await findCustomerForBooking(targetBooking);
    if (
      inv.customerId &&
      bookingCustomer?.id &&
      bookingCustomer.id !== inv.customerId
    ) {
      return NextResponse.json({ error: "customer_mismatch" }, { status: 400 });
    }
    const res = await linkInvoiceToBooking(id, bookingId);
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
