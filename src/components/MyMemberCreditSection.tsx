"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { customerFetch } from "@/lib/customer-fetch";

type LedgerEntry = {
  id: string;
  kind: "topup" | "refund" | "legacy" | "usage";
  date: string;
  amount: number;
  description?: string;
  bonusAmount?: number;
  balanceAfter: number;
};

const KIND_LABEL: Record<LedgerEntry["kind"], string> = {
  topup: "เติมเครดิต",
  refund: "คืนเป็นเครดิต (ยกเลิกนัด)",
  legacy: "ยอดยกมา",
  usage: "ใช้เครดิต",
};

/** 2026-11-11 → 11 พ.ย. 2026 (ปี ค.ศ. ให้ตรงกับบิล) */
function thaiDate(d: string) {
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", calendar: "gregory" });
}

/**
 * เครดิต Member คงเหลือ — ลูกค้าเติมเงินไว้ล่วงหน้า ต้องเปิดดูยอดตัวเองได้
 * ไม่ได้เป็น Member หรือยอด 0 = ซ่อนทั้งช่อง (ไม่ต้องรกหน้าแรก)
 *
 * ยอดคงเหลือใช้ข้อมูลจาก LiffProvider ที่โหลดมาแล้ว (/api/customers/line ส่ง memberCredit มาอยู่แล้ว)
 * ประวัติเติม/ตัดเครดิตโหลดเมื่อกด "ดูประวัติ" เท่านั้น (/api/customers/credit-history)
 *
 * onChecked บอกหน้าแม่ว่ารู้ผลแล้วและมี/ไม่มี — หน้าแรกใช้ตัดสินใจว่าจะโชว์ช่องแต้มไหม
 */
export function MyMemberCreditSection({
  onChecked,
}: {
  onChecked?: (hasCredit: boolean) => void;
}) {
  const { customer, ready } = useLiff();
  const credit = customer?.isMember ? customer.memberCredit || 0 : 0;
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // รอให้ LIFF โหลดเสร็จก่อนค่อยสรุป กันบอกว่า "ไม่มี" ทั้งที่ยังโหลดไม่เสร็จ
    if (!ready) return;
    onChecked?.(credit > 0);
    // onChecked ตั้งใจไม่ใส่ใน deps — หน้าแม่ส่ง setState มาตรงๆ ใส่แล้วจะวนไม่จบ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, credit]);

  // ยอดเปลี่ยน (เช่นเพิ่งจ่ายบิล) → ล้างประวัติที่โหลดไว้ เปิดใหม่จะได้ข้อมูลล่าสุด
  useEffect(() => {
    setEntries(null);
  }, [credit]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || entries || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await customerFetch("/api/customers/credit-history");
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.entries)) throw new Error("load failed");
      setEntries(data.entries);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  if (credit <= 0) return null;

  return (
    <section className="mb-4 overflow-hidden rounded-petflow bg-gradient-to-br from-latte/35 via-card to-honey/15 p-5 shadow-petflow">
      <p className="text-xs font-bold text-brown-soft">💎 เครดิต Member ของคุณ</p>
      <p className="mt-1 text-4xl font-extrabold text-latte-deep">
        {credit.toLocaleString()}
        <span className="ml-1 text-sm font-bold text-brown-faint">บาท</span>
      </p>
      <p className="mt-1 text-[10px] text-brown-faint">
        ใช้จ่ายค่าบริการได้เลย — แจ้งร้านว่าขอหักจากเครดิตนะคะ 🧡
      </p>

      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mt-3 w-full rounded-petflow-sm border border-petflow-line bg-card/70 px-3 py-2 text-xs font-bold text-latte-deep active:scale-[0.99]"
      >
        {open ? "ซ่อนประวัติเครดิต ▲" : "ดูประวัติเติม / ตัดเครดิต ▼"}
      </button>

      {open && (
        <div className="mt-2 overflow-hidden rounded-petflow-sm border border-petflow-line bg-card">
          {loading ? (
            <p className="px-3 py-3 text-xs text-brown-faint">กำลังโหลด…</p>
          ) : failed ? (
            <p className="px-3 py-3 text-xs text-brown-faint">
              โหลดประวัติไม่สำเร็จ ลองกดอีกครั้งนะคะ
            </p>
          ) : !entries || entries.length === 0 ? (
            <p className="px-3 py-3 text-xs text-brown-faint">ยังไม่มีประวัติ</p>
          ) : (
            <ul className="divide-y divide-petflow-line">
              {entries.map((e) => {
                const plus = e.amount > 0;
                return (
                  <li key={`${e.kind}-${e.id}`} className="flex items-start gap-2 px-3 py-2.5 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${plus ? "text-ok" : "text-brown"}`}>
                        {KIND_LABEL[e.kind]}
                      </p>
                      <p className="text-[11px] text-brown-soft">
                        {thaiDate(e.date)}
                        {e.description ? ` · ${e.description}` : ""}
                        {e.bonusAmount ? ` · แถม ${e.bonusAmount.toLocaleString()} บาท` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-extrabold ${plus ? "text-ok" : "text-wait"}`}>
                        {plus ? "+" : "−"}
                        {Math.abs(e.amount).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-brown-faint">
                        คงเหลือ {e.balanceAfter.toLocaleString()}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
