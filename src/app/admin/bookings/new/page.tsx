"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { RoomType } from "@/lib/business";
import type { CustomerRecord } from "@/lib/customers-store";
import { CustomerSendButtons } from "@/components/CustomerSendButtons";
import { toast } from "@/components/Toast";

type CustomerListItem = CustomerRecord & { upcomingAppointments?: number };

const FREEBIE_OPTIONS = ["กล้องวงจรปิด (CCTV)", "น้ำพุแมว", "รับ-ส่ง", "ขนม/ทรีท"];

function CustomerPicker({
  onSelect,
}: {
  onSelect: (data: {
    customerId: string;
    customerName: string;
    catNames: string[];
    lineUserId?: string;
  }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerListItem[]>([]);
  const [recent, setRecent] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [openCustomerId, setOpenCustomerId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // โหลดลูกค้าสมัครล่าสุดไว้ล่วงหน้า — โชว์เป็นลิสต์ให้เลือกได้ทันทีโดยไม่ต้องพิมพ์ค้นหา
  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((d) => {
        const sorted = [...((d.customers || []) as CustomerListItem[])].sort(
          (a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")
        );
        const top = sorted.slice(0, 20);
        setRecent(top);
        setResults((prev) => (prev.length === 0 ? top : prev));
      })
      .catch(() => {});
  }, []);

  const search = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults(recent);
        return;
      }
      setLoading(true);
      const res = await fetch(`/api/customers?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setResults(data.customers || []);
      setLoading(false);
    },
    [recent]
  );

  useEffect(() => {
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const openCustomer = (c: CustomerListItem) => {
    if (c.cats.length === 0) {
      onSelect({
        customerId: c.id,
        customerName: c.name,
        catNames: [],
        lineUserId: c.lineUserId,
      });
      setQ("");
      setResults(recent);
      return;
    }
    setOpenCustomerId(c.id);
    setChecked({});
  };

  const confirmPick = (c: CustomerListItem) => {
    const names = c.cats.filter((cat) => checked[cat.id]).map((cat) => cat.name);
    onSelect({
      customerId: c.id,
      customerName: c.name,
      catNames: names,
      lineUserId: c.lineUserId,
    });
    setQ("");
    setResults(recent);
    setOpenCustomerId(null);
    setChecked({});
  };

  return (
    <div className="rounded-catcha-sm border border-latte/40 bg-honey/10 p-3">
      <label className="block text-xs font-extrabold text-catcha-chocolate">
        🔍 ค้นหาลูกค้า (ชื่อแมว / ชื่อใน LINE)
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpenCustomerId(null);
          }}
          placeholder="เช่น น้องจู๊ด หรือ ชื่อที่เห็นใน LINE"
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>
      <p className="mt-1 text-[10px] text-brown-soft">
        เลือกลูกค้า → ติ๊กแมวที่มา (เลือกได้หลายตัว/ทั้งบ้าน) → ระบบผูกนัดให้อัตโนมัติ
      </p>

      {loading && <p className="mt-2 text-[10px] text-brown-faint">กำลังค้นหา…</p>}

      {!loading && !q.trim() && results.length > 0 && (
        <p className="mt-2 text-[10px] font-bold text-latte-deep">
          🆕 ลูกค้าสมัครล่าสุด — เลือกจากลิสต์ได้เลย
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {results.map((c) => (
            <li key={c.id}>
              {openCustomerId === c.id ? (
                <div className="rounded-catcha-sm border border-honey/50 bg-card p-2.5">
                  <p className="mb-1.5 text-xs font-extrabold text-catcha-chocolate">
                    {c.name}
                    {c.lineUserId && (
                      <span className="ml-1 text-[10px] text-ok">LINE ✓</span>
                    )}
                  </p>
                  <div className="space-y-1">
                    {c.cats.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-2 rounded-catcha-sm bg-paper px-2.5 py-1.5 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={!!checked[cat.id]}
                          onChange={(e) =>
                            setChecked((prev) => ({ ...prev, [cat.id]: e.target.checked }))
                          }
                        />
                        <span className="font-bold text-brown">🐱 {cat.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setChecked(
                          Object.fromEntries(c.cats.map((cat) => [cat.id, true]))
                        )
                      }
                      className="rounded-full bg-honey/30 px-3 py-1 text-[10px] font-bold text-catcha-chocolate"
                    >
                      ✅ เลือกทั้งบ้าน ({c.cats.length} ตัว)
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmPick(c)}
                      disabled={!Object.values(checked).some(Boolean)}
                      className="rounded-full bg-latte-deep px-3 py-1 text-[10px] font-extrabold text-white disabled:opacity-40"
                    >
                      ➕ ใช้แมวที่เลือก
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenCustomerId(null)}
                      className="rounded-full bg-paper px-3 py-1 text-[10px] font-bold text-brown-soft"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openCustomer(c)}
                  className="w-full rounded-catcha-sm bg-card px-3 py-2 text-left text-xs hover:bg-paper"
                >
                  <span className="font-bold text-brown">{c.name}</span>
                  {c.lineUserId && (
                    <span className="ml-1 text-[10px] text-ok">LINE ✓</span>
                  )}
                  <span className="block text-[10px] text-brown-faint">
                    {c.cats.length > 0
                      ? `🐱 ${c.cats.map((cat) => cat.name).join(", ")}`
                      : "ยังไม่มีชื่อแมวในระบบ"}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {q.trim() && !loading && results.length === 0 && (
        <p className="mt-2 text-[10px] text-brown-faint">
          ไม่พบในระบบ — กรอกชื่อแมวด้านล่างได้เลย (ชื่อเจ้าของใส่ทีหลังในประวัติ)
        </p>
      )}
    </div>
  );
}

export default function NewBookingPage() {
  const searchParams = useSearchParams();
  const presetDate = searchParams.get("date") || "";
  const [service, setService] = useState<"groom" | "room">("groom");
  const [saved, setSaved] = useState(false);
  const [lastBookings, setLastBookings] = useState<
    {
      id: string;
      customerId?: string;
      lineUserId?: string;
      service: "groom" | "room";
      catName: string;
    }[]
  >([]);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);
  const [freebies_, setFreebies_] = useState<string[]>(FREEBIE_OPTIONS);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [catNames, setCatNames] = useState<string[]>([]);
  const [catInput, setCatInput] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [freebies, setFreebies] = useState<string[]>([]);
  const [appointmentDate, setAppointmentDate] = useState(presetDate);
  const [checkoutDate, setCheckoutDate] = useState(() => {
    if (!presetDate) return "";
    const d = new Date(`${presetDate}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    const d = searchParams.get("date");
    if (!d) return;
    setAppointmentDate(d);
    const out = new Date(`${d}T12:00:00`);
    out.setDate(out.getDate() + 1);
    setCheckoutDate(out.toISOString().slice(0, 10));
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config?.rooms) setRooms(d.config.rooms);
        if (d.config?.groomSlots) setGroomSlots(d.config.groomSlots);
        if (d.config?.options?.freebies?.length) setFreebies_(d.config.options.freebies);
      });
  }, []);

  const addCatFromInput = () => {
    const name = catInput.trim();
    if (!name || catNames.includes(name)) return;
    setCatNames((prev) => [...prev, name]);
    setCatInput("");
  };

  const addUnknownCat = () => {
    let name = "น้องไม่ระบุชื่อ";
    let n = 2;
    while (catNames.includes(name)) {
      name = `น้องไม่ระบุชื่อ (${n})`;
      n += 1;
    }
    setCatNames((prev) => [...prev, name]);
  };

  const removeCat = (name: string) => {
    setCatNames((prev) => prev.filter((c) => c !== name));
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // เก็บ element ไว้ก่อน — React เคลียร์ currentTarget ทิ้งหลัง await
    // (เมื่อก่อนบรรทัด form.reset() ท้ายฟังก์ชันพังทุกครั้งที่บันทึกสำเร็จ)
    const form = e.currentTarget;
    const fd = new FormData(form);
    const cats = catNames.length > 0 ? catNames : catInput.trim() ? [catInput.trim()] : [];
    if (cats.length === 0) {
      toast("กรอกชื่อน้องแมวอย่างน้อย 1 ชื่อ (หรือกด “ยังไม่ทราบตัว”)", "error");
      return;
    }

    const noteBase = String(fd.get("notes") || "").trim();
    const freebieLine = service === "room" && freebies.length
      ? `🎁 ของแถมฟรี: ${freebies.join(", ")}`
      : "";
    const notes = [noteBase, freebieLine].filter(Boolean).join("\n") || undefined;
    const customerNameValue = String(fd.get("customer") || customerName).trim() || undefined;

    const basePayload = {
      customerId: customerId || undefined,
      customerName: customerNameValue,
      lineUserId: lineUserId || undefined,
      service,
      date: service === "groom" ? String(fd.get("date") || "") : undefined,
      time: service === "groom" ? String(fd.get("time") || "") : undefined,
      room: service === "room" ? String(fd.get("room") || "") : undefined,
      checkin: service === "room" ? String(fd.get("checkin") || "") : undefined,
      checkout: service === "room" ? String(fd.get("checkout") || "") : undefined,
      notes,
    };

    const created: {
      id: string;
      customerId?: string;
      lineUserId?: string;
      service: "groom" | "room";
      catName: string;
    }[] = [];
    let failed = 0;

    for (const cat of cats) {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...basePayload, catName: cat }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.booking?.id) {
          created.push({
            id: data.booking.id,
            customerId: data.customerId,
            lineUserId: lineUserId || undefined,
            service,
            catName: cat,
          });
        }
      } else {
        failed += 1;
      }
    }

    if (created.length > 0) {
      setSaved(true);
      setLastBookings(created);
      setCustomerId("");
      setCustomerName("");
      setCatNames([]);
      setCatInput("");
      setLineUserId("");
      setFreebies([]);
      form.reset();
      setTimeout(() => setSaved(false), 2500);
    }
    if (failed > 0) {
      toast(
        created.length > 0
          ? `บันทึกสำเร็จ ${created.length} ตัว แต่พลาด ${failed} ตัว — ลองใหม่ตัวที่เหลือ`
          : "บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง",
        "error"
      );
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-catcha-chocolate">
        ➕ บันทึกจองให้ลูกค้า
      </h1>

      {/* จองเสร็จแล้ว → ทำต่อได้เลยจากตรงนี้ */}
      {lastBookings.length > 0 && (
        <div className="mb-4 space-y-3 rounded-catcha border border-sage/50 bg-sage/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-ok">
              ✅ จองแล้ว {lastBookings.length} ตัว: {lastBookings.map((b) => b.catName).join(", ")}
            </p>
            <button
              type="button"
              onClick={() => setLastBookings([])}
              className="shrink-0 rounded-catcha-sm bg-paper px-3 py-2 text-xs font-bold text-brown-soft"
            >
              จองอีกคน
            </button>
          </div>
          {lastBookings.map((b) => (
            <div key={b.id} className="rounded-catcha-sm border border-sage/30 bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-catcha-chocolate">🐱 {b.catName}</p>
                <Link
                  href={`/admin/billing?bookingId=${b.id}`}
                  className="shrink-0 rounded-catcha-sm bg-honey/45 px-3 py-1.5 text-[11px] font-extrabold text-catcha-chocolate"
                >
                  🧾 ออกบิลเลย
                </Link>
              </div>
              <div className="mt-2 border-t border-catcha-line pt-2">
                <CustomerSendButtons
                  bookingId={b.id}
                  customerId={b.customerId}
                  lineUserId={b.lineUserId}
                  service={b.service}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {appointmentDate && (
        <p className="mb-4 text-xs font-bold text-latte-deep">
          📅 จองวันที่ {appointmentDate}
        </p>
      )}

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "groom" as const, label: "🛁 อาบน้ำ" },
            { id: "room" as const, label: "🏠 ห้องพัก" },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setService(s.id)}
            className={`flex-1 rounded-catcha-sm py-3 text-sm font-bold ${
              service === s.id
                ? "bg-honey/45 text-catcha-chocolate shadow-catcha-sm"
                : "bg-paper text-brown-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-catcha bg-card p-5 shadow-catcha-sm">
        <CustomerPicker
          onSelect={(data) => {
            setCustomerId(data.customerId);
            setCustomerName(data.customerName);
            setLineUserId(data.lineUserId || "");
            setCatNames((prev) => {
              const merged = [...prev];
              for (const n of data.catNames) {
                if (!merged.includes(n)) merged.push(n);
              }
              return merged;
            });
          }}
        />

        <Field
          label="ชื่อใน LINE (ไม่บังคับ — เลือกจากค้นหาด้านบนได้)"
          name="customer"
          value={customerName}
          onChange={setCustomerName}
          placeholder="ชื่อที่เห็นใน LINE"
        />

        <div>
          <label className="block text-xs font-bold text-brown-soft">น้องแมวที่มา *</label>

          {catNames.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {catNames.map((name) => (
                <span
                  key={name}
                  className="flex items-center gap-1 rounded-full bg-honey/30 px-3 py-1 text-xs font-bold text-catcha-chocolate"
                >
                  🐱 {name}
                  <button
                    type="button"
                    onClick={() => removeCat(name)}
                    className="ml-0.5 text-brown-faint hover:text-wait"
                    aria-label={`เอา ${name} ออก`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-1.5 flex gap-2">
            <input
              value={catInput}
              onChange={(e) => setCatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCatFromInput();
                }
              }}
              placeholder="พิมพ์ชื่อแมว แล้วกด Enter หรือ ➕"
              className="min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-latte-deep"
            />
            <button
              type="button"
              onClick={addCatFromInput}
              disabled={!catInput.trim()}
              className="shrink-0 rounded-catcha-sm bg-latte/25 px-3 py-2.5 text-sm font-extrabold text-catcha-chocolate disabled:opacity-40"
            >
              ➕
            </button>
          </div>
          <button
            type="button"
            onClick={addUnknownCat}
            className="mt-1.5 rounded-full bg-paper px-3 py-1.5 text-[11px] font-bold text-brown-soft"
          >
            ❓ ยังไม่ทราบตัว (จะแจ้งภายหลัง)
          </button>
          <p className="mt-1 text-[10px] text-brown-faint">
            ทราบว่ามากี่ตัวแต่ไม่รู้ว่าตัวไหน กดปุ่มนี้ได้เลย — ใส่ชื่อจริงทีหลังตอนเช็คอินได้
          </p>
        </div>

        {lineUserId && (
          <p className="rounded-catcha-sm bg-sage/15 px-3 py-2 text-[10px] font-bold text-ok">
            ✅ ผูก LINE แล้ว — ลูกค้าเห็นนัดในแอบอัตโนมัติ
          </p>
        )}

        {service === "groom" ? (
          <>
            <Field
              label="วันที่นัด"
              name="date"
              type="date"
              required
              value={appointmentDate}
              onChange={setAppointmentDate}
            />
            <label className="block text-xs font-bold text-brown-soft">
              รอบเวลา
              <input
                name="time"
                type="time"
                list="groom-slots"
                defaultValue="12:30"
                className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
              />
              <datalist id="groom-slots">
                {groomSlots.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <p className="mt-1 text-[10px] text-brown-faint">
                เลือกจากรอบแนะนำ หรือพิมพ์เวลาเองได้
              </p>
            </label>
          </>
        ) : (
          <>
            <label className="block text-xs font-bold text-brown-soft">
              ห้อง
              <select
                name="room"
                className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.size}) — {r.price} บาท/คืน
                    {r.count ? ` · ${r.count} ห้อง` : " · ห้องเชื่อม"}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="เช็คอิน"
              name="checkin"
              type="date"
              required
              value={appointmentDate}
              onChange={setAppointmentDate}
            />
            <Field
              label="เช็คเอาท์"
              name="checkout"
              type="date"
              required
              value={checkoutDate}
              onChange={setCheckoutDate}
            />
          </>
        )}

        {service === "room" && (
        <div className="rounded-catcha-sm border border-honey/40 bg-honey/10 p-3">
          <p className="text-xs font-extrabold text-catcha-chocolate">
            🎁 ของแถมฟรี (ถ้าตกลงกับลูกค้าไว้)
          </p>
          <p className="mb-2 text-[10px] text-brown-soft">
            ติ๊กแล้วจะติดไปในใบจอง + การ์ดยืนยันให้ลูกค้าเห็นเลย
          </p>
          <div className="flex flex-wrap gap-2">
            {freebies_.map((f) => {
              const on = freebies.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setFreebies((prev) =>
                      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${
                    on
                      ? "bg-honey text-catcha-chocolate"
                      : "bg-paper text-brown-soft"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {f}
                </button>
              );
            })}
          </div>
        </div>
        )}

        <Field label="โน้ตนิสัยน้อง (ลูกค้าใหม่)" name="notes" textarea />

        <button
          type="submit"
          className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-sm font-extrabold text-catcha-chocolate"
        >
          {saved ? "✅ บันทึกแล้ว + สร้างนัด Calendar" : "🗓️ บันทึกการจอง"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  textarea,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const cls =
    "mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-latte-deep";
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      {textarea ? (
        <textarea name={name} className={cls} rows={2} />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={cls}
        />
      )}
    </label>
  );
}
