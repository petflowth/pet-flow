"use client";

import { useEffect, useState } from "react";
import { baht, type SalonSettings, type Service } from "@/lib/salon/shared";
import { api, Btn, Card, ErrorBox, Field, Loading, Sheet, Title, Toggle, useBoot } from "@/components/salon/ui";

const DAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function SettingsPage() {
  const { boot, reload } = useBoot();
  const [s, setS] = useState<SalonSettings | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadServices = () =>
    api<{ services: Service[] }>("/api/salon/services")
      .then((r) => setServices(r.services))
      .catch((e) => setError(e.message));

  useEffect(() => {
    if (boot && !s) setS(boot.settings);
  }, [boot, s]);
  useEffect(() => {
    loadServices();
  }, []);

  if (!boot || !s) return <Loading />;
  if (!boot.isOwner) return <ErrorBox text="หน้านี้สำหรับเจ้าของร้านเท่านั้น" />;

  const up = (fn: (x: SalonSettings) => SalonSettings) => setS((x) => (x ? fn(structuredClone(x)) : x));

  const saveSettings = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ settings: SalonSettings }>("/api/salon/settings", { method: "PUT", body: { settings: s } });
      setS(r.settings);
      await reload();
      setMsg("บันทึกการตั้งค่าแล้ว");
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveService = async () => {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      if (editing.id) await api(`/api/salon/services/${editing.id}`, { method: "PATCH", body: editing });
      else await api("/api/salon/services", { body: { ...editing, sort: (services?.length || 0) + 1 } });
      setEditing(null);
      await Promise.all([loadServices(), reload()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const seed = async () => {
    setBusy(true);
    try {
      await api("/api/salon/services", { body: { seed: true } });
      await Promise.all([loadServices(), reload()]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const numField = (v: number | undefined) => (v == null || Number.isNaN(v) ? "" : String(v));
  const toNum = (v: string) => Number(v.replace(/[^\d.]/g, "")) || 0;

  return (
    <div className="space-y-5">
      <Title>ตั้งค่าร้าน</Title>
      {msg && <div className="rounded-2xl bg-[#dff3e6] p-3 text-[21px] font-bold text-[#155c35]">✅ {msg}</div>}
      <ErrorBox text={error} />

      {/* ───── บริการ */}
      <section className="space-y-3">
        <h2 className="text-[24px] font-extrabold">บริการและราคา</h2>
        {services === null ? (
          <Loading />
        ) : (
          <>
            {services.length === 0 && (
              <Card className="space-y-3">
                <div className="text-[21px]">ยังไม่มีบริการ — ใส่ตัวอย่างให้ก่อน แล้วค่อยแก้ราคาเองได้</div>
                <Btn tone="green" disabled={busy} onClick={seed}>
                  ใส่บริการตัวอย่าง (ตัด สระ ทำสี ดัด ยืด ทรีตเมนต์)
                </Btn>
              </Card>
            )}
            {services.map((sv) => (
              <Card key={sv.id} onClick={() => setEditing(sv)} className={sv.active ? "" : "opacity-50"}>
                <div className="flex justify-between gap-3">
                  <span className="text-[22px] font-bold">
                    {sv.name}
                    {!sv.active && " (ซ่อนอยู่)"}
                  </span>
                  <span className="text-[22px] font-bold tabular-nums">
                    {sv.price_from ? "เริ่ม " : ""}
                    {baht(sv.price)} ฿
                  </span>
                </div>
                <div className="text-[18px] text-[#4b5563]">ใช้เวลา {sv.duration_min} นาที · แตะเพื่อแก้</div>
              </Card>
            ))}
            <Btn tone="primary" onClick={() => setEditing({ name: "", price: 0, duration_min: 30, category: "ทั่วไป", active: true })}>
              + เพิ่มบริการ
            </Btn>
          </>
        )}
      </section>

      {/* ───── ร้าน */}
      <section className="space-y-3">
        <h2 className="text-[24px] font-extrabold">ร้าน</h2>
        <Field label="ชื่อร้าน" value={s.shop_name} onChange={(v) => up((x) => ({ ...x, shop_name: v }))} />
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect label="เปิดกี่โมง" value={s.open} onChange={(v) => up((x) => ({ ...x, open: v }))} />
          <TimeSelect label="ปิดกี่โมง" value={s.close} onChange={(v) => up((x) => ({ ...x, close: v }))} />
        </div>
        <div>
          <div className="mb-2 text-[20px] font-bold">วันหยุดประจำ (แตะเลือก)</div>
          <div className="grid grid-cols-7 gap-2">
            {DAYS.map((d, i) => {
              const off = s.closed_weekdays.includes(i);
              return (
                <button
                  key={d}
                  onClick={() => up((x) => ({ ...x, closed_weekdays: off ? x.closed_weekdays.filter((y) => y !== i) : [...x.closed_weekdays, i] }))}
                  className={`min-h-[60px] rounded-2xl border-2 text-[20px] font-bold ${off ? "border-[#b42318] bg-[#fdecea] text-[#b42318]" : "border-[#9aa3ae] bg-white"}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 text-[20px] font-bold">ให้จองได้ทุกกี่นาที</div>
          <div className="grid grid-cols-3 gap-2">
            {[15, 30, 60].map((m) => (
              <Btn key={m} tone={s.slot_step === m ? "green" : "plain"} onClick={() => up((x) => ({ ...x, slot_step: m }))}>
                {m} นาที
              </Btn>
            ))}
          </div>
        </div>
      </section>

      {/* ───── รับเงิน */}
      <section className="space-y-3">
        <h2 className="text-[24px] font-extrabold">การรับเงิน</h2>
        <Toggle label="รับเงินสด" on={s.pay.cash} onChange={(v) => up((x) => ({ ...x, pay: { ...x.pay, cash: v } }))} />
        <Toggle label="รับโอน / พร้อมเพย์" on={s.pay.transfer} onChange={(v) => up((x) => ({ ...x, pay: { ...x.pay, transfer: v } }))} />
        {s.pay.transfer && (
          <Field
            label="เบอร์พร้อมเพย์ (ใส่แล้วจะขึ้น QR ให้ลูกค้าสแกน)"
            value={s.pay.promptpay_id}
            onChange={(v) => up((x) => ({ ...x, pay: { ...x.pay, promptpay_id: v.replace(/\D/g, "").slice(0, 13) } }))}
            inputMode="numeric"
          />
        )}
        <Toggle label="รับบัตร (เครื่องรูดของธนาคาร)" on={s.pay.card} onChange={(v) => up((x) => ({ ...x, pay: { ...x.pay, card: v } }))} />
        {s.pay.card && (
          <Field
            label="ค่าธรรมเนียมบัตร % (ไว้ดูเงินเข้าจริง)"
            value={numField(s.pay.card_fee_pct)}
            onChange={(v) => up((x) => ({ ...x, pay: { ...x.pay, card_fee_pct: toNum(v) } }))}
            inputMode="decimal"
          />
        )}
      </section>

      {/* ───── มัดจำ / แต้ม (ปิดไว้ก่อน) */}
      <section className="space-y-3">
        <h2 className="text-[24px] font-extrabold">ตัวเลือกเพิ่มเติม</h2>
        <Toggle
          label="เก็บมัดจำตอนจอง"
          hint="เฉพาะบริการที่ติ๊ก “ต้องมัดจำ” เช่น ทำสี ยืด"
          on={s.deposit.enabled}
          onChange={(v) => up((x) => ({ ...x, deposit: { ...x.deposit, enabled: v } }))}
        />
        {s.deposit.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="มัดจำ % ของราคา" value={numField(s.deposit.pct)} onChange={(v) => up((x) => ({ ...x, deposit: { ...x.deposit, pct: toNum(v) } }))} inputMode="numeric" />
            <Field label="อย่างน้อย (บาท)" value={numField(s.deposit.min)} onChange={(v) => up((x) => ({ ...x, deposit: { ...x.deposit, min: toNum(v) } }))} inputMode="numeric" />
          </div>
        )}
        <Toggle
          label="แต้มสะสม"
          hint={`จ่ายทุก ${s.points.baht_per_point} บาท ได้ 1 แต้ม · ${s.points.redeem_points} แต้ม ลด ${s.points.redeem_value} บาท`}
          on={s.points.enabled}
          onChange={(v) => up((x) => ({ ...x, points: { ...x.points, enabled: v } }))}
        />
        {s.points.enabled && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="จ่ายกี่บาท ได้ 1 แต้ม" value={numField(s.points.baht_per_point)} onChange={(v) => up((x) => ({ ...x, points: { ...x.points, baht_per_point: toNum(v) } }))} inputMode="numeric" />
            <Field label="ใช้ทีละกี่แต้ม" value={numField(s.points.redeem_points)} onChange={(v) => up((x) => ({ ...x, points: { ...x.points, redeem_points: toNum(v) } }))} inputMode="numeric" />
            <Field label="ลดได้กี่บาท" value={numField(s.points.redeem_value)} onChange={(v) => up((x) => ({ ...x, points: { ...x.points, redeem_value: toNum(v) } }))} inputMode="numeric" />
          </div>
        )}
      </section>

      <div className="sticky bottom-[84px] z-10">
        <Btn big tone="green" disabled={busy} onClick={saveSettings}>
          บันทึกการตั้งค่า
        </Btn>
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "แก้บริการ" : "เพิ่มบริการ"}>
        {editing && (
          <div className="space-y-3">
            <Field label="ชื่อบริการ" value={editing.name || ""} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label="ราคา (บาท)" value={numField(editing.price)} onChange={(v) => setEditing({ ...editing, price: toNum(v) })} inputMode="decimal" />
            <Toggle
              label="ราคาเริ่มต้น"
              hint="ราคาจริงขึ้นกับผมยาว/สั้น ใส่ราคาจริงตอนเก็บเงิน"
              on={!!editing.price_from}
              onChange={(v) => setEditing({ ...editing, price_from: v })}
            />
            <Field label="ใช้เวลากี่นาที" value={numField(editing.duration_min)} onChange={(v) => setEditing({ ...editing, duration_min: toNum(v) })} inputMode="numeric" />
            <Toggle
              label="มีช่วงรอ (เช่น รอสีขึ้น)"
              hint="ระหว่างรอ รับลูกค้าอื่นได้ เช่น ตัดผม"
              on={(editing.wait_min || 0) > 0}
              onChange={(v) => setEditing({ ...editing, wait_min: v ? 30 : 0, wait_after_min: v ? 30 : 0 })}
            />
            {(editing.wait_min || 0) > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="ทำไปกี่นาทีแล้วรอ" value={numField(editing.wait_after_min)} onChange={(v) => setEditing({ ...editing, wait_after_min: toNum(v) })} inputMode="numeric" />
                <Field label="รอกี่นาที" value={numField(editing.wait_min)} onChange={(v) => setEditing({ ...editing, wait_min: toNum(v) })} inputMode="numeric" />
              </div>
            )}
            {s.deposit.enabled && (
              <Toggle label="ต้องมัดจำตอนจอง" on={!!editing.needs_deposit} onChange={(v) => setEditing({ ...editing, needs_deposit: v })} />
            )}
            <Field
              label="ลูกค้าควรกลับมาอีกกี่วัน (ไม่ใส่ก็ได้)"
              value={editing.rebook_days ? String(editing.rebook_days) : ""}
              onChange={(v) => setEditing({ ...editing, rebook_days: toNum(v) || null })}
              inputMode="numeric"
            />
            <ErrorBox text={error} />
            <Btn tone="green" disabled={busy || !editing.name?.trim()} onClick={saveService}>
              บันทึก
            </Btn>
            {editing.id && (
              <Btn
                tone={editing.active ? "danger" : "plain"}
                disabled={busy}
                onClick={async () => {
                  await api(`/api/salon/services/${editing.id}`, { method: "PATCH", body: { active: !editing.active } });
                  setEditing(null);
                  await Promise.all([loadServices(), reload()]);
                }}
              >
                {editing.active ? "ซ่อนบริการนี้ (เลิกขาย)" : "เอากลับมาขาย"}
              </Btn>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

const TIMES = Array.from({ length: 37 }, (_, i) => {
  const m = 5 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${m % 60 ? "30" : "00"}`;
});

/** เลือกเวลาแบบ 24 ชม. (ช่องเวลาของเบราว์เซอร์บางเครื่องขึ้น AM/PM อ่านยาก) */
function TimeSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[20px] font-bold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-[64px] w-full rounded-2xl border-2 border-[#9aa3ae] bg-white px-4 text-[22px]"
      >
        {(TIMES.includes(value) ? TIMES : [value, ...TIMES]).map((t) => (
          <option key={t} value={t}>
            {t} น.
          </option>
        ))}
      </select>
    </label>
  );
}
