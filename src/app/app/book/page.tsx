"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { PageHeader } from "@/components/PageHeader";
import { SELF_BOOKABLE_ROOM_IDS } from "@/lib/self-bookable-rooms";
import { GROOM_PROGRAMS } from "@/lib/grooming-prices";

type Service = "groom" | "room";

type GroomSlot = { time: string; capacity: number; booked: number; remaining: number };
type RoomAvail = { capacity: number; booked: number; remaining: number; closed: boolean } | null;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * พรีวิวฝั่งลูกค้า (ก๊อปจาก src/lib/availability.ts — คัดลอกมาเพื่อไม่ต้อง import โมดูลฝั่งเซิร์ฟเวอร์
 * เข้ามาในไคลเอนต์) แมวตัวแรกลงเวลาที่เลือก เต็มแล้วตัวถัดไปไหลไปสล็อตถัดไปอัตโนมัติ
 */
function assignGroomSlots(
  slots: { time: string; remaining: number }[],
  startTime: string,
  count: number
): string[] | null {
  const startIdx = slots.findIndex((s) => s.time === startTime);
  if (startIdx === -1 || count <= 0) return null;
  const assigned: string[] = [];
  for (let i = startIdx; i < slots.length && assigned.length < count; i++) {
    let avail = slots[i].remaining;
    while (avail > 0 && assigned.length < count) {
      assigned.push(slots[i].time);
      avail--;
    }
  }
  return assigned.length === count ? assigned : null;
}

export default function BookPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>}>
      <BookPageInner />
    </Suspense>
  );
}

function BookPageInner() {
  const params = useSearchParams();
  const { customer, profile, ready } = useLiff();
  const { config } = useConfig();
  // ชื่อ/รายการห้องดึงจากตั้งค่าของร้านนี้ ไม่ใช่ค่าเริ่มต้นของ CatCha —
  // ร้านที่เปลี่ยนชื่อห้องหรือลบห้องประเภทใดออกจะเห็นรายการที่ตรงกับร้านตัวเอง
  const roomTypes = useMemo(
    () =>
      config.rooms
        .filter((r) => SELF_BOOKABLE_ROOM_IDS.includes(r.id))
        .map((r) => ({ id: r.id, name: r.name })),
    [config.rooms]
  );
  const [service, setService] = useState<Service>(
    params.get("service") === "room" ? "room" : "groom"
  );
  // อาบน้ำเลือกได้หลายตัว (แต่ละตัวกินคิวว่าง 1 ช่อง) — เข้าพักเลือกได้ทีละตัว (คนละห้อง คนละ flow)
  const [catNames, setCatNames] = useState<string[]>([]);
  const catName = catNames[0] || "";
  const toggleCat = (name: string) => {
    if (service === "room") {
      setCatNames([name]);
      return;
    }
    setCatNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // groom state
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<GroomSlot[] | null>(null);
  const [groomClosed, setGroomClosed] = useState(false);
  const [time, setTime] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [groomProgram, setGroomProgram] = useState("");

  // room state
  const [roomType, setRoomType] = useState("");
  const [checkin, setCheckin] = useState(todayISO());
  const [checkout, setCheckout] = useState(addDaysISO(todayISO(), 1));
  const [roomAvail, setRoomAvail] = useState<RoomAvail>(null);
  const [roomAvailErr, setRoomAvailErr] = useState("");
  const [loadingRoom, setLoadingRoom] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [done, setDone] = useState<
    null | { service: Service; schedule?: { catName: string; time: string }[] }
  >(null);

  useEffect(() => {
    if (customer?.cats?.length && !catNames.length) setCatNames([customer.cats[0].name]);
  }, [customer, catNames]);

  // เปลี่ยนไปแท็บเข้าพัก — ถ้าเผลอเลือกไว้หลายตัว (จากแท็บอาบน้ำ) ตัดเหลือตัวแรกตัวเดียว
  useEffect(() => {
    if (service === "room" && catNames.length > 1) setCatNames((prev) => prev.slice(0, 1));
  }, [service, catNames.length]);

  useEffect(() => {
    // roomType เริ่มว่างเพราะรอโหลด config ก่อน — เลือกห้องแรกที่ร้านนี้เปิดให้จองเองได้
    // และสลับให้อัตโนมัติถ้าห้องที่เลือกไว้ถูกลบ/เปลี่ยนชื่อจนไม่อยู่ในลิสต์แล้ว
    if (roomTypes.length && !roomTypes.some((r) => r.id === roomType)) {
      setRoomType(roomTypes[0].id);
    }
  }, [roomTypes, roomType]);

  useEffect(() => {
    if (service !== "groom") return;
    let alive = true;
    setLoadingSlots(true);
    setTime("");
    fetch(`/api/bookings/availability?service=groom&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setSlots(d.slots || []);
        setGroomClosed(Boolean(d.closed));
      })
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoadingSlots(false));
    return () => {
      alive = false;
    };
  }, [service, date]);

  useEffect(() => {
    if (service !== "room") return;
    if (!roomType) return;
    if (checkout <= checkin) return;
    let alive = true;
    setLoadingRoom(true);
    setRoomAvailErr("");
    fetch(
      `/api/bookings/availability?service=room&roomType=${roomType}&checkin=${checkin}&checkout=${checkout}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) {
          setRoomAvail(null);
          setRoomAvailErr(
            d.error === "not_self_bookable"
              ? "ห้องประเภทนี้ยังจองเองไม่ได้ — ทักแชทร้านแทนนะคะ"
              : "เช็คความว่างไม่สำเร็จ"
          );
        } else {
          setRoomAvail(d);
        }
      })
      .catch(() => alive && setRoomAvailErr("เช็คความว่างไม่สำเร็จ"))
      .finally(() => alive && setLoadingRoom(false));
    return () => {
      alive = false;
    };
  }, [service, roomType, checkin, checkout]);

  // แมวตัวแรกลงเวลาที่เลือก ตัวที่เหลือไหลไปสล็อตถัดไปอัตโนมัติถ้าสล็อตนั้นเต็ม
  const assignedPreview = useMemo(() => {
    if (!slots || !time || !catNames.length) return null;
    return assignGroomSlots(slots, time, catNames.length);
  }, [slots, time, catNames]);

  const canSubmit = useMemo(() => {
    if (!catNames.length) return false;
    if (service === "groom") {
      if (!time) return false;
      return Boolean(assignedPreview);
    }
    return Boolean(roomType && roomAvail && roomAvail.remaining > 0 && checkout > checkin);
  }, [catNames, service, time, assignedPreview, roomType, roomAvail, checkin, checkout]);

  const submit = async () => {
    if (!profile?.lineUserId || !canSubmit) return;
    setSubmitting(true);
    setSubmitErr("");
    try {
      const body =
        service === "groom"
          ? {
              lineUserId: profile.lineUserId,
              catNames,
              service,
              date,
              time,
              groomProgram: groomProgram || undefined,
            }
          : { lineUserId: profile.lineUserId, catName, service, checkin, checkout, room: roomType };
      const res = await fetch("/api/bookings/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        const schedule =
          service === "groom" && Array.isArray(d.bookings)
            ? d.bookings.map((b: { catName: string; time: string }) => ({
                catName: b.catName,
                time: b.time,
              }))
            : undefined;
        setDone({ service, schedule });
      } else if (d.error === "slot_full" || d.error === "room_full") {
        setSubmitErr(
          service === "groom"
            ? "คิววันนี้ไม่พอสำหรับน้องที่เลือกไว้ทั้งหมด ลองเลือกวัน/เวลาอื่นนะคะ"
            : "ช่วงนี้เต็มไปแล้วพอดี ลองเลือกวัน/เวลาอื่นนะคะ"
        );
      } else if (d.error === "shop_closed") {
        setSubmitErr("ร้านปิดวันที่เลือกไว้พอดี ลองเลือกวันอื่นนะคะ");
      } else if (d.error === "duplicate_booking") {
        setSubmitErr("น้องตัวนี้มีคิว/การจองช่วงนี้อยู่แล้วค่ะ — ดูได้ที่เมนู “คิวของฉัน” นะคะ");
      } else if (d.error === "past_date") {
        setSubmitErr("วันที่เลือกผ่านมาแล้วค่ะ ลองเลือกวันใหม่นะคะ");
      } else {
        setSubmitErr("จองไม่สำเร็จ — ลองใหม่อีกครั้ง");
      }
    } catch {
      setSubmitErr("เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  if (done) {
    return (
      <div className="px-4 pb-6 pt-5">
        <PageHeader title="✅ ส่งคำขอจองแล้ว" />
        <div className="rounded-petflow border border-petflow-line bg-card p-5 text-center shadow-petflow-sm">
          <p className="text-4xl">🐾</p>
          <p className="mt-2 text-sm font-bold text-brown">
            ส่งคำขอ{done.service === "groom" ? "จองคิวอาบน้ำ" : "จองห้องพัก"}เรียบร้อยแล้วค่ะ
          </p>
          {done.schedule && done.schedule.length > 1 && (
            <div className="mt-3 space-y-1 rounded-petflow-sm bg-paper px-3 py-2.5 text-left text-xs">
              <p className="mb-1 text-center font-bold text-brown-soft">
                🕒 คิวที่ได้ (แยกตามความว่างของแต่ละช่วง)
              </p>
              {done.schedule.map((s, i) => (
                <p key={i} className="flex items-center justify-between text-brown">
                  <span>🐱 {s.catName}</span>
                  <span className="font-extrabold text-latte-deep">{s.time}</span>
                </p>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-brown-soft">
            รอร้านกดยืนยันอีกนิดนะคะ — เช็คสถานะได้ที่เมนู “การจอง” ด้านล่าง
          </p>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setTime("");
              setGroomProgram("");
            }}
            className="mt-4 rounded-full bg-honey/30 px-4 py-2 text-xs font-bold text-latte-deep"
          >
            จองอีกรายการ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader title="📅 จองคิวเอง" subtitle="เลือกวัน-เวลาที่ว่างได้เลย ไม่ต้องคุยกับพนักงาน" />

      <div className="mb-4 flex overflow-hidden rounded-full border border-petflow-line text-xs font-bold">
        <button
          type="button"
          onClick={() => setService("groom")}
          className={`flex-1 py-2.5 transition ${
            service === "groom" ? "bg-latte-deep text-white" : "bg-card text-brown-soft"
          }`}
        >
          🛁 อาบน้ำ
        </button>
        <button
          type="button"
          onClick={() => setService("room")}
          className={`flex-1 py-2.5 transition ${
            service === "room" ? "bg-latte-deep text-white" : "bg-card text-brown-soft"
          }`}
        >
          🏠 เข้าพักโรงแรม
        </button>
      </div>

      {!customer?.cats?.length ? (
        <p className="rounded-petflow-sm bg-wait/10 px-3 py-2.5 text-xs font-bold text-wait">
          ยังไม่มีข้อมูลน้องแมวในระบบ — กรุณาลงทะเบียนก่อนจองนะคะ
        </p>
      ) : (
        <>
          <div className="rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
            <p className="mb-2 text-xs font-bold text-brown-soft">
              🐱 น้องแมว{service === "groom" ? " (เลือกได้หลายตัว — 1 ตัว = 1 คิว)" : ""}
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {customer.cats.map((c) => {
                const active = catNames.includes(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.name)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? "border-latte-deep bg-latte-deep text-white"
                        : "border-petflow-line bg-paper text-brown"
                    }`}
                  >
                    {active ? "✓ " : ""}
                    {c.name}
                  </button>
                );
              })}
            </div>

            {service === "groom" ? (
              <>
                <label className="mb-3 block text-xs font-bold text-brown-soft">
                  🧴 โปรแกรมอาบน้ำ (ไม่บังคับ)
                  <select
                    value={groomProgram}
                    onChange={(e) => setGroomProgram(e.target.value)}
                    className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                  >
                    <option value="">ยังไม่เลือก — ให้ทางร้านแนะนำหน้างาน</option>
                    {GROOM_PROGRAMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mb-3 block text-xs font-bold text-brown-soft">
                  📅 วันที่
                  <input
                    type="date"
                    value={date}
                    min={todayISO()}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                  />
                </label>
                <p className="mb-2 text-xs font-bold text-brown-soft">🕒 เลือกเวลา</p>
                {loadingSlots ? (
                  <p className="text-xs text-brown-faint">กำลังเช็คความว่าง…</p>
                ) : groomClosed ? (
                  <p className="rounded-petflow-sm bg-wait/10 px-3 py-2.5 text-xs font-bold text-wait">
                    ร้านปิดวันนี้ค่ะ — ลองเลือกวันอื่นนะคะ
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {(slots || []).map((s) => {
                      // สล็อตเลือกเป็นจุดเริ่มได้ตราบใดที่ยังไม่เต็มสนิท — ถ้าน้องที่เลือกไว้มีมากกว่า
                      // ที่สล็อตนี้รับไหว ตัวที่เหลือจะไหลไปสล็อตถัดไปที่ว่างให้อัตโนมัติ (ดูตัวอย่างด้านล่าง)
                      const full = s.remaining <= 0;
                      const active = time === s.time;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={full}
                          onClick={() => setTime(s.time)}
                          className={`rounded-petflow-sm border py-2 text-center text-xs font-bold transition ${
                            full
                              ? "cursor-not-allowed border-petflow-line bg-paper text-brown-faint line-through"
                              : active
                                ? "border-latte-deep bg-latte-deep text-white"
                                : "border-petflow-line bg-card text-brown"
                          }`}
                        >
                          {s.time}
                          <span className="block text-[9px] font-normal opacity-80">
                            {full ? "เต็มแล้ว" : `ว่าง ${s.remaining}`}
                          </span>
                        </button>
                      );
                    })}
                    {slots && slots.length === 0 && (
                      <p className="col-span-3 text-xs text-brown-faint">
                        ร้านยังไม่ได้ตั้งรอบเวลาไว้ — ทักแชทร้านแทนนะคะ
                      </p>
                    )}
                  </div>
                )}

                {/* พรีวิวคิวที่จะได้ — ถ้าน้องเกินที่สล็อตนี้รับไหว จะไหลไปสล็อตถัดไปให้เห็นก่อนกดจอง */}
                {time && catNames.length > 1 && (
                  <div className="mt-2 rounded-petflow-sm bg-paper px-3 py-2 text-[11px]">
                    {assignedPreview ? (
                      <>
                        <p className="mb-1 font-bold text-brown-soft">🕒 คิวที่จะได้:</p>
                        {catNames.map((name, i) => (
                          <p key={i} className="flex items-center justify-between text-brown">
                            <span>🐱 {name}</span>
                            <span className="font-extrabold text-latte-deep">
                              {assignedPreview[i]}
                            </span>
                          </p>
                        ))}
                      </>
                    ) : (
                      <p className="font-bold text-wait">
                        คิวที่เหลือในวันนี้ไม่พอสำหรับน้องทั้ง {catNames.length} ตัว —
                        ลองเลือกวันอื่นนะคะ
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : roomTypes.length === 0 ? (
              <p className="rounded-petflow-sm bg-wait/10 px-3 py-2.5 text-xs font-bold text-wait">
                ยังจองห้องพักเองไม่ได้ตอนนี้ — ทักแชทร้านแทนนะคะ
              </p>
            ) : (
              <>
                <label className="mb-3 block text-xs font-bold text-brown-soft">
                  🏠 ประเภทห้อง
                  <select
                    value={roomType}
                    onChange={(e) => setRoomType(e.target.value)}
                    className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                  >
                    {roomTypes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <label className="block text-xs font-bold text-brown-soft">
                    วันเข้าพัก
                    <input
                      type="date"
                      value={checkin}
                      min={todayISO()}
                      onChange={(e) => {
                        setCheckin(e.target.value);
                        if (checkout <= e.target.value) setCheckout(addDaysISO(e.target.value, 1));
                      }}
                      className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs font-bold text-brown-soft">
                    วันออก
                    <input
                      type="date"
                      value={checkout}
                      min={addDaysISO(checkin, 1)}
                      onChange={(e) => setCheckout(e.target.value)}
                      className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                {loadingRoom ? (
                  <p className="text-xs text-brown-faint">กำลังเช็คความว่าง…</p>
                ) : roomAvailErr ? (
                  <p className="rounded-petflow-sm bg-wait/10 px-3 py-2 text-xs font-bold text-wait">
                    {roomAvailErr}
                  </p>
                ) : roomAvail ? (
                  <p
                    className={`rounded-petflow-sm px-3 py-2 text-xs font-bold ${
                      roomAvail.remaining > 0 ? "bg-sage/15 text-ok" : "bg-wait/10 text-wait"
                    }`}
                  >
                    {roomAvail.remaining > 0
                      ? `✅ ว่าง ${roomAvail.remaining} ห้อง`
                      : roomAvail.closed
                        ? "ร้านปิดวันเช็คอิน/เช็คเอาท์ที่เลือกไว้ — ลองเปลี่ยนวันดูนะคะ"
                        : "เต็มแล้วช่วงนี้ — ลองเปลี่ยนวันดูนะคะ"}
                  </p>
                ) : null}
              </>
            )}
          </div>

          {submitErr && (
            <p className="mt-3 text-center text-xs font-bold text-wait">{submitErr}</p>
          )}
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={submit}
            className="mt-4 w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-sm font-extrabold text-petflow-chocolate shadow-petflow-sm disabled:opacity-50"
          >
            {submitting ? "กำลังส่งคำขอ…" : "🐾 ยืนยันจองคิว"}
          </button>
        </>
      )}
    </div>
  );
}
