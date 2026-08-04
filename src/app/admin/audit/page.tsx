"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  createdAt: string;
};

/** ชื่อไทยของแต่ละการกระทำ — ให้อ่านออกโดยไม่ต้องรู้ชื่อ action ในโค้ด */
const ACTION_LABEL: Record<string, string> = {
  mark_paid: "💰 รับเงิน / ปิดบิล",
  delete_invoice: "🗑️ ลบบิล",
  add_points: "🎁 เพิ่มแต้ม",
  reduce_points: "➖ ลดแต้ม",
  delete_points_history: "🗑️ ลบประวัติแต้ม",
  exclude_finance: "🚫 ตั้งไม่นับเป็นรายได้",
  include_finance: "↩️ กลับมานับเป็นรายได้",
  send_birthday_greetings: "🎂 ส่งการ์ดวันเกิด",
};

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", calendar: "gregory" })} ${d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

export default function AuditPage() {
  const [logs, setLogs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState("");

  useEffect(() => {
    fetch("/api/audit?limit=300")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const actors = useMemo(
    () => [...new Set(logs.map((l) => l.actor).filter(Boolean))].sort(),
    [logs]
  );
  const shown = actor ? logs.filter((l) => l.actor === actor) : logs;

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-extrabold text-catcha-chocolate">🔍 ประวัติการใช้งาน</h1>
        <p className="mt-1 text-xs text-brown-soft">
          บันทึกเฉพาะการกระทำที่กระทบเงินและสิทธิ์ลูกค้า — ไว้ไล่ย้อนตอนยอดไม่ตรง
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-catcha border border-dashed border-catcha-line py-10 text-center">
          <p className="text-sm font-bold text-brown-soft">ยังไม่มีบันทึก</p>
          <p className="mt-1 text-xs text-brown-faint">
            ถ้าเพิ่งอัปเดต ให้กด &quot;🔄 อัปเดตฐานข้อมูล&quot; ที่ ตั้งค่า → ขั้นสูง
            หนึ่งครั้งก่อน แล้วระบบจะเริ่มเก็บให้เอง
          </p>
        </div>
      ) : (
        <>
          {actors.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setActor("")}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                  actor === "" ? "bg-latte-deep text-white" : "bg-paper text-brown-soft"
                }`}
              >
                ทุกคน
              </button>
              {actors.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setActor(a)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    actor === a ? "bg-latte-deep text-white" : "bg-paper text-brown-soft"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          )}

          <ul className="space-y-2">
            {shown.map((l) => (
              <li
                key={l.id}
                className="rounded-catcha-sm border border-catcha-line bg-card px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-extrabold text-catcha-chocolate">
                    {ACTION_LABEL[l.action] || l.action}
                  </span>
                  <span className="text-[10px] text-brown-faint">{when(l.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-brown-soft">
                  👤 {l.actor || "ไม่ทราบ"}
                  {l.resourceId ? ` · ${l.resourceType} ${l.resourceId}` : ` · ${l.resourceType}`}
                </p>
                {l.detail && Object.keys(l.detail).length > 0 && (
                  <p className="mt-1 rounded bg-paper px-2 py-1 text-[10px] text-brown">
                    {Object.entries(l.detail)
                      .filter(([, v]) => v !== undefined && v !== null && v !== "")
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-center text-[10px] text-brown-faint">
            แสดง {shown.length} รายการล่าสุด
          </p>
        </>
      )}
    </div>
  );
}
