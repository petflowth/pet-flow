"use client";

import { useEffect, useState } from "react";
import { buildCustomerLinkUrl } from "@/lib/liff-urls";

export function CustomerLinkSection({
  customerId,
  customerName,
  hasLine,
}: {
  customerId: string;
  customerName: string;
  hasLine: boolean;
}) {
  const [liffId, setLiffId] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/line/liff")
      .then((r) => r.json())
      .then((d) => setLiffId(d.liffId || ""));
  }, []);

  if (hasLine) return null;

  const linkUrl = liffId
    ? buildCustomerLinkUrl(liffId, customerId)
    : typeof window !== "undefined"
      ? `${window.location.origin}/app/link?customerId=${customerId}`
      : "";

  const qrUrl = linkUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(linkUrl)}`
    : "";

  const copy = async () => {
    if (!linkUrl) return;
    await navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="mb-4 rounded-catcha border border-latte/40 bg-latte/10 p-4">
      <h2 className="mb-1 text-sm font-extrabold text-catcha-chocolate">
        🔗 ลิงก์ผูก LINE
      </h2>
      <p className="mb-3 text-[10px] text-brown-soft">
        ส่งให้ {customerName} เปิดใน LINE — ระบบจะผูกบัญชีนี้กับข้อมูลที่ร้านบันทึกไว้
        (นัด · แต้ม · โปร)
      </p>
      {qrUrl ? (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="QR ผูก LINE"
            width={120}
            height={120}
            className="rounded-catcha-sm bg-white p-2 shadow-catcha-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="mb-2 break-all font-mono text-[10px] text-brown-soft">
              {linkUrl}
            </p>
            <button
              type="button"
              onClick={copy}
              className="rounded-catcha-sm bg-card px-3 py-2 text-[10px] font-bold text-latte-deep"
            >
              {copied ? "✅ Copy แล้ว" : "📋 Copy ลิงก์ผูก LINE"}
            </button>
            {!liffId && (
              <p className="mt-2 text-[10px] text-wait">
                ตั้ง LIFF ใน Admin → ติดตั้ง — ลิงก์จะเปิดใน LINE โดยตรง
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-brown-soft">กำลังโหลด…</p>
      )}
    </section>
  );
}
