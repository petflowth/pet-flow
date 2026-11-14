"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, baht, thaiDay, type Customer, type Service } from "@/lib/salon/shared";
import { api, Btn, Card, ErrorBox, Field, Loading } from "./ui";

// ───────────── เลือกลูกค้า

export type PickedCustomer =
  | { kind: "existing"; customer: Customer }
  | { kind: "new"; name: string; phone: string }
  | { kind: "guest" };

export function CustomerPicker({ allowGuest, onPick }: { allowGuest?: boolean; onPick: (c: PickedCustomer) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Customer[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await api<{ customers: Customer[] }>(`/api/salon/customers?q=${encodeURIComponent(q)}`);
        setList(r.customers);
      } catch {
        setList([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  if (adding) {
    return (
      <div className="space-y-4">
        <Field label="ชื่อลูกค้า" value={name} onChange={setName} autoFocus />
        <Field label="เบอร์โทร (ไม่ใส่ก็ได้)" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))} inputMode="tel" />
        <Btn tone="green" disabled={!name.trim() && phone.length < 9} onClick={() => onPick({ kind: "new", name: name.trim(), phone })}>
          ต่อไป
        </Btn>
        <Btn tone="plain" onClick={() => setAdding(false)}>
          ย้อนกลับ ค้นหาลูกค้าเก่า
        </Btn>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Field label="ค้นหาชื่อ หรือ เบอร์โทร" value={q} onChange={setQ} inputMode="search" placeholder="เช่น สมศรี หรือ 0812" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Btn tone="primary" onClick={() => {
          const digits = q.replace(/\D/g, "");
          setPhone(digits.length >= 9 ? digits : "");
          setName(digits.length >= 9 ? "" : q.trim());
          setAdding(true);
        }}>
          + ลูกค้าใหม่
        </Btn>
        {allowGuest && (
          <Btn tone="plain" onClick={() => onPick({ kind: "guest" })}>
            ไม่ต้องใส่ชื่อ
          </Btn>
        )}
      </div>
      {list === null ? (
        <Loading />
      ) : (
        <div className="space-y-2">
          {list.length === 0 && q && <div className="py-4 text-center text-[20px] text-[#4b5563]">ไม่พบ — กด “ลูกค้าใหม่”</div>}
          {list.map((c) => (
            <Card key={c.id} onClick={() => onPick({ kind: "existing", customer: c })}>
              <div className="text-[23px] font-bold">
                {c.name}
                {c.nickname ? ` (${c.nickname})` : ""}
              </div>
              <div className="text-[19px] text-[#374151]">{c.phone || "ไม่มีเบอร์"}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────── เลือกบริการ (แตะเพื่อเลือก/เลิกเลือก)

export function ServicePicker({
  services,
  selected,
  onChange,
}: {
  services: Service[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of services) m.set(s.category || "ทั่วไป", [...(m.get(s.category || "ทั่วไป") || []), s]);
    return [...m.entries()];
  }, [services]);
  if (!services.length) return <ErrorBox text="ยังไม่มีรายการบริการ — ไปเพิ่มที่หน้า ตั้งค่า" />;
  return (
    <div className="space-y-4">
      {groups.map(([cat, list]) => (
        <div key={cat}>
          {groups.length > 1 && <div className="mb-2 text-[20px] font-bold text-[#4b5563]">{cat}</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange(on ? selected.filter((x) => x !== s.id) : [...selected, s.id])}
                  className={`min-h-[84px] rounded-2xl border-[3px] px-4 py-3 text-left ${
                    on ? "border-[#1d7a46] bg-[#dff3e6]" : "border-[#d5d9de] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[23px] font-bold">{s.name}</span>
                    <span className={`text-[26px] ${on ? "" : "opacity-0"}`}>✅</span>
                  </div>
                  <div className="text-[19px] text-[#374151]">
                    {s.price_from ? "เริ่ม " : ""}
                    {baht(s.price)} ฿ · {s.duration_min} นาที
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────── เลือกวันและเวลา

type Avail = { day: string; closed: boolean; times: string[] };

export function TimePicker({
  today,
  initialDay,
  query,
  onPick,
}: {
  today: string;
  initialDay?: string;
  /** ต่อท้าย URL: services=a,b หรือ visit=id */
  query: string;
  onPick: (day: string, time: string) => void;
}) {
  const [day, setDay] = useState(initialDay && initialDay >= today ? initialDay : today);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [error, setError] = useState("");
  const days = useMemo(() => {
    const list = Array.from({ length: 21 }, (_, i) => addDays(today, i));
    if (!list.includes(day)) list.push(day);
    return list;
  }, [today, day]);

  useEffect(() => {
    setAvail(null);
    api<Avail>(`/api/salon/availability?day=${day}&${query}`)
      .then((r) => {
        setAvail(r);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [day, query]);

  const label = (d: string) => (d === today ? "วันนี้" : d === addDays(today, 1) ? "พรุ่งนี้" : thaiDay(d).replace("วัน", ""));

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-[20px] font-bold">เลือกวัน</div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDay(d)}
              className={`min-h-[64px] shrink-0 rounded-2xl border-[3px] px-4 text-[20px] font-bold ${
                d === day ? "border-[#1f4e8c] bg-[#1f4e8c] text-white" : "border-[#d5d9de] bg-white"
              }`}
            >
              {label(d)}
            </button>
          ))}
        </div>
        <div className="text-[20px] font-bold text-[#1f4e8c]">{thaiDay(day)}</div>
      </div>
      <ErrorBox text={error} />
      <div>
        <div className="mb-2 text-[20px] font-bold">เลือกเวลา (เฉพาะเวลาที่ว่าง)</div>
        {!avail ? (
          <Loading />
        ) : avail.closed ? (
          <div className="rounded-2xl bg-white p-6 text-center text-[21px]">วันนี้ร้านปิด</div>
        ) : avail.times.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-[21px]">วันนี้เต็มแล้ว ลองวันอื่น</div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {avail.times.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onPick(day, t)}
                className="min-h-[68px] rounded-2xl border-[3px] border-[#1f4e8c] bg-white text-[26px] font-extrabold tabular-nums text-[#1f4e8c] active:bg-[#e8eef7]"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
