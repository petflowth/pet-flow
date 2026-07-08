"use client";

import { useCallback, useEffect, useState } from "react";
import { adminJson } from "@/lib/admin-fetch";
import { GoogleSetupSection } from "@/components/GoogleSetupSection";
import { LineSetupSection } from "@/components/LineSetupSection";
import { TelegramSetupSection } from "@/components/TelegramSetupSection";

type Status = {
  supabaseUrl: boolean;
  serviceKey: boolean;
  databaseUrl: boolean;
  connected: boolean;
  tablesReady: boolean;
  missingTables: string[];
  message: string;
};

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(false);
  const [msg, setMsg] = useState("");
  const adminCode = typeof window !== "undefined" ? sessionStorage.getItem("catcha-admin") || "" : "";

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    const result = await adminJson<{ status: Status }>("/api/setup");
    if (result.ok && result.data.status) {
      setStatus(result.data.status);
    } else {
      setStatus(null);
      setMsg(result.ok ? "ตรวจสอบไม่สำเร็จ" : result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bootstrap = async () => {
    setBooting(true);
    setMsg("");
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode }),
    });
    const data = await res.json();
    setMsg(data.message || data.error || "");
    if (data.status) setStatus(data.status);
    setBooting(false);
    if (data.ok) setTimeout(load, 500);
  };

  const copySchema = async () => {
    const res = await fetch("/api/setup?action=schema");
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    setMsg("📋 Copy SQL แล้ว — วางใน Supabase SQL Editor");
  };

  if (loading) {
    return <p className="text-center text-sm text-brown-soft py-10">กำลังตรวจสอบ…</p>;
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-catcha-chocolate">🚀 ติดตั้งระบบ</h1>
      <p className="mb-4 text-xs text-brown-soft">
        ทำครั้งเดียว — วาง JSON / ลิงก์ แล้วกดบันทึก ไม่ต้องไล่ใส่ Vercel ทีละตัว
      </p>

      <GoogleSetupSection adminCode={adminCode} />
      <LineSetupSection adminCode={adminCode} />
      <TelegramSetupSection adminCode={adminCode} />

      {msg && (
        <p className="mb-4 rounded-catcha-sm bg-paper px-3 py-2 text-xs font-bold text-brown">
          {msg}
        </p>
      )}

      {status?.tablesReady ? (
        <div className="mb-4 rounded-catcha bg-sage/15 p-5 text-center">
          <p className="text-2xl">✅</p>
          <p className="mt-2 font-extrabold text-ok">พร้อมใช้งานแล้ว!</p>
          <p className="mt-1 text-xs text-brown-soft">{status.message}</p>
          <a
            href="/admin/settings"
            className="mt-4 inline-block rounded-catcha-sm bg-honey/40 px-4 py-2 text-xs font-bold"
          >
            ไปตั้งค่าร้าน →
          </a>
        </div>
      ) : (
        <>
          <section className="mb-4 space-y-2 rounded-catcha bg-card p-4 shadow-catcha-sm">
            <h2 className="text-sm font-extrabold">สถานะ</h2>
            <StatusRow ok={status?.supabaseUrl} label="NEXT_PUBLIC_SUPABASE_URL" />
            <StatusRow ok={status?.serviceKey} label="SUPABASE_SERVICE_ROLE_KEY" />
            <StatusRow ok={status?.databaseUrl} label="DATABASE_URL (สำหรับสร้างตารางอัตโนมัติ)" />
            <StatusRow ok={status?.connected} label="เชื่อมต่อ Supabase" />
            <StatusRow ok={status?.tablesReady} label="ตารางฐานข้อมูลครบ" />
            {status?.missingTables?.length ? (
              <p className="text-[10px] text-wait">ขาด: {status.missingTables.join(", ")}</p>
            ) : null}
          </section>

          <section className="mb-4 rounded-catcha border border-honey/50 bg-honey/10 p-4">
            <h2 className="mb-2 text-sm font-extrabold text-catcha-chocolate">
              ขั้นที่ 1 — ใส่ใน Vercel (Settings → Environment)
            </h2>
            <ol className="space-y-2 text-xs text-brown-soft">
              <li>
                1. สร้างโปรเจกต์ที่{" "}
                <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="font-bold text-latte-deep">
                  supabase.com
                </a>
              </li>
              <li>2. Settings → API → copy <b>Project URL</b> → ใส่ <code>NEXT_PUBLIC_SUPABASE_URL</code></li>
              <li>3. copy <b>service_role</b> key → ใส่ <code>SUPABASE_SERVICE_ROLE_KEY</code></li>
              <li>4. Settings → Database → Connection string (URI) → ใส่ <code>DATABASE_URL</code></li>
              <li>5. Redeploy บน Vercel แล้วกลับมาหน้านี้</li>
            </ol>
          </section>

          <section className="mb-4 space-y-2 rounded-catcha bg-card p-4 shadow-catcha-sm">
            <h2 className="text-sm font-extrabold">ขั้นที่ 2 — สร้างตาราง</h2>
            <p className="text-xs text-brown-soft">เลือกวิธีใดวิธีหนึ่ง:</p>

            <button
              type="button"
              disabled={booting || !status?.databaseUrl}
              onClick={bootstrap}
              className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-40"
            >
              {booting ? "กำลังสร้าง…" : "⚡ สร้างตารางอัตโนมัติ (ต้องมี DATABASE_URL)"}
            </button>

            <button
              type="button"
              onClick={copySchema}
              className="w-full rounded-catcha-sm border border-catcha-line bg-paper py-3 text-sm font-bold text-brown"
            >
              📋 Copy SQL ไปวางใน Supabase SQL Editor
            </button>

            <a
              href="https://github.com/stopstopw-bit/Catcha-hotel/blob/main/webapp/supabase/schema.sql"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs font-bold text-latte-deep"
            >
              เปิด schema.sql บน GitHub →
            </a>
          </section>
        </>
      )}

      <button
        type="button"
        onClick={load}
        className="w-full rounded-catcha-sm bg-paper py-2 text-xs font-bold text-brown-soft"
      >
        🔄 ตรวจสอบอีกครั้ง
      </button>
    </div>
  );
}

function StatusRow({ ok, label }: { ok?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span>{ok ? "✅" : "⏳"}</span>
      <span className={ok ? "text-ok font-semibold" : "text-brown-soft"}>{label}</span>
    </div>
  );
}
