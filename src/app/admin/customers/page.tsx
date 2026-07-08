"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { CatRecord, CustomerRecord, MemberTopupRecord } from "@/lib/customers-store";
import type { PointsHistoryEntry } from "@/lib/points-store";
import type { Booking } from "@/lib/business";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";

type Summary = {
  customer: CustomerRecord;
  points: number;
  visits: number;
  history: {
    bookings: Booking[];
    services: { id: string; service: string; date: string; amount?: number; catName: string }[];
    points: PointsHistoryEntry[];
    memberTopups: MemberTopupRecord[];
  };
};

const MEMBER_PROMOS = [
  { label: "10,000 → 12,000", paid: 10000, bonus: 2000 },
  { label: "5,000 → 5,500", paid: 5000, bonus: 500 },
  { label: "3,000 → 3,200", paid: 3000, bonus: 200 },
] as const;

function MemberTopupSection({
  customerId,
  memberCredit,
  topups,
  onDone,
}: {
  customerId: string;
  memberCredit: number;
  topups: MemberTopupRecord[];
  onDone: () => void;
}) {
  const [paid, setPaid] = useState("");
  const [bonus, setBonus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const paidNum = Math.max(0, Number(paid) || 0);
  const bonusNum = Math.max(0, Number(bonus) || 0);
  const total = paidNum + bonusNum;

  const applyPromo = (p: number, b: number) => {
    setPaid(String(p));
    setBonus(String(b));
    setMsg("");
  };

  const submit = async () => {
    if (total <= 0) {
      setMsg("กรอกยอดรับเงินหรือแถมอย่างน้อย 1 บาท");
      return;
    }
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customerId,
        action: "topup_member",
        paidAmount: paidNum,
        bonusAmount: bonusNum,
        note: note.trim() || undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setPaid("");
      setBonus("");
      setNote("");
      setMsg(`✅ เติมสำเร็จ +${total.toLocaleString()} บาท (คงเหลือ ${data.customer.memberCredit.toLocaleString()} บาท)`);
      onDone();
    } else {
      setMsg("❌ บันทึกไม่สำเร็จ");
    }
  };

  return (
    <section className="mb-4 rounded-catcha bg-card p-4">
      <h2 className="mb-1 text-sm font-extrabold">💎 เติมเครดิต Member</h2>
      <p className="mb-3 text-[10px] text-brown-soft">
        คงเหลือ <span className="font-bold text-latte-deep">{memberCredit.toLocaleString()} บาท</span>
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block text-[10px] font-bold text-brown-soft">
          💵 รับเงินจริง (บาท)
          <input
            type="number"
            min={0}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder="10000"
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm font-bold text-catcha-chocolate"
          />
        </label>
        <label className="block text-[10px] font-bold text-brown-soft">
          🎁 แถมเครดิต (บาท)
          <input
            type="number"
            min={0}
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            placeholder="2000"
            className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm font-bold text-latte-deep"
          />
        </label>
      </div>

      {total > 0 && (
        <p className="mb-3 rounded-catcha-sm bg-honey/20 px-3 py-2 text-center text-xs font-bold text-catcha-chocolate">
          ลูกค้าได้เครดิตรวม <span className="text-base">{total.toLocaleString()}</span> บาท
          {bonusNum > 0 && (
            <span className="block text-[10px] font-normal text-brown-soft">
              (จ่าย {paidNum.toLocaleString()} + แถม {bonusNum.toLocaleString()})
            </span>
          )}
        </p>
      )}

      <p className="mb-2 text-[10px] font-bold text-brown-faint">โปรด่วน</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {MEMBER_PROMOS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyPromo(p.paid, p.bonus)}
            className="rounded-full bg-honey/30 px-3 py-1.5 text-[10px] font-bold text-catcha-chocolate"
          >
            {p.label}
          </button>
        ))}
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="โน้ต (ถ้ามี) เช่น โปรปีใหม่"
        className="mb-3 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-xs"
      />

      <button
        type="button"
        disabled={saving || total <= 0}
        onClick={submit}
        className="w-full rounded-catcha-sm bg-latte/30 py-2.5 text-sm font-extrabold text-catcha-chocolate disabled:opacity-40"
      >
        {saving ? "กำลังบันทึก…" : `บันทึกเติม Member +${total > 0 ? total.toLocaleString() : "—"} บาท`}
      </button>

      {msg && (
        <p className="mt-2 text-center text-[10px] font-bold text-brown">{msg}</p>
      )}

      {topups.length > 0 && (
        <div className="mt-4 border-t border-catcha-line pt-3">
          <p className="mb-2 text-[10px] font-extrabold text-brown-soft">ประวัติเติม Member</p>
          <ul className="space-y-2 text-[10px] text-brown-soft">
            {topups.map((t) => (
              <li key={t.id} className="rounded-catcha-sm bg-paper/60 px-2 py-1.5">
                <span className="font-bold text-brown">{t.createdAt.slice(0, 10)}</span>
                {" · "}
                รับ {t.paidAmount.toLocaleString()} บาท
                {t.bonusAmount > 0 && (
                  <> · แถม {t.bonusAmount.toLocaleString()} บาท</>
                )}
                {" · "}
                <span className="text-latte-deep">+{t.creditAdded.toLocaleString()} เครดิต</span>
                {t.note && <span className="block text-brown-faint">{t.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function CustomersPage() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<CustomerRecord[]>([]);
  const [selected, setSelected] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/customers${params}`);
    const data = await res.json();
    setList(data.customers || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    search("");
  }, [search]);

  const open = async (id: string) => {
    const res = await fetch(`/api/customers?id=${id}`);
    const data = await res.json();
    setSelected(data);
  };

  const saveCatNote = async (catId: string, staffNote: string, photoDataUrl?: string) => {
    if (!selected) return;
    await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "update_cat",
        catId,
        patch: { staffNote, ...(photoDataUrl ? { photoDataUrl } : {}) },
      }),
    });
    open(selected.customer.id);
  };


  const onPhoto = (cat: CatRecord, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      saveCatNote(cat.id, cat.staffNote || "", String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  if (selected) {
    const c = selected.customer;
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-3 text-xs font-bold text-brown-soft"
        >
          ← กลับ
        </button>
        <h1 className="mb-1 text-lg font-extrabold text-catcha-chocolate">
          {c.name} {c.isMember && <span className="text-sm text-latte-deep">💎 Member</span>}
        </h1>
        <p className="mb-4 text-xs text-brown-soft">
          {selected.points} แต้ม · {selected.visits} ครั้ง · เครดิต {c.memberCredit.toLocaleString()} บาท
        </p>

        <section className="mb-4 space-y-3">
          <h2 className="text-sm font-extrabold text-catcha-chocolate">🐱 น้องแมว (โน้ตพนักงาน)</h2>
          {c.cats.map((cat) => (
            <div key={cat.id} className="rounded-catcha border border-catcha-line bg-card p-4">
              <div className="flex gap-3">
                {cat.photoDataUrl ? (
                  <Image
                    src={cat.photoDataUrl}
                    alt={cat.name}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] rounded-catcha-sm object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-catcha-sm bg-paper text-2xl">
                    🐱
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-brown">{cat.name}</p>
                  <textarea
                    defaultValue={cat.staffNote}
                    placeholder="โน้ต เช่น แมวดุ อาบยาก"
                    className="mt-2 w-full rounded-catcha-sm border border-catcha-line bg-paper px-2 py-1.5 text-xs"
                    rows={2}
                    onBlur={(e) => saveCatNote(cat.id, e.target.value, cat.photoDataUrl)}
                  />
                  <label className="mt-2 block text-[10px] font-bold text-latte-deep">
                    📷 อัปโหลดรูป (เห็นเฉพาะหลังบ้าน)
                    <input
                      type="file"
                      accept="image/*"
                      className="mt-1 block w-full text-[10px]"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPhoto(cat, f);
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
        </section>

        <MemberTopupSection
          customerId={c.id}
          memberCredit={c.memberCredit}
          topups={selected.history.memberTopups || []}
          onDone={() => open(c.id)}
        />

        <section className="mb-4 rounded-catcha bg-card p-4">
          <h2 className="mb-2 text-sm font-extrabold">📋 ประวัติใช้บริการ</h2>
          <ul className="space-y-2 text-xs text-brown-soft">
            {selected.history.services.map((s) => (
              <li key={s.id}>
                {s.date} · {s.catName} · {s.service}
                {s.amount ? ` · ${s.amount} บาท` : ""}
              </li>
            ))}
            {selected.history.bookings.map((b) => (
              <li key={b.id}>
                {b.date} · {b.catName} · {b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · {b.status}
              </li>
            ))}
            {!selected.history.services.length && !selected.history.bookings.length && (
              <li>ยังไม่มีประวัติ</li>
            )}
          </ul>
        </section>

        <section className="rounded-catcha bg-card p-4">
          <h2 className="mb-2 text-sm font-extrabold">🎁 ประวัติแลกแต้ม</h2>
          <ul className="space-y-2 text-xs text-brown-soft">
            {selected.history.points.map((p) => (
              <li key={p.id}>
                {p.at.slice(0, 10)} · {p.labelTh} · {p.points > 0 ? "+" : ""}
                {p.points} แต้ม
              </li>
            ))}
            {!selected.history.points.length && <li>ยังไม่มีประวัติแต้ม</li>}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">👤 ลูกค้า</h1>
      <ExportSheetsButton className="mb-4" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && search(q)}
        placeholder="ค้นหาชื่อลูกค้า / ชื่อแมว / เบอร์"
        className="mb-4 w-full rounded-catcha-sm border border-catcha-line bg-card px-4 py-3 text-sm"
      />
      <button
        type="button"
        onClick={() => search(q)}
        className="mb-4 w-full rounded-catcha-sm bg-latte/25 py-2.5 text-sm font-bold text-catcha-chocolate"
      >
        🔍 ค้นหา
      </button>

      {loading ? (
        <p className="text-center text-sm text-brown-soft">กำลังโหลด…</p>
      ) : (
        <ul className="space-y-3">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                className="w-full rounded-catcha border border-catcha-line bg-card p-4 text-left shadow-catcha-sm"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-bold text-brown">
                      {c.cats[0]?.name || "—"} · {c.name}
                      {c.isMember && " 💎"}
                    </p>
                    <p className="mt-1 text-xs text-brown-soft">
                      {c.cats.map((cat) => cat.staffNote).filter(Boolean).join(" · ") || "แตะดูประวัติ"}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-latte-deep">
                    {c.memberCredit > 0 ? `${c.memberCredit} ฿` : "→"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
