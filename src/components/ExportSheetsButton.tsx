"use client";

import { useState } from "react";

/** คอลัมน์ลูกค้าที่เลือกส่งออกได้ (key ต้องตรงกับ lib/google-sheets-export.ts) */
const CUSTOMER_COLUMN_OPTIONS: { key: string; label: string }[] = [
  { key: "id", label: "รหัสลูกค้า" },
  { key: "name", label: "ชื่อผู้ปกครอง" },
  { key: "phone", label: "เบอร์โทร" },
  { key: "email", label: "อีเมล" },
  { key: "birthday", label: "วันเกิดผู้ปกครอง" },
  { key: "referral", label: "รู้จักจาก" },
  { key: "address", label: "ที่อยู่ (รับ-ส่ง)" },
  { key: "addressMap", label: "ลิงก์แผนที่" },
  { key: "postalCode", label: "รหัสไปรษณีย์" },
  { key: "consent", label: "ยินยอมรับข่าวสาร" },
  { key: "line", label: "ผูก LINE" },
  { key: "member", label: "สมาชิก" },
  { key: "credit", label: "เครดิตคงเหลือ" },
  { key: "depositCredit", label: "เครดิตมัดจำล่วงหน้า" },
  { key: "tier", label: "กลุ่มลูกค้า" },
  { key: "catName", label: "ชื่อแมว" },
  { key: "catGender", label: "เพศแมว" },
  { key: "catBreed", label: "พันธุ์" },
  { key: "catFur", label: "ลักษณะขน" },
  { key: "catColor", label: "สี/ลักษณะเด่น" },
  { key: "catAge", label: "อายุ" },
  { key: "catBirthday", label: "วันเกิดแมว" },
  { key: "catMedical", label: "โรคประจำตัว" },
  { key: "catGroomInfo", label: "ประวัติก่อนอาบน้ำ" },
  { key: "catNote", label: "โน้ตแมว" },
  { key: "catPrivateNote", label: "โน้ตลับร้าน" },
  { key: "createdAt", label: "วันที่สมัคร" },
  { key: "updatedAt", label: "อัปเดตล่าสุด" },
];

const ALL_KEYS = CUSTOMER_COLUMN_OPTIONS.map((c) => c.key);

export function ExportSheetsButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [url, setUrl] = useState("");
  const [showCols, setShowCols] = useState(false);
  const [cols, setCols] = useState<string[]>(ALL_KEYS);

  const toggle = (key: string) =>
    setCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const exportSheets = async () => {
    setLoading(true);
    setMsg("");
    setUrl("");
    const adminCode =
      typeof window !== "undefined"
        ? sessionStorage.getItem("catcha-admin") || ""
        : "";

    // เรียงตามลำดับ CUSTOMER_COLUMN_OPTIONS เพื่อให้คอลัมน์เรียงสวย
    const ordered = ALL_KEYS.filter((k) => cols.includes(k));
    const res = await fetch("/api/export/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode, columns: ordered }),
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
        onClick={() => setShowCols((v) => !v)}
        className="mb-2 w-full rounded-catcha-sm border border-catcha-line bg-card py-2 text-xs font-bold text-brown-soft"
      >
        ⚙️ เลือกคอลัมน์ที่จะส่งออก ({cols.length}/{ALL_KEYS.length}) {showCols ? "▲" : "▼"}
      </button>
      {showCols && (
        <div className="mb-2 rounded-catcha-sm border border-catcha-line bg-paper/50 p-3">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => setCols(ALL_KEYS)}
              className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-latte-deep"
            >
              เลือกทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setCols([])}
              className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-brown-faint"
            >
              ล้าง
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {CUSTOMER_COLUMN_OPTIONS.map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-1.5 text-[11px] text-brown"
              >
                <input
                  type="checkbox"
                  checked={cols.includes(c.key)}
                  onChange={() => toggle(c.key)}
                  className="h-3.5 w-3.5 accent-[#4A7348]"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={loading || cols.length === 0}
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
