"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/Toast";

/**
 * ปุ่มส่งหาลูกค้าแบบรวมศูนย์ — ใช้ได้ทุกที่ (การ์ดในปฏิทิน · บิล · ฯลฯ)
 * ปุ่มไหนโผล่ขึ้นกับ context ที่มี (booking / invoice / customer)
 * booking-based → /api/bookings · invoice/มัดจำ → /api/invoices
 */
export function CustomerSendButtons({
  lineUserId,
  customerId,
  bookingId,
  invoiceId,
  service,
  invoiceDeposit = 0,
  onDone,
}: {
  lineUserId?: string;
  customerId?: string;
  bookingId?: string;
  invoiceId?: string;
  service?: "room" | "groom";
  invoiceDeposit?: number;
  onDone?: () => void;
}) {
  const [busy, setBusy] = useState("");
  const noLine = !lineUserId;

  // ถ้ามาจากการ์ดนัด (มี bookingId แต่ไม่มี invoiceId) → ไปหาบิลที่ผูกกับนัดนั้นเอง
  const [foundInvoiceId, setFoundInvoiceId] = useState<string | undefined>();
  const [foundDeposit, setFoundDeposit] = useState(0);
  useEffect(() => {
    if (invoiceId || !bookingId) return;
    let alive = true;
    fetch(`/api/invoices?bookingId=${bookingId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d.invoice) return;
        setFoundInvoiceId(d.invoice.id);
        setFoundDeposit(d.invoice.deposit || 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [invoiceId, bookingId]);

  const invId = invoiceId || foundInvoiceId;
  const depForBill = invoiceId ? invoiceDeposit : foundDeposit;

  const call = async (key: string, run: () => Promise<Response>, okMsg: string) => {
    setBusy(key);
    try {
      const res = await run();
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(okMsg, "success");
        onDone?.();
      } else {
        toast(d.error ? `ส่งไม่สำเร็จ: ${d.error}` : "ส่งไม่สำเร็จ — ตรวจ LINE / ตั้งค่า", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const bookingSend = (action: string, okMsg: string) =>
    call(
      action,
      () =>
        fetch("/api/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: bookingId, action, lineUserId }),
        }),
      okMsg
    );

  const invoiceSummary = (mode: string, okMsg: string) =>
    call(
      "inv:" + mode,
      () =>
        fetch("/api/invoices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: invId, action: "send_summary", mode }),
        }),
      okMsg
    );

  const depositRequest = () => {
    // ถ้าบิลมีมัดจำอยู่แล้ว → ใช้ยอดนั้นเลย ไม่ต้องถามซ้ำ
    let amount = depForBill > 0 ? depForBill : 0;
    if (amount <= 0) {
      const raw = prompt("เรียกเก็บมัดจำเท่าไหร่? (บาท)");
      if (raw == null) return;
      amount = Math.round(Number(raw) || 0);
    }
    if (amount <= 0) {
      toast("ใส่จำนวนมัดจำ", "error");
      return;
    }
    void call(
      "dep",
      () =>
        fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send_deposit_request", customerId, amount }),
        }),
      `ส่งการ์ดเรียกเก็บมัดจำ ${amount.toLocaleString()} บาทแล้ว 📨`
    );
  };

  const Btn = ({ k, label, onClick }: { k: string; label: string; onClick: () => void }) => (
    <button
      type="button"
      disabled={noLine || busy !== ""}
      onClick={onClick}
      className="rounded-full bg-[#06C755]/15 px-2.5 py-1 text-[10px] font-bold text-[#06883c] disabled:opacity-40"
    >
      {busy === k ? "กำลังส่ง…" : label}
    </button>
  );

  const hasRemaining = depForBill > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-bold text-brown-faint">
        ส่ง LINE:{noLine ? " (ยังไม่ผูก LINE)" : ""}
      </span>

      {bookingId && (
        <Btn
          k="send_reminder"
          label="📨 แจ้งเตือนนัด"
          onClick={() => bookingSend("send_reminder", "ส่งแจ้งเตือนนัดแล้ว 📨")}
        />
      )}
      {bookingId && service === "room" && (
        <Btn
          k="send_prestay"
          label="🏠 แจ้งเข้าพัก + เงื่อนไข"
          onClick={() => bookingSend("send_prestay", "ส่งการ์ดแจ้งเข้าพัก + เงื่อนไขแล้ว 🏠")}
        />
      )}
      {bookingId && service === "room" && (
        <Btn
          k="send_checkin_reminder"
          label="🧳 เตือนเช็คอิน + เลือกเวลา"
          onClick={() =>
            bookingSend("send_checkin_reminder", "ส่งการ์ดเลือกเวลาเช็คอินแล้ว 🧳")
          }
        />
      )}
      {bookingId && service === "room" && (
        <Btn
          k="send_checkout_reminder"
          label="🧳 เตือนเช็คเอาท์ + เลือกเวลา"
          onClick={() =>
            bookingSend("send_checkout_reminder", "ส่งการ์ดเลือกเวลาเช็คเอาท์แล้ว 🧳")
          }
        />
      )}

      {customerId && (
        <Btn k="dep" label="💰 เรียกเก็บมัดจำ" onClick={depositRequest} />
      )}

      {invId && (
        <Btn
          k="inv:booking"
          label="🧾 สรุปยอด"
          onClick={() => invoiceSummary("booking", "ส่งสรุปยอดแล้ว 🧾")}
        />
      )}
      {invId && (
        <Btn
          k={hasRemaining ? "inv:remaining" : "inv:full"}
          label={hasRemaining ? "💳 เก็บส่วนที่เหลือ" : "💳 แจ้งเก็บเงิน"}
          onClick={() =>
            invoiceSummary(
              hasRemaining ? "remaining" : "full",
              hasRemaining ? "ส่งแจ้งเก็บส่วนที่เหลือแล้ว 💳" : "ส่งแจ้งเก็บเงินแล้ว 💳"
            )
          }
        />
      )}
      {/* ยอดคงเหลือจากนัด — ใช้เมื่อยังไม่มีบิลผูก (มีบิลแล้วใช้ปุ่มด้านบนแทน) */}
      {bookingId && !invId && (
        <Btn
          k="send_deposit_reminder"
          label="💰 ยอดคงเหลือ"
          onClick={() => bookingSend("send_deposit_reminder", "ส่งแจ้งยอดคงเหลือแล้ว 💰")}
        />
      )}
    </div>
  );
}
