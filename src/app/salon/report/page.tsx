"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, bkkTime, thaiDay } from "@/lib/salon/shared";
import { api, Btn, Card, ErrorBox, Field, Loading, Money, Sheet, Title, useBoot } from "@/components/salon/ui";

type Report = {
  day: string;
  income: number;
  bill_count: number;
  money_in: { cash: number; transfer: number; card: number };
  money_in_total: number;
  card_fees: number;
  bills: { id: string; bill_no: number; total: number; status: string; void_reason: string | null; created_at: string; customer_name: string }[];
};

export default function ReportPage() {
  const { boot } = useBoot();
  const [day, setDay] = useState("");
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [voiding, setVoiding] = useState<Report["bills"][number] | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (boot && !day) setDay(boot.today);
  }, [boot, day]);
  const load = useCallback(async () => {
    if (!day) return;
    setR(null);
    try {
      setR(await api<Report>(`/api/salon/report?day=${day}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [day]);
  useEffect(() => {
    load();
  }, [load]);

  const doVoid = async () => {
    if (!voiding) return;
    try {
      await api(`/api/salon/bills/${voiding.id}/void`, { body: { reason } });
      setVoiding(null);
      setReason("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!boot) return <Loading />;
  return (
    <div className="space-y-4">
      <Title>ยอดเงิน</Title>
      <div className="flex items-center gap-2">
        <button onClick={() => setDay(addDays(day, -1))} className="min-h-[60px] min-w-[64px] rounded-2xl border-2 border-[#9aa3ae] bg-white text-[26px] font-bold" aria-label="วันก่อน">
          ‹
        </button>
        <div className="flex-1 text-center text-[23px] font-extrabold">{day === boot.today ? "วันนี้" : thaiDay(day)}</div>
        <button onClick={() => setDay(addDays(day, 1))} disabled={day >= boot.today} className="min-h-[60px] min-w-[64px] rounded-2xl border-2 border-[#9aa3ae] bg-white text-[26px] font-bold disabled:opacity-30" aria-label="วันถัดไป">
          ›
        </button>
      </div>
      <ErrorBox text={error} />
      {!r ? (
        <Loading />
      ) : (
        <>
          <Card className="border-[#1f4e8c] bg-[#1f4e8c] text-center text-white">
            <div className="text-[22px] font-bold">รายได้ ({r.bill_count} บิล)</div>
            <div className="text-[48px] font-extrabold">
              <Money value={r.income} />
            </div>
          </Card>
          <Card>
            <div className="mb-2 text-[22px] font-extrabold">เงินที่รับเข้ามาวันนี้</div>
            <Row k="💵 เงินสด (ควรมีในลิ้นชัก)" v={r.money_in.cash} />
            <Row k="📱 โอน / พร้อมเพย์" v={r.money_in.transfer} />
            <Row k="💳 บัตร" v={r.money_in.card} />
            {r.card_fees > 0 && <div className="mt-1 text-[18px] text-[#4b5563]">ค่าธรรมเนียมบัตรประมาณ {r.card_fees.toLocaleString()} ฿</div>}
            <div className="mt-2 text-[18px] text-[#4b5563]">รวมมัดจำที่รับวันนี้ด้วย</div>
          </Card>
          <div className="text-[22px] font-extrabold">บิลทั้งหมด</div>
          {r.bills.length === 0 && <div className="text-[20px] text-[#4b5563]">ยังไม่มีบิล</div>}
          {r.bills.map((b) => (
            <Card key={b.id} className={b.status === "void" ? "opacity-60" : ""}>
              <div className="flex justify-between gap-3 text-[21px]">
                <span className="font-bold">
                  #{b.bill_no} · {bkkTime(b.created_at)} น. · {b.customer_name}
                </span>
                <span className={`font-extrabold tabular-nums ${b.status === "void" ? "line-through" : ""}`}>{Number(b.total).toLocaleString()} ฿</span>
              </div>
              {b.status === "void" ? (
                <div className="text-[19px] text-[#b42318]">ยกเลิกแล้ว: {b.void_reason}</div>
              ) : (
                boot.isOwner && (
                  <Btn className="mt-2" tone="danger" onClick={() => setVoiding(b)}>
                    ยกเลิกบิลนี้
                  </Btn>
                )
              )}
            </Card>
          ))}
        </>
      )}
      <Sheet open={!!voiding} onClose={() => setVoiding(null)} title={`ยกเลิกบิล #${voiding?.bill_no || ""}`}>
        <div className="space-y-3">
          <div className="text-[20px]">ระบบจะบันทึกว่าคืนเงินลูกค้าแล้ว และคิวจะกลับไปรอเก็บเงินใหม่ (แก้แล้วเก็บเงินใหม่ได้)</div>
          <Field label="เหตุผล" value={reason} onChange={setReason} placeholder="เช่น ใส่ราคาผิด" />
          <Btn tone="danger" disabled={!reason.trim()} onClick={doVoid}>
            ยืนยันยกเลิกบิล
          </Btn>
        </div>
      </Sheet>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[#eceef1] py-2 text-[21px] last:border-0">
      <span>{k}</span>
      <span className="font-extrabold tabular-nums">{v.toLocaleString()} ฿</span>
    </div>
  );
}
