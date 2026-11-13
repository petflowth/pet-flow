"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PageHeader } from "@/components/PageHeader";
import { SectionLabel } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { stripDiscountTag } from "@/lib/line-discount";
import { useTr } from "@/components/LocaleProvider";

type Invoice = {
  id: string;
  customerName: string;
  catName: string;
  items: {
    label: string;
    amount: number;
    kind?: string;
    qty?: number;
    unitAmount?: number;
    discountPercent?: number;
    discountName?: string;
  }[];
  subtotal: number;
  discount: number;
  promoLabel?: string;
  total: number;
  /** มัดจำ — นับเป็นเงินที่จ่ายแล้วเฉพาะเมื่อร้านกดรับแล้ว (depositReceivedAt) */
  deposit?: number;
  depositReceivedAt?: string;
  status: string;
};

type Payment = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export default function PayPage() {
  const tr = useTr();
  const params = useParams();
  const id = String(params.id);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    fetch(`/api/invoices?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        setInvoice(data.invoice);
        setPayment(data.payment);
      });
  }, [id]);

  if (!invoice) {
    return <LoadingScreen message={tr("กำลังโหลดข้อมูลบิล...", "Loading bill...")} />;
  }

  // รับมัดจำไปแล้ว → ลูกค้าต้องเห็นยอดที่เหลือจริง ไม่ใช่ยอดเต็ม (เดิมโชว์ยอดเต็ม เสี่ยงโอนเกิน)
  const paidDeposit =
    invoice.status !== "paid" && invoice.depositReceivedAt ? invoice.deposit || 0 : 0;
  const due = Math.max(0, invoice.total - paidDeposit);

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Payment"
        title={tr("ชำระเงิน", "Payment")}
        subtitle={`${invoice.catName} · ${invoice.customerName}`}
        back="/app"
        backLabel={tr("กลับหน้าหลัก", "Back to home")}
        showLang={false}
      />

      <SectionLabel>{tr("Bill · รายการ", "Bill items")}</SectionLabel>
      <div className="overflow-hidden rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
        <ul className="divide-y divide-petflow-line text-sm text-brown">
          {invoice.items.map((item, i) => {
            // ส่วนลดเฉพาะรายการ — ราคาเต็มขีดฆ่า + บอกว่าลดเท่าไหร่
            const gross =
              item.unitAmount !== undefined
                ? item.unitAmount * Math.max(1, item.qty || 1)
                : item.amount;
            const off = item.kind === "freebie" ? 0 : gross - item.amount;
            return (
              <li key={i} className="px-4 py-3">
                <div className="flex justify-between gap-3">
                  <span className="min-w-0">{off > 0 ? stripDiscountTag(item.label) : item.label}</span>
                  <span className="shrink-0 text-right font-bold">
                    {off > 0 && (
                      <s className="mr-1 text-xs font-normal text-brown-faint">
                        {gross.toLocaleString()}
                      </s>
                    )}
                    {item.amount.toLocaleString()} ฿
                  </span>
                </div>
                {off > 0 && (
                  <div className="mt-0.5 flex justify-between gap-3 text-xs font-bold text-ok">
                    <span>
                      {tr("ส่วนลด", "Discount")}{item.discountName ? ` ${item.discountName}` : ""}
                      {item.discountPercent ? ` ${item.discountPercent}%` : ""}
                    </span>
                    <span>-{off.toLocaleString()} ฿</span>
                  </div>
                )}
              </li>
            );
          })}
          {invoice.discount > 0 && (
            <li className="flex justify-between gap-3 px-4 py-3 text-ok">
              <span className="min-w-0">{tr("ส่วนลด", "Discount")}{invoice.promoLabel ? ` (${invoice.promoLabel})` : ""}</span>
              <span className="shrink-0 font-bold">-{invoice.discount.toLocaleString()} ฿</span>
            </li>
          )}
        </ul>
        {paidDeposit > 0 && (
          <div className="space-y-1 border-t border-petflow-line px-4 py-3 text-sm">
            <div className="flex justify-between gap-3 text-brown">
              <span>{tr("ยอดรวม", "Total")}</span>
              <span className="font-bold">{invoice.total.toLocaleString()} ฿</span>
            </div>
            <div className="flex justify-between gap-3 text-ok">
              <span>{tr("มัดจำที่ชำระแล้ว", "Deposit paid")}</span>
              <span className="font-bold">-{paidDeposit.toLocaleString()} ฿</span>
            </div>
          </div>
        )}
        <div className="flex items-end justify-between gap-3 bg-honey/15 px-4 py-4">
          <span className="text-xs font-bold text-brown-soft">
            {paidDeposit > 0 ? tr("ยอดคงเหลือที่ต้องชำระ", "Balance due") : tr("ยอดรวม", "Total")}
          </span>
          <span className="text-2xl font-extrabold text-latte-deep">
            {due.toLocaleString()} <span className="text-sm">{tr("บาท", "THB")}</span>
          </span>
        </div>
      </div>

      {invoice.status === "paid" ? (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-petflow bg-sage/20 p-4 text-sm font-bold text-ok">
          <Icon name="check" size={18} strokeWidth={2.4} />
          {tr("ชำระเงินเรียบร้อยแล้ว", "Paid in full")}
        </p>
      ) : payment ? (
        <div className="mt-4 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-petflow-chocolate">
              <Icon name="card" size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-brown-soft">{tr("โอนเข้าบัญชี", "Transfer to")} · {payment.bankName}</p>
              <p className="text-lg font-extrabold tracking-wide text-petflow-chocolate">
                {payment.accountNumber}
              </p>
              <p className="truncate text-xs text-brown-soft">{payment.accountName}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-brown-faint">
            {tr("โอนแล้วแจ้งพนักงาน หรือรอระบบยืนยันอัตโนมัติ", "After transferring, tell our staff or wait for automatic confirmation.")}
          </p>
        </div>
      ) : null}

      <Link
        href="/app"
        className="mt-5 flex min-h-[44px] items-center justify-center text-xs font-bold text-latte-deep"
      >
        {tr("กลับหน้าหลัก", "Back to home")}
      </Link>
    </div>
  );
}
