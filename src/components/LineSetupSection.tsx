"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TIER_LABELS, type CustomerTier } from "@/lib/customer-tier";

type LineStatus = {
  configured: boolean;
  source: string;
  liffId?: string;
  displayName?: string;
  basicId?: string;
};

export function RegistrationQrSection({ compact }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [liffId, setLiffId] = useState(process.env.NEXT_PUBLIC_LIFF_ID || "");

  useEffect(() => {
    fetch("/api/setup/line")
      .then((r) => r.json())
      .then((d: LineStatus) => {
        if (d.liffId) setLiffId(d.liffId);
      });
  }, []);

  const registerUrl = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");
    if (liffId) {
      return `https://liff.line.me/${liffId}?path=register`;
    }
    return `${base}/app/register`;
  }, [liffId]);

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
          {!liffId && (
            <p className="mt-2 text-[10px] text-wait">
              ตั้ง LIFF ID ด้านล่างเพื่อเปิดใน LINE โดยตรง
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export function LineSetupSection({ adminCode }: { adminCode?: string }) {
  const [status, setStatus] = useState<LineStatus | null>(null);
  const [channelToken, setChannelToken] = useState("");
  const [liffId, setLiffId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/setup/line");
    const data = await res.json();
    setStatus(data);
    if (data.liffId) setLiffId(data.liffId);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/setup/line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminCode,
        channelToken,
        liffId,
      }),
    });
    const data = await res.json();
    setMsg(data.message || data.error || "");
    if (data.ok) {
      setChannelToken("");
      await load();
    }
    setSaving(false);
  };

  if (loading) {
    return <p className="text-xs text-brown-soft">กำลังตรวจ LINE…</p>;
  }

  return (
    <section className="mb-4 space-y-3 rounded-catcha border border-sage/40 bg-card p-4 shadow-catcha-sm">
      <h2 className="text-sm font-extrabold text-catcha-chocolate">
        💬 LINE Messaging (ส่งการ์ดยืนยันนัด)
      </h2>
      <p className="text-xs text-brown-soft">
        วาง Channel Access Token แล้วกดบันทึก — <b>ไม่ต้องใส่ Vercel</b> เหมือน Telegram
        {status?.source === "env" ? (
          <span className="mt-1 block text-wait">
            ⚠️ ตอนนี้ใช้ Token จาก Vercel — ถ้าส่งไม่ได้ ให้บันทึก Token ที่นี่แทน
          </span>
        ) : null}
      </p>

      {status?.configured ? (
        <div className="rounded-catcha-sm bg-sage/15 px-3 py-2 text-xs font-bold text-ok">
          ✅ พร้อมส่งการ์ด
          {status.displayName ? ` · ${status.displayName}` : ""}
          {status.basicId ? ` (${status.basicId})` : ""}
        </div>
      ) : (
        <div className="rounded-catcha-sm bg-honey/20 px-3 py-2 text-xs font-bold text-wait">
          ⏳ ยังไม่ได้ตั้ง LINE — ส่งการ์ดจะขึ้น &quot;ส่งไม่สำเร็จ&quot;
        </div>
      )}

      <label className="block text-xs font-bold text-brown-soft">
        Channel Access Token (Messaging API)
        <input
          type="password"
          value={channelToken}
          onChange={(e) => setChannelToken(e.target.value)}
          placeholder="วาง Token จาก LINE Developers"
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block text-xs font-bold text-brown-soft">
        LIFF ID (ไม่บังคับ — สำหรับเปิดยืนยันนัดใน LINE)
        <input
          value={liffId}
          onChange={(e) => setLiffId(e.target.value)}
          placeholder="เช่น 200xxxxx-xxxx"
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>

      <p className="text-[10px] text-brown-faint">
        LINE Developers → Channel → Messaging API → Issue channel access token
        <br />
        LIFF Endpoint URL: <code>{typeof window !== "undefined" ? window.location.origin : ""}/app</code>
      </p>

      {msg && (
        <p className="rounded-catcha-sm bg-paper px-3 py-2 text-xs font-bold text-brown whitespace-pre-line">
          {msg}
        </p>
      )}

      <button
        type="button"
        disabled={saving || !channelToken.trim()}
        onClick={save}
        className="w-full rounded-catcha-sm bg-[#4A7348] py-3 text-sm font-extrabold text-white disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก…" : "💾 บันทึก LINE"}
      </button>

      <div className="border-t border-catcha-line pt-3">
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
