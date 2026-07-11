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
    catName: string;
    lineUserId?: string;
  }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/customers?q=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    setResults(data.customers || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, search]);

  const pick = (c: CustomerListItem, catName?: string) => {
    const cat = catName || c.cats[0]?.name || "";
    onSelect({
      customerId: c.id,
      customerName: c.name,
      catName: cat,
      lineUserId: c.lineUserId,
    });
    setQ("");
    setResults([]);
  };

  return (
    <div className="rounded-catcha-sm border border-latte/40 bg-honey/10 p-3">
      <label className="block text-xs font-extrabold text-catcha-chocolate">
        🔍 ค้นหาลูกค้า (ชื่อแมว / ชื่อใน LINE)
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="เช่น น้องจู๊ด หรือ ชื่อที่เห็นใน LINE"
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>
      <p className="mt-1 text-[10px] text-brown-soft">
        เลือกจากรายการ → ระบบใส่ชื่อ LINE + ผูกนัดให้อัตโนมัติ
      </p>

      {loading && <p className="mt-2 text-[10px] text-brown-faint">กำลังค้นหา…</p>}

      {results.length > 0 && (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
          {results.map((c) => (
            <li key={c.id}>
              {c.cats.length === 0 ? (
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className="w-full rounded-catcha-sm bg-card px-3 py-2 text-left text-xs hover:bg-paper"
                >
                  <span className="font-bold text-brown">{c.name}</span>
                  {c.lineUserId && (
                    <span className="ml-1 text-[10px] text-ok">LINE ✓</span>
                  )}
                  <span className="block text-[10px] text-brown-faint">ยังไม่มีชื่อแมวในระบบ</span>
                </button>
              ) : (
                c.cats.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => pick(c, cat.name)}
                    className="mb-1 w-full rounded-catcha-sm bg-card px-3 py-2 text-left text-xs hover:bg-paper"
                  >
                    <span className="font-bold text-brown">🐱 {cat.name}</span>
                    <span className="text-brown-soft"> · {c.name}</span>
                    {c.lineUserId && (
                      <span className="ml-1 text-[10px] text-ok">LINE ✓</span>
                    )}
                    {c.isMember && <span className="text-latte-deep"> 💎</span>}
                  </button>
                ))
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
  const [lastBooking, setLastBooking] = useState<{
    id: string;
    customerId?: string;
    lineUserId?: string;
    service: "groom" | "room";
    catName: string;
  } | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [catName, setCatName] = useState("");
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
      });
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const cat = String(fd.get("cat") || catName).trim();
    if (!cat) {
      toast("กรอกชื่อน้องแมวอย่างน้อย 1 ชื่อ", "error");
      return;
    }

    const noteBase = String(fd.get("notes") || "").trim();
    const freebieLine = freebies.length
      ? `🎁 ของแถมฟรี: ${freebies.join(", ")}`
      : "";
    const notes = [noteBase, freebieLine].filter(Boolean).join("\n") || undefined;

    const payload = {
      customerId: customerId || undefined,
      customerName: String(fd.get("customer") || customerName).trim() || undefined,
      catName: cat,
      lineUserId: lineUserId || undefined,
      service,
      date: service === "groom" ? String(fd.get("date") || "") : undefined,
      time: service === "groom" ? String(fd.get("time") || "") : undefined,
      room: service === "room" ? String(fd.get("room") || "") : undefined,
      checkin: service === "room" ? String(fd.get("checkin") || "") : undefined,
      checkout: service === "room" ? String(fd.get("checkout") || "") : undefined,
      notes,
    };

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      setSaved(true);
      if (data.booking?.id) {
        setLastBooking({
          id: data.booking.id,
          customerId: data.customerId,
          lineUserId: lineUserId || undefined,
          service,
          catName: cat,
        });
      }
      setCustomerId("");
      setCustomerName("");
      setCatName("");
      setLineUserId("");
      setFreebies([]);
      e.currentTarget.reset();
      setTimeout(() => setSaved(false), 2500);
    } else {
      toast("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง", "error");
    }
  };

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-catcha-chocolate">
        ➕ บันทึกจองให้ลูกค้า
      </h1>

      {/* จองเสร็จแล้ว → ทำต่อได้เลยจากตรงนี้ */}
      {lastBooking && (
        <div className="mb-4 rounded-catcha border border-sage/50 bg-sage/10 p-4">
          <p className="text-sm font-extrabold text-ok">
            ✅ จอง{lastBooking.catName}แล้ว — ทำต่อได้เลย
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/admin/billing?bookingId=${lastBooking.id}`}
              className="rounded-catcha-sm bg-honey/45 px-3 py-2 text-xs font-extrabold text-catcha-chocolate"
            >
              🧾 ออกบิลเลย
            </Link>
            <button
              type="button"
              onClick={() => setLastBooking(null)}
              className="rounded-catcha-sm bg-paper px-3 py-2 text-xs font-bold text-brown-soft"
            >
              จองอีกคน
            </button>
          </div>
          <div className="mt-2 border-t border-sage/30 pt-2">
            <CustomerSendButtons
              bookingId={lastBooking.id}
              customerId={lastBooking.customerId}
              lineUserId={lastBooking.lineUserId}
              service={lastBooking.service}
            />
          </div>
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
            setCatName(data.catName);
            setLineUserId(data.lineUserId || "");
          }}
        />

        <Field
          label="ชื่อใน LINE (ไม่บังคับ — เลือกจากค้นหาด้านบนได้)"
          name="customer"
          value={customerName}
          onChange={setCustomerName}
          placeholder="ชื่อที่เห็นใน LINE"
        />
        <Field
          label="ชื่อน้องแมว *"
          name="cat"
          value={catName}
          onChange={setCatName}
          required
          placeholder="รู้แค่ชื่อแมวก็บันทึกได้"
        />

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

        <div className="rounded-catcha-sm border border-honey/40 bg-honey/10 p-3">
          <p className="text-xs font-extrabold text-catcha-chocolate">
            🎁 ของแถมฟรี (ถ้าตกลงกับลูกค้าไว้)
          </p>
          <p className="mb-2 text-[10px] text-brown-soft">
            ติ๊กแล้วจะติดไปในใบจอง + การ์ดยืนยันให้ลูกค้าเห็นเลย
          </p>
          <div className="flex flex-wrap gap-2">
            {FREEBIE_OPTIONS.map((f) => {
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
