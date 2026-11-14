"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { baht, bkkDay, bkkTime, METHOD_LABEL, STATUS_LABEL, thaiDay, type Visit, type VisitService } from "@/lib/salon/shared";
import { api, Btn, Card, ErrorBox, Field, Loading, Money, newKey, Sheet, Title, useBoot, useHref } from "@/components/salon/ui";
import { STATUS_COLOR, visitName } from "@/components/salon/VisitCard";
import { TimePicker } from "@/components/salon/pickers";

function VisitPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const href = useHref();
  const { boot } = useBoot();
  const [v, setV] = useState<Visit | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"" | "add" | "price" | "move" | "cancel" | "deposit">("");
  const [priceIdx, setPriceIdx] = useState(-1);
  const [priceText, setPriceText] = useState("");

  const load = useCallback(async () => {
    try {
      setV((await api<{ visit: Visit }>(`/api/salon/visits/${id}`)).visit);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (!boot || !v) return error ? <ErrorBox text={error} /> : <Loading />;

  const closed = ["done", "cancelled", "no_show"].includes(v.status) || !!v.bill;
  const total = v.services.reduce((a, s) => a + (s.final_price ?? s.quoted_price), 0);
  const unconfirmed = v.services.findIndex((s) => s.price_from && s.final_price == null);

  const patch = async (b: Record<string, unknown>, after?: () => void) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ overlap?: boolean }>(`/api/salon/visits/${id}`, { method: "PATCH", body: b });
      if (r.overlap) alert("บันทึกแล้ว แต่เวลาจะเลยไปชนคิวถัดไป ระวังด้วย");
      setSheet("");
      after?.();
      await load();
    } catch (e) {
      const msg = (e as Error).message;
      // เพิ่มบริการแล้วเวลาชนคิวถัดไป — ถามก่อนว่าจะเพิ่มต่อไหม
      if (b.action === "services" && msg.includes("มีคิวอื่น") && confirm("เวลาจะเลยไปชนคิวถัดไป ยังจะเพิ่มบริการนี้ไหม?")) {
        await patch({ ...b, force: true }, after);
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const items = (list: VisitService[]) =>
    list.map((s) => ({ service_id: s.service_id, name: s.name, price: s.final_price }));

  const addService = (sid: string) => {
    const s = boot.services.find((x) => x.id === sid);
    if (!s) return;
    patch({
      action: "services",
      version: v.version,
      items: [...items(v.services), { service_id: s.id, name: s.name, price: s.price_from ? null : s.price }],
    });
  };
  const removeService = (i: number) => {
    if (v.services.length <= 1) return setError("ต้องเหลือบริการอย่างน้อย 1 อย่าง");
    if (!confirm(`เอา "${v.services[i].name}" ออก?`)) return;
    patch({ action: "services", version: v.version, items: items(v.services.filter((_, j) => j !== i)) });
  };
  const savePrice = () => {
    const price = Number(priceText);
    if (!(price >= 0) || priceText === "") return setError("ใส่ราคา");
    const list = items(v.services);
    list[priceIdx] = { ...list[priceIdx], price };
    patch({ action: "services", version: v.version, items: list });
  };

  const phone = v.customer?.phone;
  return (
    <div className="space-y-4">
      <Title back={href("/salon")}>{visitName(v)}</Title>
      {sp.get("saved") && <div className="rounded-2xl bg-[#dff3e6] p-4 text-[22px] font-bold text-[#155c35]">✅ บันทึกการจองแล้ว</div>}

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[26px] font-extrabold tabular-nums">{bkkTime(v.start_at)}–{bkkTime(v.end_at)} น.</div>
            <div className="text-[20px] text-[#374151]">{thaiDay(bkkDay(v.start_at))}</div>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[19px] font-bold ${STATUS_COLOR[v.status]}`}>{STATUS_LABEL[v.status]}</span>
        </div>
        {phone && (
          <a href={`tel:${phone}`} className="mt-3 flex min-h-[60px] items-center justify-center rounded-2xl border-2 border-[#1f4e8c] text-[22px] font-bold text-[#1f4e8c]">
            📞 โทร {phone}
          </a>
        )}
        {v.customer && (
          <Btn className="mt-3" tone="soft" href={href(`/salon/customers/${v.customer.id}`)}>
            ดูประวัติลูกค้า
          </Btn>
        )}
        {v.note && <div className="mt-3 text-[20px]">📝 {v.note}</div>}
      </Card>

      {v.customer?.allergies && <ErrorBox text={`⚠️ ลูกค้าแพ้: ${v.customer.allergies}`} />}

      <Card>
        <div className="mb-2 text-[22px] font-extrabold">บริการ</div>
        {v.services.map((s, i) => (
          <div key={s.id || i} className="border-b border-[#eceef1] py-3 last:border-0">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[22px] font-bold">{s.name}</div>
              <div className="text-[22px] font-bold tabular-nums">
                {s.price_from && s.final_price == null ? `เริ่ม ${baht(s.quoted_price)}` : baht(s.final_price ?? s.quoted_price)} ฿
              </div>
            </div>
            {!closed && (
              <div className={`mt-2 grid gap-2 ${v.services.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                <Btn tone={s.price_from && s.final_price == null ? "primary" : "plain"} onClick={() => {
                  setPriceIdx(i);
                  setPriceText(String(s.final_price ?? s.quoted_price));
                  setSheet("price");
                }}>
                  {s.price_from && s.final_price == null ? "ใส่ราคาจริง" : "แก้ราคา"}
                </Btn>
                {v.services.length > 1 && (
                  <Btn tone="danger" onClick={() => removeService(i)}>
                    เอาออก
                  </Btn>
                )}
              </div>
            )}
          </div>
        ))}
        <div className="mt-2 flex justify-between text-[24px] font-extrabold">
          <span>รวม</span>
          <Money value={total} />
        </div>
        {!closed && (
          <Btn className="mt-3" tone="soft" onClick={() => setSheet("add")}>
            + เพิ่มบริการ
          </Btn>
        )}
      </Card>

      {(v.deposit_required > 0 || v.deposit_paid > 0) && (
        <Card>
          <div className="text-[22px] font-extrabold">มัดจำ</div>
          <div className="text-[21px]">
            ต้องเก็บ {baht(v.deposit_required)} ฿ · รับแล้ว <b>{baht(v.deposit_paid)} ฿</b>
          </div>
          {!closed && v.deposit_paid < v.deposit_required && (
            <Btn className="mt-3" tone="primary" onClick={() => setSheet("deposit")}>
              รับมัดจำ
            </Btn>
          )}
        </Card>
      )}

      <ErrorBox text={error} />

      {v.bill && (
        <Card className="border-[#1d7a46] bg-[#dff3e6]">
          <div className="text-[22px] font-extrabold text-[#155c35]">จ่ายแล้ว บิลเลขที่ {v.bill.bill_no} · {baht(v.bill.total)} ฿</div>
        </Card>
      )}

      {!closed && (
        <div className="space-y-3">
          {["booked", "confirmed", "arrived", "waiting"].includes(v.status) && (
            <Btn big tone="primary" disabled={busy} onClick={() => patch({ action: "start" })}>
              ลูกค้ามาแล้ว เริ่มทำ
            </Btn>
          )}
          {unconfirmed >= 0 && ["in_service", "awaiting_payment"].includes(v.status) && (
            <div className="rounded-2xl bg-[#fff4d6] p-3 text-[20px] font-bold text-[#7a5200]">
              ใส่ราคาจริงของ “{v.services[unconfirmed].name}” ก่อนเก็บเงิน
            </div>
          )}
          {["in_service", "awaiting_payment", "arrived", "waiting"].includes(v.status) && (
            <Btn big tone="green" disabled={unconfirmed >= 0} href={href(`/salon/pay/${v.id}`)}>
              เก็บเงิน
            </Btn>
          )}
          {["booked", "confirmed"].includes(v.status) && (
            <Btn tone="plain" onClick={() => setSheet("move")}>
              เลื่อนนัด
            </Btn>
          )}
          {v.status === "in_service" && (
            <Btn tone="plain" disabled={busy} onClick={() => patch({ action: "undo_start" })}>
              กดผิด — ยังไม่ได้เริ่มทำ
            </Btn>
          )}
          <Btn tone="danger" onClick={() => setSheet("cancel")}>
            ยกเลิกคิว / ลูกค้าไม่มา
          </Btn>
        </div>
      )}

      <Sheet open={sheet === "add"} onClose={() => setSheet("")} title="เพิ่มบริการ">
        <div className="grid grid-cols-1 gap-3">
          {boot.services.map((s) => (
            <Btn key={s.id} tone="plain" disabled={busy} onClick={() => addService(s.id)}>
              {s.name} · {s.price_from ? "เริ่ม " : ""}
              {baht(s.price)} ฿
            </Btn>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === "price"} onClose={() => setSheet("")} title={`ราคา ${v.services[priceIdx]?.name || ""}`}>
        <div className="space-y-4">
          <Field label="ราคาจริง (บาท)" value={priceText} onChange={(x) => setPriceText(x.replace(/[^\d.]/g, ""))} inputMode="decimal" autoFocus />
          <Btn tone="green" disabled={busy} onClick={savePrice}>
            บันทึกราคา
          </Btn>
        </div>
      </Sheet>

      <Sheet open={sheet === "move"} onClose={() => setSheet("")} title="เลื่อนนัดไปวันไหน">
        <TimePicker
          today={boot.today}
          initialDay={bkkDay(v.start_at)}
          query={`visit=${v.id}`}
          onPick={(day, time) => {
            if (confirm(`เลื่อนไป ${thaiDay(day)} ${time} น. ?`)) patch({ action: "reschedule", day, time });
          }}
        />
      </Sheet>

      <Sheet open={sheet === "cancel"} onClose={() => setSheet("")} title="ยกเลิกคิวนี้">
        <div className="space-y-3">
          {v.deposit_paid > 0 && (
            <div className="rounded-2xl bg-[#fff4d6] p-4 text-[20px] font-bold text-[#7a5200]">
              ลูกค้าจ่ายมัดจำไว้ {baht(v.deposit_paid)} ฿ — ถ้าจะคืนเงิน ให้คืนเองแล้วจดไว้
            </div>
          )}
          <Btn tone="danger" disabled={busy} onClick={() => patch({ action: "cancel", reason: "ลูกค้าขอยกเลิก" }, () => router.push(href("/salon")))}>
            ลูกค้าขอยกเลิก
          </Btn>
          <Btn tone="danger" disabled={busy} onClick={() => patch({ action: "no_show" }, () => router.push(href("/salon")))}>
            ลูกค้าไม่มา (ไม่ได้บอก)
          </Btn>
        </div>
      </Sheet>

      <DepositSheet open={sheet === "deposit"} onClose={() => setSheet("")} visit={v} onDone={load} />
    </div>
  );
}

function DepositSheet({ open, onClose, visit, onDone }: { open: boolean; onClose: () => void; visit: Visit; onDone: () => void }) {
  const { boot } = useBoot();
  const [amount, setAmount] = useState("");
  const [key] = useState(newKey);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setAmount(String(Math.max(0, visit.deposit_required - visit.deposit_paid)));
  }, [open, visit]);
  const methods = (["cash", "transfer", "card"] as const).filter((m) => boot?.settings.pay[m]);
  const pay = async (method: string) => {
    setBusy(true);
    setError("");
    try {
      await api(`/api/salon/visits/${visit.id}/deposit`, { body: { method, amount: Number(amount), idem_key: key } });
      onClose();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="รับมัดจำ">
      <div className="space-y-3">
        <Field label="จำนวนเงิน (บาท)" value={amount} onChange={(x) => setAmount(x.replace(/[^\d.]/g, ""))} inputMode="decimal" />
        <div className="text-[20px] font-bold">ลูกค้าจ่ายด้วยอะไร?</div>
        {methods.map((m) => (
          <Btn key={m} tone="green" disabled={busy || !(Number(amount) > 0)} onClick={() => pay(m)}>
            {METHOD_LABEL[m]}
          </Btn>
        ))}
        <ErrorBox text={error} />
      </div>
    </Sheet>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <VisitPage />
    </Suspense>
  );
}
