"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";

type Inv = {
  id: string;
  total: number;
  deposit?: number;
  depositReceivedAt?: string;
  status: "pending" | "paid";
  customerId?: string;
};

/**
 * ปุ่มจัดการเงินของบิลที่ผูกกับนัด — ใช้ในหน้าตารางนัด ให้ทำได้เหมือนหน้าคิดบิล
 * (รับมัดจำ / รับเงิน / เงินสด / ยกเลิกชำระ / ลบบิล) — โผล่เฉพาะเมื่อมีบิลผูกอยู่
 */
export function InvoiceActionButtons({
  bookingId,
  onDone,
}: {
  bookingId?: string;
  onDone?: () => void;
}) {
  const [inv, setInv] = useState<Inv | null>(null);
  const [busy, setBusy] = useState("");

  const reload = useCallback(() => {
    if (!bookingId) return;
    fetch(`/api/invoices?bookingId=${bookingId}`)
      .then((r) => r.json())
      .then((d) => setInv(d.invoice || null))
      .catch(() => {});
  }, [bookingId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!inv) return null;

  const remaining = inv.total - (inv.deposit ?? 0);
  const hasDeposit = (inv.deposit ?? 0) > 0;

  const act = async (
    key: string,
    body: Record<string, unknown>,
    okMsg: string,
    confirmMsg?: string
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(key);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id, ...body }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(okMsg, "success");
        reload();
        onDone?.();
      } else {
        toast(d.error ? `ไม่สำเร็จ: ${d.error}` : "ไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const B = ({
    k,
    label,
    cls,
    onClick,
  }: {
    k: string;
    label: string;
    cls: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      disabled={busy !== ""}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold disabled:opacity-40 ${cls}`}
    >
      {busy === k ? "…" : label}
    </button>
  );

  return (
    <div className="mt-2 rounded-catcha-sm bg-honey/10 p-2">
      <p className="mb-1 text-[10px] font-bold text-brown-faint">
        🧾 บิล {inv.total.toLocaleString()} ฿ ·{" "}
        {inv.status === "paid" ? "✅ ชำระแล้ว" : "⏳ รอชำระ"}
        {hasDeposit
          ? ` · มัดจำ ${inv.deposit!.toLocaleString()}${
              inv.depositReceivedAt ? " (รับแล้ว)" : " (รอรับ)"
            }`
          : ""}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {inv.status === "pending" && (
          <>
            {hasDeposit && !inv.depositReceivedAt && (
              <B
                k="receive_deposit"
                label="💰 รับมัดจำแล้ว"
                cls="bg-honey/40 text-catcha-chocolate"
                onClick={() =>
                  act(
                    "receive_deposit",
                    { action: "receive_deposit" },
                    "รับมัดจำแล้ว 💰"
                  )
                }
              />
            )}
            <B
              k="paid_transfer"
              label={hasDeposit ? "✅ รับเงินที่เหลือ (ปิดบิล)" : "✅ รับเงินแล้ว"}
              cls="bg-sage/25 text-ok"
              onClick={() =>
                act(
                  "paid_transfer",
                  { action: "mark_paid", paymentMethod: "transfer" },
                  "รับเงินแล้ว ✅ (ปิดบิล)"
                )
              }
            />
            <B
              k="paid_cash"
              label="💵 เงินสด"
              cls="bg-paper text-brown"
              onClick={() =>
                act(
                  "paid_cash",
                  { action: "mark_paid", paymentMethod: "cash" },
                  "รับเงินสดแล้ว 💵 (ปิดบิล)"
                )
              }
            />
          </>
        )}
        {inv.status === "paid" && (
          <B
            k="unmark_paid"
            label="↩️ ยกเลิกการชำระ (กดผิด)"
            cls="bg-wait/15 text-wait"
            onClick={() =>
              act(
                "unmark_paid",
                { action: "unmark_paid" },
                "ยกเลิกการชำระแล้ว ↩️ (กลับเป็นรอชำระ)",
                "ยกเลิกการชำระบิลนี้? (กดผิดใช่ไหม)\nจะกลับเป็น 'รอชำระ' + ย้อนรายรับ/แต้ม/เครดิต"
              )
            }
          />
        )}
        <Link
          href={`/admin/billing?bookingId=${bookingId}`}
          className="rounded-full bg-latte/25 px-2.5 py-1 text-[10px] font-bold text-catcha-chocolate"
        >
          🧾 ไปหน้าบิล
        </Link>
      </div>
      {remaining > 0 && inv.status === "pending" && hasDeposit && (
        <p className="mt-1 text-[10px] font-bold text-wait">
          คงเหลือ {remaining.toLocaleString()} บาท
        </p>
      )}
    </div>
  );
}
