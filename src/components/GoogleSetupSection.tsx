"use client";

import { Icon } from "@/components/Icon";
import { useCallback, useEffect, useState } from "react";

type GoogleStatus = {
  configured: boolean;
  source: string;
  serviceAccountEmail?: string;
  robotEmail?: string | null;
  test?: { ok: boolean; messages: string[] };
};

export function GoogleSetupSection({ adminCode }: { adminCode: string }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [jsonText, setJsonText] = useState("");
  // เดิมใส่ลิงก์ชีต/ปฏิทินของร้านแรกไว้เป็นค่าเริ่มต้น → ร้านใหม่เผลอกดบันทึกแล้วชี้ไปของร้านอื่น
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [calendarUrl, setCalendarUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/setup/google");
    const data = await res.json();
    setStatus(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/setup/google", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode, jsonText, spreadsheetUrl, calendarUrl }),
    });
    const data = await res.json();
    setMsg(data.message || data.error || "");
    if (data.ok) await load();
    setSaving(false);
  };

  if (loading) {
    return <p className="text-xs text-brown-soft">กำลังตรวจ Google…</p>;
  }

  const robotEmail = status?.robotEmail || "";

  return (
    <section className="mb-4 space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm">
      <h2 className="flex items-center gap-2.5 text-sm font-extrabold text-petflow-chocolate">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-honey/30 text-petflow-chocolate">
          <Icon name="calendar" size={16} />
        </span>
        Google Calendar + Sheets
      </h2>
      <p className="text-xs text-brown-soft">
        การจองจะขึ้นในปฏิทินของร้าน และสำรองข้อมูลลงชีตของร้านทุกคืน —{" "}
        <a href="/guide/google" target="_blank" className="font-bold underline">
          ดูวิธีทำแบบมีรูป
        </a>
      </p>

      {status?.configured ? (
        <div className="rounded-petflow-sm bg-sage/15 px-3 py-2 text-xs">
          <p className="font-bold text-ok">Google เชื่อมแล้ว ✅</p>
          {status.serviceAccountEmail && (
            <p className="mt-1 text-brown-soft">Service: {status.serviceAccountEmail}</p>
          )}
        </div>
      ) : null}

      {msg && (
        <p className="whitespace-pre-line rounded-petflow-sm bg-paper px-3 py-2 text-xs font-bold text-brown">
          {msg}
        </p>
      )}

      {robotEmail ? (
        <div className="rounded-petflow-sm bg-honey/15 px-3 py-2 text-xs text-brown-soft">
          <p className="font-bold text-petflow-chocolate">
            1. แชร์ชีต (ผู้แก้ไข) และปฏิทิน (ทำการเปลี่ยนแปลงกิจกรรม) ให้อีเมลนี้
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded bg-card px-2 py-1.5 text-[11px]">
              {robotEmail}
            </code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(robotEmail);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="shrink-0 rounded-full bg-petflow-chocolate px-3 py-1.5 text-[11px] font-bold text-card"
            >
              {copied ? "คัดลอกแล้ว" : "คัดลอก"}
            </button>
          </div>
        </div>
      ) : null}

      <label className="block text-xs font-bold text-brown-soft">
        {robotEmail ? "2" : "1"}. ลิงก์ Google Sheet ของร้าน
        <input
          value={spreadsheetUrl}
          onChange={(e) => setSpreadsheetUrl(e.target.value)}
          // กันเบราว์เซอร์เติมคำเก่าให้เอง (เคยเติม "back-home-dog-service" ลงช่องปฏิทิน)
          name="petflow-google-sheet-url"
          autoComplete="off"
          placeholder="https://docs.google.com/spreadsheets/d/…"
          className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-xs"
        />
      </label>

      <label className="block text-xs font-bold text-brown-soft">
        {robotEmail ? "3" : "2"}. รหัสปฏิทิน (Calendar ID) หรือลิงก์ปฏิทิน
        <input
          value={calendarUrl}
          onChange={(e) => setCalendarUrl(e.target.value)}
          name="petflow-google-calendar-id"
          autoComplete="off"
          placeholder="xxxx@group.calendar.google.com"
          className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-xs"
        />
      </label>

      <details open={!robotEmail} className="rounded-petflow-sm bg-paper px-3 py-2 text-xs">
        <summary className="cursor-pointer font-bold text-brown-soft">
          {robotEmail ? "ขั้นสูง: ใช้ Google Cloud ของร้านเอง" : "วางไฟล์ JSON จาก Google Cloud"}
        </summary>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          autoComplete="off"
          rows={5}
          placeholder="วางเนื้อหาไฟล์ .json ทั้งไฟล์ (ถ้าเว้นว่างจะใช้อีเมลกลางของระบบ)"
          className="mt-2 w-full rounded-petflow-sm border border-petflow-line bg-card p-2 font-mono text-[10px]"
        />
        <p className="mt-1 text-[10px] text-brown-soft">
          แชร์ชีต/ปฏิทินให้ <code>client_email</code> ในไฟล์ JSON แทน
        </p>
      </details>

      <button
        type="button"
        disabled={
          saving ||
          !spreadsheetUrl.trim() ||
          !calendarUrl.trim() ||
          (!robotEmail && !jsonText.trim())
        }
        onClick={save}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-petflow-chocolate text-sm font-extrabold text-card disabled:opacity-50"
      >
        {saving ? "กำลังทดสอบและบันทึก…" : "บันทึก Google (ทดสอบอัตโนมัติ)"}
      </button>

      {status?.test?.messages?.length ? (
        <ul className="space-y-1 text-[10px] text-brown-soft">
          {status.test.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
