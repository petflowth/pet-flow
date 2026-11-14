"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { baht, bkkTime, STATUS_LABEL, type Visit } from "@/lib/salon/shared";
import { api, Btn, Card, useHref } from "./ui";

export const STATUS_COLOR: Record<string, string> = {
  booked: "bg-[#e8eef7] text-[#1f4e8c]",
  confirmed: "bg-[#e8eef7] text-[#1f4e8c]",
  arrived: "bg-[#fff4d6] text-[#7a5200]",
  waiting: "bg-[#fff4d6] text-[#7a5200]",
  in_service: "bg-[#ffe7d1] text-[#9a3d00]",
  awaiting_payment: "bg-[#ffe7d1] text-[#9a3d00]",
  done: "bg-[#dff3e6] text-[#155c35]",
  cancelled: "bg-[#eceef1] text-[#4b5563]",
  no_show: "bg-[#fdecea] text-[#b42318]",
};

export function visitName(v: Visit): string {
  return v.customer ? v.customer.nickname || v.customer.name : v.guest_name || "ลูกค้าเดินเข้า";
}

export function visitPrice(v: Visit): number {
  return v.services.reduce((a, s) => a + (s.final_price ?? s.quoted_price), 0);
}

/** การ์ดคิว 1 ใบ — มีปุ่มขั้นต่อไปปุ่มเดียว */
export function VisitCard({ v, onChanged }: { v: Visit; onChanged: () => void }) {
  const router = useRouter();
  const href = useHref();
  const [busy, setBusy] = useState(false);
  const closed = ["done", "cancelled", "no_show"].includes(v.status);
  const canStart = ["booked", "confirmed", "arrived", "waiting"].includes(v.status);
  const canPay = ["in_service", "awaiting_payment"].includes(v.status);

  const start = async () => {
    setBusy(true);
    try {
      await api(`/api/salon/visits/${v.id}`, { method: "PATCH", body: { action: "start" } });
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className={closed ? "opacity-70" : ""}>
      <button className="block w-full text-left" onClick={() => router.push(href(`/salon/visit/${v.id}`))}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[30px] font-extrabold tabular-nums leading-none">
            {bkkTime(v.start_at)}
            {v.queue_no ? <span className="ml-2 text-[18px] font-bold text-[#4b5563]">คิว {v.queue_no}</span> : null}
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[18px] font-bold ${STATUS_COLOR[v.status]}`}>
            {STATUS_LABEL[v.status]}
          </span>
        </div>
        <div className="mt-2 text-[24px] font-bold">{visitName(v)}</div>
        <div className="text-[19px] text-[#374151]">
          {v.services.map((s) => s.name).join(" + ") || "-"} · {baht(visitPrice(v))} ฿
        </div>
        {v.customer?.allergies && (
          <div className="mt-1 text-[19px] font-bold text-[#b42318]">⚠️ แพ้: {v.customer.allergies}</div>
        )}
        {v.deposit_paid > 0 && <div className="text-[18px] text-[#155c35]">รับมัดจำแล้ว {baht(v.deposit_paid)} ฿</div>}
      </button>
      {canStart && (
        <Btn className="mt-3" tone="primary" onClick={start} disabled={busy}>
          ลูกค้ามาแล้ว เริ่มทำ
        </Btn>
      )}
      {canPay && (
        <Btn className="mt-3" tone="green" href={href(`/salon/pay/${v.id}`)}>
          เก็บเงิน
        </Btn>
      )}
    </Card>
  );
}
