"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BUSINESS } from "@/lib/business";
import Link from "next/link";

type Invoice = {
  id: string;
  customerName: string;
  catName: string;
  items: { label: string; amount: number }[];
  subtotal: number;
  discount: number;
  promoLabel?: string;
  total: number;
  status: string;
};

type Payment = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export default function PayPage() {
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-catcha-gradient p-6">
        <p className="text-sm text-brown-soft">กำลังโหลดบิล…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-catcha-gradient px-4 py-8">
      <div className="mx-auto max-w-md rounded-catcha bg-card p-6 shadow-catcha">
        <h1 className="text-lg font-extrabold text-catcha-chocolate">💳 ชำระเงิน</h1>
        <p className="mt-1 text-sm text-brown-soft">
          {invoice.catName} · {invoice.customerName}
        </p>

        <ul className="my-4 space-y-1 text-sm text-brown">
          {invoice.items.map((item, i) => (
            <li key={i} className="flex justify-between">
              <span>{item.label}</span>
              <span>{item.amount.toLocaleString()} ฿</span>
            </li>
          ))}
          {invoice.discount > 0 && (
            <li className="flex justify-between text-ok">
              <span>ส่วนลด{invoice.promoLabel ? ` (${invoice.promoLabel})` : ""}</span>
              <span>-{invoice.discount.toLocaleString()} ฿</span>
            </li>
          )}
        </ul>

        <p className="text-2xl font-extrabold text-latte-deep">
          รวม {invoice.total.toLocaleString()} บาท
        </p>

        {invoice.status === "paid" ? (
          <p className="mt-4 rounded-catcha-sm bg-sage/15 p-4 text-center text-sm font-bold text-ok">
            ✅ ชำระเงินเรียบร้อยแล้ว
          </p>
        ) : payment ? (
          <div className="mt-4 rounded-catcha-sm bg-paper p-4 text-sm">
            <p className="font-bold text-brown">โอนเข้าบัญชี</p>
            <p className="mt-2 text-brown-soft">
              {payment.bankName}
              <br />
              {payment.accountNumber}
              <br />
              {payment.accountName}
            </p>
            <p className="mt-3 text-xs text-brown-faint">
              โอนแล้วแจ้งพนักงาน หรือรอระบบยืนยันอัตโนมัติ
            </p>
          </div>
        ) : null}

        <a
          href={BUSINESS.maps}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block rounded-catcha-sm border border-catcha-line py-3 text-center text-xs font-bold text-brown-soft"
        >
          ⭐ รีวิว CatCha Hotel บน Google Maps
        </a>

        <Link
          href="/app"
          className="mt-3 block text-center text-xs font-bold text-latte-deep"
        >
          กลับหน้าหลัก
        </Link>
      </div>
    </div>
  );
}
