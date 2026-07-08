"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  TIER_LABELS,
  type CustomerTier,
} from "@/lib/customer-tier";

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
  const [imageUrl, setImageUrl] = useState("");
  const [broadcastTier, setBroadcastTier] = useState<CustomerTier | "all">("all");
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastImage, setBroadcastImage] = useState("");
  const [broadcastCount, setBroadcastCount] = useState<number | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const adminCode =
    typeof window !== "undefined"
      ? sessionStorage.getItem("catcha-admin") || ""
      : "";

  const load = useCallback(async () => {
    const res = await fetch("/api/promos");
    const data = await res.json();
    setPromos(data.promos || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch(`/api/line/broadcast?tier=${broadcastTier}`)
      .then((r) => r.json())
      .then((d) => setBroadcastCount(d.withLine ?? d.count ?? 0));
  }, [broadcastTier]);

  const sendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      setBroadcastMsg("กรอกหัวข้อและข้อความ");
      return;
    }
    setBroadcasting(true);
    setBroadcastMsg("");
    const res = await fetch("/api/line/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminCode,
        tier: broadcastTier,
        title: broadcastTitle,
        body: broadcastBody,
        imageUrl: broadcastImage || undefined,
      }),
    });
    const data = await res.json();
    setBroadcasting(false);
    if (res.ok) {
      setBroadcastMsg(`✅ ส่งแล้ว ${data.sent} คน (${data.tier})`);
    } else {
      setBroadcastMsg(data.error || "ส่งไม่สำเร็จ");
    }
  };

  const onImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

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
        imageUrl: imageUrl || undefined,
        startDate: String(fd.get("startDate")),
        until: String(fd.get("until")),
        active: true,
      }),
    });
    e.currentTarget.reset();
    setImageUrl("");
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

  const hasImage = imageUrl.startsWith("data:") || imageUrl.startsWith("http") || imageUrl.startsWith("/");

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">✨ โปรโมชั่น</h1>

      <section className="mb-5 space-y-3 rounded-catcha border border-sage/40 bg-sage/10 p-4">
        <h2 className="text-sm font-extrabold text-catcha-chocolate">📨 ส่งโปรทาง LINE</h2>
        <p className="text-[10px] text-brown-soft">
          เลือกกลุ่มลูกค้าแล้วส่งการ์ด Flex — ต้องตั้ง LINE_CHANNEL_TOKEN
        </p>
        <select
          value={broadcastTier}
          onChange={(e) =>
            setBroadcastTier(e.target.value as CustomerTier | "all")
          }
          className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-sm"
        >
          <option value="all">ทุกระดับ ({broadcastCount ?? "…"} คน)</option>
          {(Object.keys(TIER_LABELS) as CustomerTier[]).map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          value={broadcastTitle}
          onChange={(e) => setBroadcastTitle(e.target.value)}
          placeholder="หัวข้อการ์ด"
          className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-sm"
        />
        <textarea
          value={broadcastBody}
          onChange={(e) => setBroadcastBody(e.target.value)}
          placeholder="ข้อความโปรโมชั่น"
          rows={3}
          className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-sm"
        />
        <input
          value={broadcastImage}
          onChange={(e) => setBroadcastImage(e.target.value)}
          placeholder="URL รูป (ไม่บังคับ)"
          className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={broadcasting}
          onClick={sendBroadcast}
          className="w-full rounded-catcha-sm bg-[#4A7348] py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {broadcasting ? "กำลังส่ง…" : `📨 ส่งให้ลูกค้า (${broadcastCount ?? "…"} คน)`}
        </button>
        {broadcastMsg && (
          <p className="text-center text-xs font-bold text-brown">{broadcastMsg}</p>
        )}
      </section>

      <form onSubmit={submit} className="mb-5 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <input name="titleTh" required placeholder="หัวข้อ (ไทย)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <input name="titleEn" placeholder="หัวข้อ (EN)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <textarea name="bodyTh" required placeholder="รายละเอียด" rows={2} className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input name="discountPercent" type="number" placeholder="ส่วนลด %" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
          <input name="discountAmount" type="number" placeholder="ส่วนลด บาท" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        </div>

        <div className="rounded-catcha-sm border border-catcha-line bg-paper p-3">
          <p className="mb-2 text-[10px] font-bold text-latte-deep">รูปโปรโมชั่น</p>
          <div className="flex gap-3">
            {hasImage ? (
              <Image
                src={imageUrl}
                alt=""
                width={96}
                height={72}
                className="h-[72px] w-[96px] shrink-0 rounded-catcha-sm object-cover bg-card"
                unoptimized
              />
            ) : (
              <div className="flex h-[72px] w-[96px] shrink-0 items-center justify-center rounded-catcha-sm bg-card text-[10px] text-brown-faint">
                ยังไม่มีรูป
              </div>
            )}
            <div className="flex flex-1 flex-col gap-2">
              <label className="block text-[10px] font-bold text-latte-deep">
                อัปโหลดรูป
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-[10px]"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImage(f);
                  }}
                />
              </label>
              <input
                value={imageUrl.startsWith("data:") ? "" : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="หรือวาง URL รูป"
                className="w-full rounded-catcha-sm border border-catcha-line bg-card px-2 py-1.5 text-xs"
              />
            </div>
          </div>
        </div>

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
          <li key={p.id} className="overflow-hidden rounded-catcha border border-catcha-line bg-card">
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-24 w-full object-cover" />
            )}
            <div className="p-4">
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
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
