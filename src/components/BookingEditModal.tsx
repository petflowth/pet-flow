"use client";

import { useState } from "react";
import type { Booking } from "@/lib/business";

export type EditableBooking = Booking & {
  lineUserId?: string;
  room?: string;
  checkin?: string;
  notes?: string;
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
            </>
          )}
          <EditField label="โน้ต" name="notes" defaultValue={booking.notes || ""} textarea />
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
