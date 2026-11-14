"use client";

import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useMemo, useState } from "react";
import { addDays, baht, calcBill, METHOD_LABEL, type Visit } from "@/lib/salon/shared";
import { promptpayPayload } from "@/lib/promptpay";
import { api, Btn, Card, ErrorBox, Field, Loading, Money, newKey, Sheet, Title, Toggle, useBoot, useHref } from "@/components/salon/ui";
import { visitName } from "@/components/salon/VisitCard";

type Method = "cash" | "transfer" | "card";
type Done = { bill_no?: number; total: number; points_earned: number; change: number; refund_deposit: number };

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  const { boot } = useBoot();
  const href = useHref();
  const [v, setV] = useState<Visit | null>(null);
  const [error, setError] = useState("");
  const [discount, setDiscount] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [method, setMethod] = useState<Method | null>(null);
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [qr, setQr] = useState("");
  const [discSheet, setDiscSheet] = useState(false);
  const [discText, setDiscText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [key] = useState(newKey);

  useEffect(() => {
    api<{ visit: Visit }>(`/api/salon/visits/${id}`)
      .then((r) => setV(r.visit))
      .catch((e) => setError(e.message));
  }, [id]);

  const calc = useMemo(() => {
    if (!v || !boot) return null;
    const lines = v.services.map((s) => ({
      kind: "service" as const,
      ref_id: s.service_id,
      name: s.name,
      qty: 1,
      unit_price: s.final_price ?? s.quoted_price,
      stylist_id: null,
      assistant_id: null,
    }));
    const base = { lines, discount, customer_points: v.customer?.points || 0, has_customer: !!v.customer_id, deposit_paid: v.deposit_paid, settings: boot.settings };
    // max_points ไม่ขึ้นกับ points_used — ใช้แต้ม = ใช้เต็มที่ใช้ได้
    return calcBill({ ...base, points_used: usePoints ? Number.MAX_SAFE_INTEGER : 0 });
  }, [v, boot, discount, usePoints]);

  // QR พร้อมเพย์ตามยอด
  useEffect(() => {
    setQr("");
    const pp = boot?.settings.pay.promptpay_id;
    if (method !== "transfer" || !pp || !calc || calc.due <= 0) return;
    try {
      QRCode.toDataURL(promptpayPayload(pp, calc.due), { width: 320, margin: 1 }).then(setQr).catch(() => {});
    } catch {}
  }, [method, boot, calc]);

  if (done) {
    const rebook = Math.max(0, ...(v?.services.map((s) => boot?.services.find((x) => x.id === s.service_id)?.rebook_days || 0) || [0]));
    const ids = (v?.services.map((s) => s.service_id).filter(Boolean) || []).join(",");
    return (
      <div className="space-y-4 text-center">
        <div className="text-[64px]">✅</div>
        <div className="text-[30px] font-extrabold">เก็บเงินเรียบร้อย</div>
        {done.bill_no && <div className="text-[21px] text-[#374151]">บิลเลขที่ {done.bill_no}</div>}
        {done.change > 0 && (
          <Card className="border-[#b45309] bg-[#fff4d6]">
            <div className="text-[24px] font-bold">ทอนเงินลูกค้า</div>
            <div className="text-[48px] font-extrabold text-[#9a3d00]">
              <Money value={done.change} />
            </div>
          </Card>
        )}
        {done.refund_deposit > 0 && (
          <Card className="border-[#b45309] bg-[#fff4d6]">
            <div className="text-[24px] font-bold">คืนมัดจำส่วนเกิน <Money value={done.refund_deposit} /></div>
          </Card>
        )}
        {done.points_earned > 0 && <div className="text-[22px]">ลูกค้าได้แต้ม +{done.points_earned}</div>}
        {v?.customer_id && (
          <Btn big tone="primary" href={href(`/salon/new?type=booking&customer=${v.customer_id}&services=${ids}&day=${addDays(boot!.today, rebook)}`)}>
            นัดครั้งต่อไป
          </Btn>
        )}
        <Btn big tone="plain" href={href("/salon")}>
          กลับหน้าวันนี้
        </Btn>
      </div>
    );
  }

  if (!boot || !v || !calc) return error ? <ErrorBox text={error} /> : <Loading />;
  if (v.bill) {
    return (
      <div className="space-y-4">
        <Title back={href(`/salon/visit/${v.id}`)}>เก็บเงิน</Title>
        <Card>คิวนี้จ่ายแล้ว บิลเลขที่ {v.bill.bill_no}</Card>
      </div>
    );
  }

  const cashIn = Number(received) || 0;
  const change = method === "cash" ? Math.max(0, cashIn - calc.due) : 0;
  const quick = [...new Set([calc.due, Math.ceil(calc.due / 100) * 100, Math.ceil(calc.due / 500) * 500, Math.ceil(calc.due / 1000) * 1000])].filter((x) => x >= calc.due && x > 0).slice(0, 4);
  const methods = (["cash", "transfer", "card"] as Method[]).filter((m) => boot.settings.pay[m]);
  const ready = calc.due <= 0 || (method === "cash" ? cashIn >= calc.due : !!method);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ bill_no?: number; total: number; points_earned: number; refund_deposit: number }>("/api/salon/checkout", {
        body: {
          visit_id: v.id,
          discount: calc.discount,
          points_used: calc.points_used,
          idem_key: key,
          payments: calc.due > 0 && method ? [{ method, amount: calc.due, reference }] : [],
        },
      });
      setDone({ ...r, change });
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Title back={href(`/salon/visit/${v.id}`)}>เก็บเงิน</Title>
      <div className="text-[23px] font-bold">{visitName(v)}</div>

      <Card>
        {calc.lines.map((l, i) => (
          <Line key={i} k={l.name} v={l.amount} />
        ))}
        {calc.discount > 0 && <Line k="ส่วนลด" v={-calc.discount} />}
        {calc.points_value > 0 && <Line k={`ใช้แต้ม ${calc.points_used}`} v={-calc.points_value} />}
        {calc.deposit_applied > 0 && <Line k="หักมัดจำที่จ่ายแล้ว" v={-calc.deposit_applied} />}
        <div className="mt-3 rounded-2xl bg-[#1f4e8c] p-4 text-center text-white">
          <div className="text-[22px] font-bold">ต้องจ่าย</div>
          <div className="text-[52px] font-extrabold leading-tight">
            <Money value={calc.due} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3">
        <Btn tone="soft" onClick={() => { setDiscText(discount ? String(discount) : ""); setDiscSheet(true); }}>
          {discount ? `ส่วนลด ${baht(discount)} ฿ (แก้)` : "ลดราคา"}
        </Btn>
        {boot.settings.points.enabled && v.customer && (
          calc.max_points > 0 ? (
            <Toggle
              label={usePoints ? `ใช้แต้ม ${calc.points_used} ลด ${baht(calc.points_value)} ฿` : "ใช้แต้มสะสม"}
              hint={`ลูกค้ามี ${v.customer.points} แต้ม`}
              on={usePoints}
              onChange={setUsePoints}
            />
          ) : (
            <div className="text-[19px] text-[#4b5563]">ลูกค้ามี {v.customer.points} แต้ม (ยังใช้ไม่ได้)</div>
          )
        )}
      </div>

      {calc.due > 0 && (
        <>
          <div className="text-[23px] font-extrabold">ลูกค้าจ่ายด้วยอะไร?</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {methods.map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setReceived(""); setReference(""); }}
                className={`min-h-[84px] rounded-2xl border-[3px] text-[24px] font-extrabold ${
                  method === m ? "border-[#1d7a46] bg-[#1d7a46] text-white" : "border-[#9aa3ae] bg-white"
                }`}
              >
                {m === "cash" ? "💵 " : m === "transfer" ? "📱 " : "💳 "}
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </>
      )}

      {method === "cash" && calc.due > 0 && (
        <Card>
          <div className="mb-2 text-[21px] font-bold">รับเงินมาเท่าไร?</div>
          <div className="grid grid-cols-2 gap-3">
            {quick.map((q) => (
              <Btn key={q} tone={cashIn === q ? "green" : "plain"} onClick={() => setReceived(String(q))}>
                {q === calc.due ? `พอดี ${baht(q)}` : baht(q)}
              </Btn>
            ))}
          </div>
          <div className="mt-3">
            <Field label="หรือพิมพ์จำนวนเงิน" value={received} onChange={(x) => setReceived(x.replace(/[^\d.]/g, ""))} inputMode="decimal" />
          </div>
          {cashIn > 0 && cashIn < calc.due && <ErrorBox text={`ยังขาดอีก ${baht(calc.due - cashIn)} ฿`} />}
          {cashIn >= calc.due && (
            <div className="mt-3 rounded-2xl bg-[#fff4d6] p-4 text-center">
              <div className="text-[22px] font-bold">เงินทอน</div>
              <div className="text-[44px] font-extrabold text-[#9a3d00]">
                <Money value={change} />
              </div>
            </div>
          )}
        </Card>
      )}

      {method === "transfer" && calc.due > 0 && (
        <Card className="text-center">
          {qr ? (
            <>
              <div className="text-[21px] font-bold">ให้ลูกค้าสแกนจ่าย</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR พร้อมเพย์" className="mx-auto my-3 w-[280px] max-w-full" />
            </>
          ) : (
            <div className="text-[21px]">ให้ลูกค้าโอนเงิน {baht(calc.due)} ฿</div>
          )}
          <div className="text-[20px] font-bold text-[#b42318]">ดูในแอปธนาคารว่าเงินเข้าแล้ว ก่อนกดยืนยัน</div>
        </Card>
      )}

      {method === "card" && calc.due > 0 && (
        <Card>
          <div className="text-[22px] font-bold">รูดบัตรที่เครื่องของธนาคาร ยอด {baht(calc.due)} ฿</div>
          <div className="mt-1 text-[19px] text-[#4b5563]">ได้สลิปแล้วค่อยกดยืนยัน</div>
          <div className="mt-3">
            <Field label="เลขอนุมัติบนสลิป (ไม่ใส่ก็ได้)" value={reference} onChange={setReference} />
          </div>
        </Card>
      )}

      <ErrorBox text={error} />
      <Btn big tone="green" disabled={!ready || busy} onClick={submit}>
        {busy ? "กำลังบันทึก…" : calc.due <= 0 ? "ปิดบิล (ไม่ต้องรับเงินเพิ่ม)" : method === "cash" ? "รับเงินแล้ว ปิดบิล" : method ? "ได้รับเงินแล้ว ปิดบิล" : "เลือกวิธีจ่ายก่อน"}
      </Btn>

      <Sheet open={discSheet} onClose={() => setDiscSheet(false)} title="ลดราคา">
        <div className="space-y-3">
          <Field label="ลดกี่บาท" value={discText} onChange={(x) => setDiscText(x.replace(/[^\d.]/g, ""))} inputMode="decimal" autoFocus />
          <Btn tone="green" onClick={() => { setDiscount(Math.min(calc.subtotal, Number(discText) || 0)); setDiscSheet(false); }}>
            ตกลง
          </Btn>
          {discount > 0 && (
            <Btn tone="plain" onClick={() => { setDiscount(0); setDiscSheet(false); }}>
              ไม่ลดแล้ว
            </Btn>
          )}
        </div>
      </Sheet>
    </div>
  );
}

function Line({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between gap-3 py-1 text-[21px]">
      <span>{k}</span>
      <span className={`tabular-nums font-bold ${v < 0 ? "text-[#b42318]" : ""}`}>
        {v < 0 ? "−" : ""}
        {baht(Math.abs(v))} ฿
      </span>
    </div>
  );
}
