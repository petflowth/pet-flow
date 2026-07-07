"use client";

import { useCallback, useEffect, useState } from "react";

type Promo = {
  id: string;
  title: { th: string; en: string };
  body: { th: string; en: string };
  discountPercent?: number;
  discountAmount?: number;
  imageUrl?: string;
  startDate: string;
  until: string;
  active: boolean;
};

export default function PromosAdminPage() {
  const [promos, setPromos] = useState<Promo[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/promos");
    const data = await res.json();
    setPromos(data.promos || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: { th: String(fd.get("titleTh")), en: String(fd.get("titleEn") || fd.get("titleTh")) },
        body: { th: String(fd.get("bodyTh")), en: String(fd.get("bodyEn") || fd.get("bodyTh")) },
        discountPercent: Number(fd.get("discountPercent")) || undefined,
        discountAmount: Number(fd.get("discountAmount")) || undefined,
        imageUrl: String(fd.get("imageUrl") || "") || undefined,
        startDate: String(fd.get("startDate")),
        until: String(fd.get("until")),
        active: true,
      }),
    });
    e.currentTarget.reset();
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch("/api/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, patch: { active: !active } }),
    });
    load();
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">✨ โปรโมชั่น</h1>

      <form onSubmit={submit} className="mb-5 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <input name="titleTh" required placeholder="หัวข้อ (ไทย)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <input name="titleEn" placeholder="หัวข้อ (EN)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <textarea name="bodyTh" required placeholder="รายละเอียด" rows={2} className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input name="discountPercent" type="number" placeholder="ส่วนลด %" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
          <input name="discountAmount" type="number" placeholder="ส่วนลด บาท" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        </div>
        <input name="imageUrl" placeholder="URL รูปโปร (ถ้ามี)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input name="startDate" type="date" required className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
          <input name="until" type="date" required className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="w-full rounded-catcha-sm bg-honey/40 py-3 text-sm font-extrabold">
          เพิ่มโปร
        </button>
      </form>

      <ul className="space-y-3">
        {promos.map((p) => (
          <li key={p.id} className="rounded-catcha border border-catcha-line bg-card p-4">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-bold text-brown">{p.title.th}</p>
                <p className="text-xs text-brown-soft">{p.body.th}</p>
                <p className="mt-1 text-[10px] text-brown-faint">
                  {p.startDate} → {p.until}
                  {p.discountPercent ? ` · ${p.discountPercent}%` : ""}
                  {p.discountAmount ? ` · -${p.discountAmount}฿` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => toggle(p.id, p.active)}
                className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold ${
                  p.active ? "bg-sage/20 text-ok" : "bg-paper text-brown-faint"
                }`}
              >
                {p.active ? "เปิด" : "ปิด"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
