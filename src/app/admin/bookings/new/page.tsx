"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { RoomType } from "@/lib/business";
import type { CustomerRecord } from "@/lib/customers-store";
import { GROOM_PROGRAMS } from "@/lib/grooming-prices";
import { CustomerSendButtons } from "@/components/CustomerSendButtons";
import { toast } from "@/components/Toast";
import {
  typeAvailability,
  compositionOf,
  roomCapacity,
  type BoardBooking,
} from "@/lib/room-board";

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
    <div className="rounded-petflow-sm border border-latte/40 bg-honey/10 p-3">
      <label className="block text-xs font-extrabold text-petflow-chocolate">
        🔍 ค้นหาลูกค้า (ชื่อแมว / ชื่อใน LINE)
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpenCustomerId(null);
          }}
          placeholder="เช่น น้องจู๊ด หรือ ชื่อที่เห็นใน LINE"
          className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm"
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
                <div className="rounded-petflow-sm border border-honey/50 bg-card p-2.5">
                  <p className="mb-1.5 text-xs font-extrabold text-petflow-chocolate">
                    {c.name}
                    {c.lineUserId && (
                      <span className="ml-1 text-[10px] text-ok">LINE ✓</span>
                    )}
                  </p>
                  <div className="space-y-1">
                    {c.cats.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center gap-2 rounded-petflow-sm bg-paper px-2.5 py-1.5 text-xs"
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
                      className="rounded-full bg-honey/30 px-3 py-1 text-[10px] font-bold text-petflow-chocolate"
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
                  className="w-full rounded-petflow-sm bg-card px-3 py-2 text-left text-xs hover:bg-paper"
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
  const [groomProgram, setGroomProgram] = useState("");
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

  // นัดที่มีอยู่ — ใช้คำนวณว่าห้องแต่ละแบบเหลือจริงกี่ห้องในช่วงวันที่เลือก
  const [existing, setExisting] = useState<BoardBooking[]>([]);
  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => setExisting(d.bookings || []))
      .catch(() => {
        /* ดูที่ว่างไม่ได้ก็ยังจองได้ตามปกติ แค่ไม่มีตัวช่วย */
      });
  }, []);

  const [roomId, setRoomId] = useState("");
  const boardRooms = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    count: r.count || 0,
    maxCats: roomCapacity(r),
    composedOf: r.composedOf,
  }));
  /** ห้องแต่ละแบบว่างกี่ห้องตลอดช่วงที่ขอ (ติดคืนไหนบอกคืนนั้น) */
  const availability = useMemo(() => {
    if (service !== "room" || !appointmentDate || rooms.length === 0) return {};
    const out: Record<string, { free: number; total: number; tightestDate: string }> = {};
    for (const r of rooms) {
      // ห้องเชื่อมไม่มียูนิตของตัวเอง แต่คิดที่ว่างได้จากห้องจริงที่ใช้ประกอบ
      // (Mini Duo = MiNi Meow 2 ห้อง) — ประเภทที่ไม่มีทั้งห้องจริงและสูตรประกอบ ข้ามไป
      if (!r.count && !compositionOf(r.id, boardRooms)) continue;
      out[r.id] = typeAvailability(
        boardRooms,
        existing,
        r.id,
        appointmentDate,
        checkoutDate || appointmentDate
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, appointmentDate, checkoutDate, rooms, existing]);

  // ห้องที่เลือกไว้เต็มไปแล้ว (เช่นเพิ่งเปลี่ยนวัน) → เด้งไปห้องที่ยังว่าง
  useEffect(() => {
    if (service !== "room" || rooms.length === 0) return;
    const cur = availability[roomId];
    // ห้องเชื่อมไม่มีข้อมูลที่ว่าง (ไม่อยู่ใน availability) — เลือกไว้แล้วก็ปล่อยไว้
    if (roomId && (!cur || cur.free > 0)) return;
    const firstFree = rooms.find((r) => (availability[r.id]?.free ?? 0) > 0);
    if (firstFree && firstFree.id !== roomId) setRoomId(firstFree.id);
    else if (!roomId && rooms[0]) setRoomId(rooms[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, service, rooms]);

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
      groomProgram: service === "groom" ? groomProgram || undefined : undefined,
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
      setGroomProgram("");
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
      <h1 className="mb-1 text-lg font-extrabold text-petflow-chocolate">
        ➕ บันทึกจองให้ลูกค้า
      </h1>

      {/* จองเสร็จแล้ว → ทำต่อได้เลยจากตรงนี้ */}
      {lastBookings.length > 0 && (
        <div className="mb-4 space-y-3 rounded-petflow border border-sage/50 bg-sage/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-extrabold text-ok">
              ✅ จองแล้ว {lastBookings.length} ตัว: {lastBookings.map((b) => b.catName).join(", ")}
            </p>
            <button
              type="button"
              onClick={() => setLastBookings([])}
              className="shrink-0 rounded-petflow-sm bg-paper px-3 py-2 text-xs font-bold text-brown-soft"
            >
              จองอีกคน
            </button>
          </div>
          {lastBookings.map((b) => (
            <div key={b.id} className="rounded-petflow-sm border border-sage/30 bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-petflow-chocolate">🐱 {b.catName}</p>
                <Link
                  href={`/admin/billing?bookingId=${b.id}`}
                  className="shrink-0 rounded-petflow-sm bg-honey/45 px-3 py-1.5 text-[11px] font-extrabold text-petflow-chocolate"
                >
                  🧾 ออกบิลเลย
                </Link>
              </div>
              <div className="mt-2 border-t border-petflow-line pt-2">
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
            className={`flex-1 rounded-petflow-sm py-3 text-sm font-bold ${
              service === s.id
                ? "bg-honey/45 text-petflow-chocolate shadow-petflow-sm"
                : "bg-paper text-brown-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-petflow bg-card p-5 shadow-petflow-sm">
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
                  className="flex items-center gap-1 rounded-full bg-honey/30 px-3 py-1 text-xs font-bold text-petflow-chocolate"
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
              className="min-w-0 flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-latte-deep"
            />
            <button
              type="button"
              onClick={addCatFromInput}
              disabled={!catInput.trim()}
              className="shrink-0 rounded-petflow-sm bg-latte/25 px-3 py-2.5 text-sm font-extrabold text-petflow-chocolate disabled:opacity-40"
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
          <p className="rounded-petflow-sm bg-sage/15 px-3 py-2 text-[10px] font-bold text-ok">
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
                className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm"
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
            <label className="block text-xs font-bold text-brown-soft">
              โปรแกรมอาบน้ำ (ไม่บังคับ)
              <select
                value={groomProgram}
                onChange={(e) => setGroomProgram(e.target.value)}
                className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm"
              >
                <option value="">ยังไม่เลือก — ถามหน้างาน</option>
                {GROOM_PROGRAMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-brown-faint">
                เลือกไว้แล้วจะแจ้งในการ์ดยืนยันนัดให้ลูกค้าเห็นเลย และตอนออกบิลจะเลือกโปรแกรมนี้ไว้ให้อัตโนมัติ
              </p>
            </label>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-bold text-brown-soft">ห้อง</p>
              <p className="mb-1.5 text-[10px] text-brown-faint">
                ตัวเลขคือห้องที่ว่างจริงตลอดช่วงที่เลือก · ห้องเต็มจะกดไม่ได้
              </p>
              <input type="hidden" name="room" value={roomId} />
              <div className="space-y-1.5">
                {rooms.map((r) => {
                  const a = availability[r.id];
                  const combo = !r.count && !!compositionOf(r.id, boardRooms);
                  const free = a?.free ?? r.count ?? 0;
                  const full = free <= 0;
                  const picked = roomId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={full}
                      onClick={() => setRoomId(r.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-petflow-sm px-3 py-2.5 text-left transition ${
                        full
                          ? "cursor-not-allowed bg-paper/50 opacity-60"
                          : picked
                            ? "bg-honey/40 ring-2 ring-honey-deep"
                            : "bg-paper hover:bg-honey/15"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-extrabold text-petflow-chocolate">
                          {picked && !full ? "✓ " : ""}
                          {r.name} ({r.size})
                        </span>
                        <span className="block text-[10px] text-brown-soft">
                          {r.price} บาท/คืน
                          {full && a
                            ? ` · เต็มวันที่ ${a.tightestDate}`
                            : combo
                              ? " · ห้องเชื่อม (ใช้ห้องจริง 2 ห้อง)"
                              : ` · ทั้งหมด ${r.count} ห้อง`}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                          full ? "bg-red-50 text-red-600" : "bg-ok/15 text-ok"
                        }`}
                      >
                        {full ? "เต็ม" : `ว่าง ${free}${combo ? " ชุด" : ""}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              {Object.keys(availability).length > 0 &&
                Object.values(availability).every((a) => a.free <= 0) && (
                <p className="mt-2 rounded-petflow-sm bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700">
                  🔴 ช่วงวันนี้ห้องเต็มทุกแบบ — ต้องเลื่อนวันหรือเช็คห้องที่จะเช็คเอาท์ก่อน
                </p>
              )}
            </div>
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
        <div className="rounded-petflow-sm border border-honey/40 bg-honey/10 p-3">
          <p className="text-xs font-extrabold text-petflow-chocolate">
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
                      ? "bg-honey text-petflow-chocolate"
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
          className="w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-sm font-extrabold text-petflow-chocolate"
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
    "mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-latte-deep";
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
