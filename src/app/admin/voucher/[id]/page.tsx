"use client";

import { useEffect, useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { bahtText } from "@/lib/baht-text";

type Rec = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
  customerName?: string;
  catName?: string;
  displayTitle: string;
  receiptUrl?: string;
};

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [rec, setRec] = useState<Rec | null>(null);
  const [shop, setShop] = useState({ name: "PetFlow", address: "", taxId: "", phone: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/finance").then((r) => r.json()).catch(() => ({})),
      fetch("/api/config").then((r) => r.json()).catch(() => ({})),
    ]).then(([fin, cfg]) => {
      const found = (fin.records || []).find((r: Rec) => r.id === id) || null;
      setRec(found);
      const b = cfg.config?.business;
      if (b) {
        setShop({
          name: b.name || "PetFlow",
          address: b.location?.th || "",
          taxId: b.taxId || "",
          phone: b.phones?.[0] || "",
        });
      }
      setLoading(false);
    });
  }, [id]);

  const isExpense = rec?.type === "expense";
  const docTitle = isExpense ? "ใบสำคัญจ่าย" : "ใบสำคัญรับเงิน";
  const docTitleEn = isExpense ? "Payment Voucher" : "Receipt Voucher";
  // เลขที่เอกสารจาก id — คงที่ต่อรายการ ไม่สุ่มใหม่ทุกครั้ง
  const docNo = useMemo(() => (rec ? `${isExpense ? "PV" : "RV"}-${rec.id.replace(/\D/g, "").slice(-6)}` : ""), [rec, isExpense]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }
  if (!rec) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-brown-soft">ไม่พบรายการนี้ (อาจถูกลบไปแล้ว)</p>
        <Link href="/admin/finance" className="mt-3 inline-block text-xs font-bold text-latte-deep underline">
          ← กลับหน้ารายรับ-รายจ่าย
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
        <Link href="/admin/finance" className="text-xs font-bold text-latte-deep">
          ← กลับ
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-petflow-sm bg-latte-deep px-4 py-2 text-sm font-extrabold text-card"
        >
          🖨️ พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="mx-auto max-w-2xl rounded-petflow bg-card p-6 text-brown shadow-petflow-sm print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        {/* หัวเอกสาร */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-petflow-chocolate pb-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-petflow-chocolate">{shop.name}</p>
            {shop.address && <p className="text-[11px] text-brown-soft">{shop.address}</p>}
            <p className="text-[11px] text-brown-soft">
              {shop.taxId && `เลขผู้เสียภาษี: ${shop.taxId}`}
              {shop.taxId && shop.phone && " · "}
              {shop.phone && `โทร. ${shop.phone}`}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-extrabold text-petflow-chocolate">{docTitle}</p>
            <p className="text-[10px] text-brown-faint">{docTitleEn}</p>
            <p className="mt-1 text-xs font-bold">เลขที่ {docNo}</p>
            <p className="text-xs">วันที่ {rec.date}</p>
          </div>
        </div>

        {/* จ่ายให้ / รับจาก */}
        <div className="mt-4 space-y-1 text-sm">
          <p>
            <span className="text-brown-soft">{isExpense ? "จ่ายให้ / ผู้รับเงิน:" : "รับจาก:"}</span>{" "}
            <span className="font-bold">
              {rec.customerName || (isExpense ? rec.category || "-" : "ลูกค้า")}
            </span>
          </p>
          {rec.catName && (
            <p>
              <span className="text-brown-soft">น้องแมว:</span> <span className="font-bold">{rec.catName}</span>
            </p>
          )}
        </div>

        {/* ตารางรายการ */}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-petflow-line text-brown-soft">
              <th className="py-2 text-left font-bold">รายการ</th>
              <th className="py-2 text-right font-bold">จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-petflow-line/60 align-top">
              <td className="py-3">
                {rec.displayTitle}
                {rec.category && !rec.displayTitle.includes(rec.category) && (
                  <span className="block text-[11px] text-brown-faint">หมวด: {rec.category}</span>
                )}
              </td>
              <td className="py-3 text-right">{baht(rec.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-petflow-chocolate font-extrabold text-petflow-chocolate">
              <td className="py-2">รวมทั้งสิ้น</td>
              <td className="py-2 text-right">{baht(rec.amount)}</td>
            </tr>
          </tfoot>
        </table>

        {/* จำนวนเงินเป็นตัวอักษร */}
        <div className="mt-2 rounded-petflow-sm bg-paper/60 px-3 py-2 text-center text-sm font-bold">
          ({bahtText(rec.amount)})
        </div>

        {/* รูปบิลแนบ (ถ้ามี) */}
        {rec.receiptUrl && (
          <div className="mt-4">
            <p className="mb-1 text-[11px] font-bold text-brown-soft">เอกสารแนบ (บิล/ใบเสร็จ):</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rec.receiptUrl}
              alt="บิลแนบ"
              className="max-h-72 rounded-petflow-sm border border-petflow-line object-contain"
            />
          </div>
        )}

        {!rec.receiptUrl && isExpense && (
          <p className="mt-4 rounded-petflow-sm bg-honey/15 px-3 py-2 text-[11px] text-brown-soft">
            📌 ใบนี้ใช้แทนใบเสร็จกรณีไม่มีใบเสร็จจากผู้รับเงิน — ผู้จ่ายรับรองว่าได้จ่ายจริงตามรายการข้างต้น
          </p>
        )}

        {/* ช่องเซ็นชื่อ */}
        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-xs text-brown-soft">
          <div>
            <div className="mx-auto mb-1 w-44 border-b border-dashed border-petflow-line" />
            ผู้จ่ายเงิน / ผู้จัดทำ
          </div>
          <div>
            <div className="mx-auto mb-1 w-44 border-b border-dashed border-petflow-line" />
            ผู้รับเงิน / ผู้อนุมัติ
          </div>
        </div>
      </div>
    </div>
  );
}
