"use client";

import { useState } from "react";
import type { Booking } from "@/lib/business";
import { relevantAutoMessageTopics } from "@/lib/auto-messages";
import { GROOM_PROGRAMS } from "@/lib/grooming-prices";

export type EditableBooking = Booking & {
  lineUserId?: string;
  room?: string;
  checkin?: string;
  notes?: string;
  /** หัวข้อข้อความอัตโนมัติที่นัดนี้ปิดไว้ */
  autoOff?: string[];
  /** โปรแกรมอาบน้ำที่เลือกไว้ (id ของ GROOM_PROGRAMS) */
  groomProgram?: string;
  /** ลูกค้ากดยอมรับข้อตกลงก่อนเข้าพักเมื่อไหร่ */
  consentAcceptedAt?: string;
  /** โน้ตดูแลเพิ่มเติมที่ลูกค้าพิมพ์มาตอนเซ็นยอมรับ */
  careNote?: string;
  /** ลายเซ็นที่เซ็นไว้ (URL รูป) */
  consentSignature?: string;
  /** ภาพสมุดวัคซีนที่แนบตอนยอมรับข้อตกลง */
  vaccinePhotoUrl?: string;
  /** ลูกค้าติ๊กยืนยันว่าหยดยาเห็บหมัดมาแล้ว — หลักฐานถ้าพบเห็บหมัดตอนเข้าพัก */
  fleaTickTreated?: boolean;
  /** เวลาที่เจ้าของแจ้งว่าจะมาส่งน้อง */
  arrivalTime?: string;
  /** เวลาที่เจ้าของแจ้งว่าจะมารับน้อง */
  pickupTime?: string;
};

function EditField({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  textarea,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm";
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      {textarea ? (
        <textarea name={name} defaultValue={defaultValue} className={cls} rows={2} />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          className={cls}
        />
      )}
    </label>
  );
}

export function BookingEditModal({
  booking,
  rooms,
  groomSlots,
  onClose,
  onSaved,
}: {
  booking: EditableBooking;
  rooms: { id: string; name: string; size: string; price: number }[];
  groomSlots: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [service, setService] = useState<"groom" | "room">(
    booking.service || (booking.roomType || booking.checkin ? "room" : "groom")
  );
  const [saving, setSaving] = useState(false);
  const [groomProgram, setGroomProgram] = useState(booking.groomProgram || "");
  // ปิดข้อความอัตโนมัติเฉพาะนัดนี้ (คนละเรื่องกับปิดทั้งร้านในหน้าตั้งค่า)
  const [autoOff, setAutoOff] = useState<string[]>(booking.autoOff || []);
  const toggleAuto = (id: string) =>
    setAutoOff((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  // รับ/ส่งเอง แยกกัน — บางคนให้ร้านรับอย่างเดียว หรือส่งอย่างเดียวก็ได้
  // รับ = ร้านไปรับน้องจากบ้าน ไม่ต้องถามเวลาเช็คอิน, ส่ง = ร้านไปส่งน้องกลับบ้าน ไม่ต้องถามเวลาเช็คเอาท์
  const usePickup = autoOff.includes("checkin");
  const useDropoff = autoOff.includes("checkout");
  const toggleTransport = (topic: "checkin" | "checkout", on: boolean) =>
    setAutoOff((prev) =>
      on ? Array.from(new Set([...prev, topic])) : prev.filter((x) => x !== topic)
    );

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    const payload =
      service === "groom"
        ? {
            action: "update",
            customerName: String(fd.get("customer") || ""),
            catName: String(fd.get("cat") || ""),
            service: "groom" as const,
            date: String(fd.get("date") || ""),
            time: String(fd.get("time") || "") || undefined,
            notes: String(fd.get("notes") || "") || undefined,
            groomProgram: groomProgram || undefined,
            arrivalTime: String(fd.get("arrivalTime") || "") || undefined,
            autoOff,
          }
        : {
            action: "update",
            customerName: String(fd.get("customer") || ""),
            catName: String(fd.get("cat") || ""),
            service: "room" as const,
            room: String(fd.get("room") || "") || undefined,
            checkin: String(fd.get("checkin") || ""),
            checkout: String(fd.get("checkout") || ""),
            date: String(fd.get("checkin") || ""),
            notes: String(fd.get("notes") || "") || undefined,
            arrivalTime: String(fd.get("arrivalTime") || "") || undefined,
            pickupTime: String(fd.get("pickupTime") || "") || undefined,
            autoOff,
          };

    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: booking.id, ...payload }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      alert("บันทึกไม่สำเร็จ");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-petflow bg-card p-5 shadow-petflow">
        <h2 className="mb-3 text-sm font-extrabold text-petflow-chocolate">✏️ แก้ไขนัด</h2>
        <div className="mb-3 flex gap-2">
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
              className={`flex-1 rounded-petflow-sm py-2 text-xs font-bold ${
                service === s.id ? "bg-honey/45 text-petflow-chocolate" : "bg-paper text-brown-soft"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <EditField label="ชื่อลูกค้า" name="customer" defaultValue={booking.customerName} required />
          <EditField label="ชื่อน้องแมว" name="cat" defaultValue={booking.catName} required />
          {service === "groom" ? (
            <>
              <EditField label="วันที่นัด" name="date" type="date" defaultValue={booking.date} required />
              <label className="block text-xs font-bold text-brown-soft">
                รอบเวลา
                <input
                  name="time"
                  type="time"
                  list="edit-groom-slots"
                  defaultValue={booking.time || "12:30"}
                  className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                />
                <datalist id="edit-groom-slots">
                  {groomSlots.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label className="block text-xs font-bold text-brown-soft">
                โปรแกรมอาบน้ำ (ไม่บังคับ)
                <select
                  value={groomProgram}
                  onChange={(e) => setGroomProgram(e.target.value)}
                  className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                >
                  <option value="">ยังไม่เลือก — ถามหน้างาน</option>
                  {GROOM_PROGRAMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <EditField
                label="เวลาที่ลูกค้าแจ้งจะมาส่งน้อง (ถ้ามี)"
                name="arrivalTime"
                type="time"
                defaultValue={booking.arrivalTime || ""}
              />
            </>
          ) : (
            <>
              <label className="block text-xs font-bold text-brown-soft">
                ห้อง
                <select
                  name="room"
                  defaultValue={booking.room || booking.roomType || ""}
                  className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.size})
                    </option>
                  ))}
                </select>
              </label>
              <EditField
                label="เช็คอิน"
                name="checkin"
                type="date"
                defaultValue={booking.checkin || booking.date}
                required
              />
              <EditField
                label="เช็คเอาท์"
                name="checkout"
                type="date"
                defaultValue={booking.checkout || ""}
                required
              />
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-[11px] font-bold text-brown-soft">
                  <input
                    type="checkbox"
                    checked={usePickup}
                    onChange={(e) => toggleTransport("checkin", e.target.checked)}
                    className="h-3.5 w-3.5 accent-latte-deep"
                  />
                  🚗 ร้านไปรับน้อง (ไม่ต้องถามลูกค้าเรื่องเวลาเช็คอิน)
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-brown-soft">
                  <input
                    type="checkbox"
                    checked={useDropoff}
                    onChange={(e) => toggleTransport("checkout", e.target.checked)}
                    className="h-3.5 w-3.5 accent-latte-deep"
                  />
                  🚗 ร้านไปส่งน้องกลับ (ไม่ต้องถามลูกค้าเรื่องเวลาเช็คเอาท์)
                </label>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <EditField
                    label="เวลาส่งน้อง (ถ้ามี)"
                    name="arrivalTime"
                    type="time"
                    defaultValue={booking.arrivalTime || ""}
                  />
                </div>
                <div className="flex-1">
                  <EditField
                    label="เวลารับน้อง (ถ้ามี)"
                    name="pickupTime"
                    type="time"
                    defaultValue={booking.pickupTime || ""}
                  />
                </div>
              </div>
            </>
          )}
          <EditField label="โน้ต" name="notes" defaultValue={booking.notes || ""} textarea />

          {/* ปิดข้อความอัตโนมัติเฉพาะเคสนี้ — เช่น ลูกค้าประจำที่คุยกันทางแชทอยู่แล้ว */}
          <div className="rounded-petflow-sm border border-petflow-line bg-paper/50 p-3">
            <p className="text-xs font-extrabold text-petflow-chocolate">
              🔕 ไม่ต้องส่งอัตโนมัติ (เฉพาะนัดนี้)
            </p>
            <p className="mb-2 mt-0.5 text-[10px] text-brown-faint">
              ติ๊กหัวข้อที่ไม่อยากให้ระบบส่งหาลูกค้ารายนี้ · ไม่กระทบนัดอื่น
            </p>
            <div className="space-y-1.5">
              {relevantAutoMessageTopics(service).map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-[11px] font-bold text-brown-soft">
                  <input
                    type="checkbox"
                    checked={autoOff.includes(t.id)}
                    onChange={() => toggleAuto(t.id)}
                    className="h-3.5 w-3.5 accent-latte-deep"
                  />
                  {t.label}
                </label>
              ))}
            </div>
            {autoOff.length > 0 && (
              <p className="mt-2 rounded bg-honey/20 px-2 py-1 text-[10px] font-bold text-petflow-chocolate">
                ปิดอยู่ {autoOff.length} หัวข้อ — ส่งเองด้วยปุ่มส่งการ์ดได้ตามปกติ
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-petflow-sm bg-paper py-2.5 text-xs font-bold text-brown-soft"
            >
              ปิด
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-petflow-sm bg-honey/40 py-2.5 text-xs font-extrabold text-petflow-chocolate disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
