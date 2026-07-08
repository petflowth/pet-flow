"use client";

import { useMemo, useState } from "react";
import { TIER_LABELS, type CustomerTier } from "@/lib/customer-tier";

export function RegistrationQrSection({ compact }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  const registerUrl = useMemo(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    if (liffId) {
      return `https://liff.line.me/${liffId}?path=register`;
    }
    return `${base}/app/register`;
  }, []);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(registerUrl)}`;

  const copy = async () => {
    await navigator.clipboard.writeText(registerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      className={`rounded-catcha border border-sage/40 bg-sage/10 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <h2 className="mb-1 text-sm font-extrabold text-catcha-chocolate">
        📱 QR ลงทะเบียนลูกค้า
      </h2>
      <p className="mb-3 text-[10px] text-brown-soft">
        ตั้งที่เคาน์เตอร์ — ลูกค้าสแกนแล้วกรอกชื่อ เบอร์ และน้องแมว
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt="QR ลงทะเบียน"
          width={140}
          height={140}
          className="rounded-catcha-sm bg-white p-2 shadow-catcha-sm"
        />
        <div className="min-w-0 flex-1 text-xs">
          <p className="mb-2 break-all font-mono text-[10px] text-brown-soft">
            {registerUrl}
          </p>
          <button
            type="button"
            onClick={copy}
            className="rounded-catcha-sm bg-card px-3 py-2 text-[10px] font-bold text-latte-deep"
          >
            {copied ? "✅ Copy แล้ว" : "📋 Copy ลิงก์"}
          </button>
          {!process.env.NEXT_PUBLIC_LIFF_ID && (
            <p className="mt-2 text-[10px] text-wait">
              แนะนำตั้ง NEXT_PUBLIC_LIFF_ID เพื่อเปิดใน LINE โดยตรง
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function LineSetupSection() {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://catcha-hotel-five.vercel.app");

  return (
    <section className="mb-4 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
      <h2 className="mb-2 text-sm font-extrabold text-catcha-chocolate">
        💬 LINE + LIFF
      </h2>
      <ol className="mb-4 space-y-2 text-xs text-brown-soft">
        <li>
          1. สร้าง Messaging API Channel ที่{" "}
          <a
            href="https://developers.line.biz/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-latte-deep"
          >
            LINE Developers
          </a>
        </li>
        <li>2. ใส่ <code className="text-[10px]">LINE_CHANNEL_TOKEN</code> ใน Vercel</li>
        <li>
          3. สร้าง LIFF app — Endpoint URL:{" "}
          <code className="break-all text-[10px]">{appUrl}/app</code>
        </li>
        <li>
          4. ใส่ <code className="text-[10px]">NEXT_PUBLIC_LIFF_ID</code> ใน Vercel
        </li>
        <li>5. เปิด LIFF scope: profile · เปิด &quot;Scan QR&quot; ถ้าต้องการ</li>
      </ol>

      <div className="space-y-2 text-xs">
        <StatusChip ok={Boolean(process.env.NEXT_PUBLIC_LIFF_ID)} label="NEXT_PUBLIC_LIFF_ID" />
        <StatusChip ok={Boolean(liffId)} label={`LIFF ID: ${liffId || "—"}`} />
        <p className="text-[10px] text-brown-faint">
          การ์ดยืนยันนัดส่งอัตโนมัติวันก่อนนัด (12:00 น.) + ปุ่มยืนยันในแอป
        </p>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold text-brown">ระดับลูกค้า (อัตโนมัติ)</p>
        <ul className="space-y-1 text-[10px] text-brown-soft">
          {(Object.entries(TIER_LABELS) as [CustomerTier, string][]).map(
            ([key, label]) => (
              <li key={key}>
                <b>{label}</b>
                {key === "new" && " — ยังไม่เคยมา"}
                {key === "regular" && " — มาแล้ว 1+ ครั้ง"}
                {key === "member" && " — เติมเครดิต Member"}
                {key === "vip" && " — มาแล้ว 5+ ครั้ง"}
              </li>
            )
          )}
        </ul>
      </div>
    </section>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-catcha-sm bg-paper px-3 py-2">
      <span>{ok ? "✅" : "⏳"}</span>
      <span className={ok ? "font-semibold text-ok" : "text-brown-soft"}>{label}</span>
    </div>
  );
}
