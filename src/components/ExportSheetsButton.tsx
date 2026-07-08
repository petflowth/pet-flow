"use client";

import { useState } from "react";

export function ExportSheetsButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState("");

  const exportSheets = async () => {
    setLoading(true);
    setMsg("");
    setUrl("");
    const adminCode =
      typeof window !== "undefined"
        ? sessionStorage.getItem("catcha-admin") || ""
        : "";

    const res = await fetch("/api/export/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg(data.message || "ส่งออกสำเร็จ");
      if (data.spreadsheetUrl) setUrl(data.spreadsheetUrl);
    } else {
      setMsg(data.message || data.reason || "ส่งออกไม่สำเร็จ");
    }
    setLoading(false);
  };

  return (
    <div className={className}>
      <button
        type="button"
        disabled={loading}
        onClick={exportSheets}
        className="w-full rounded-catcha-sm bg-gradient-to-r from-sage/40 to-latte/30 py-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-50"
      >
        {loading ? "กำลังส่งออก…" : "📊 ส่งออก Google Sheets"}
      </button>
      {msg && (
        <p className="mt-2 text-center text-xs font-bold text-brown-soft">{msg}</p>
      )}
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-center text-xs font-bold text-latte-deep underline"
        >
          เปิด Google Sheet →
        </a>
      )}
    </div>
  );
}
