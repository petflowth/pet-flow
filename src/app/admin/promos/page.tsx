"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { CustomerTier, PromoKind, PromoRestriction } from "@/lib/promos-store";

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
  kind: PromoKind;
  restriction: PromoRestriction;
  validMonth?: string;
  tiers: CustomerTier[];
  couponCode?: string;
};

type PromoClaim = {
  id: string;
  promoId: string;
  customerName: string;
  promoTitle: string;
  source: string;
  createdAt: string;
};

const TIER_OPTIONS: { value: CustomerTier; label: string }[] = [
  { value: "all", label: "ทุกคน" },
  { value: "member", label: "💎 Member" },
  { value: "new", label: "ลูกค้าใหม่ (ยังไม่เคยมา)" },
  { value: "returning", label: "ลูกค้าเก่า (เคยมาแล้ว)" },
];

function restrictionLabel(r: PromoRestriction, validMonth?: string) {
  if (r === "first_visit") return "เฉพาะครั้งแรก";
  if (r === "calendar_month" && validMonth) return `เฉพาะเดือน ${validMonth}`;
  return "ไม่จำกัด";
}

export default function PromosAdminPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [claims, setClaims] = useState<PromoClaim[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [kind, setKind] = useState<PromoKind>("display");
  const [restriction, setRestriction] = useState<PromoRestriction>("none");
  const [tiers, setTiers] = useState<CustomerTier[]>(["all"]);

  const load = useCallback(async () => {
    const [promoRes, claimRes] = await Promise.all([
      fetch("/api/promos"),
      fetch("/api/promos?claims=1"),
    ]);
    const promoData = await promoRes.json();
    const claimData = await claimRes.json();
    setPromos(promoData.promos || []);
    setClaims(claimData.claims || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setImageUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const toggleTier = (tier: CustomerTier) => {
    if (tier === "all") {
      setTiers(["all"]);
      return;
    }
    setTiers((prev) => {
      const next = prev.filter((t) => t !== "all");
      return next.includes(tier) ? next.filter((t) => t !== tier) : [...next, tier];
    });
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
        kind,
        restriction,
        validMonth: restriction === "calendar_month" ? String(fd.get("validMonth") || "") : undefined,
        tiers: tiers.length ? tiers : ["all"],
        couponCode: String(fd.get("couponCode") || "") || undefined,
      }),
    });
    e.currentTarget.reset();
    setImageUrl("");
    setKind("display");
    setRestriction("none");
    setTiers(["all"]);
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
  const claimsFor = (promoId: string) => claims.filter((c) => c.promoId === promoId);

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-catcha-chocolate">✨ โปรโมชั่น</h1>
      <p className="mb-4 text-xs text-brown-soft">
        โปรพิเศษลูกค้า = แสดงในหน้าแรกแอป · ลูกค้ากดใช้แล้วบันทึกอัตโนมัติ
      </p>

      <form onSubmit={submit} className="mb-5 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-xs font-bold">
            <input
              type="radio"
              name="kindPick"
              checked={kind === "display"}
              onChange={() => setKind("display")}
            />
            โปรทั่วไป (หน้าโปร)
          </label>
          <label className="flex items-center gap-2 rounded-catcha-sm border border-honey/50 bg-honey/10 px-3 py-2 text-xs font-bold text-catcha-chocolate">
            <input
              type="radio"
              name="kindPick"
              checked={kind === "customer"}
              onChange={() => setKind("customer")}
            />
            โปรพิเศษลูกค้า (หน้าแรก)
          </label>
        </div>

        <input name="titleTh" required placeholder="หัวข้อ (ไทย)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <input name="titleEn" placeholder="หัวข้อ (EN)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <textarea name="bodyTh" required placeholder="รายละเอียด" rows={2} className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <input name="discountPercent" type="number" placeholder="ส่วนลด %" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
          <input name="discountAmount" type="number" placeholder="ส่วนลด บาท" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
        </div>

        {kind === "customer" && (
          <>
            <input
              name="couponCode"
              placeholder="รหัสโปร (แสดงหลังกดใช้) เช่น WELCOME10"
              className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
            />
            <div>
              <p className="mb-2 text-[10px] font-bold text-brown-soft">กลุ่มลูกค้า (เลือกได้หลายกลุ่ม)</p>
              <div className="flex flex-wrap gap-2">
                {TIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleTier(opt.value)}
                    className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                      tiers.includes(opt.value)
                        ? "bg-latte/30 text-catcha-chocolate"
                        : "bg-paper text-brown-faint"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold text-brown-soft">เงื่อนไขการใช้</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(
                  [
                    ["none", "ไม่จำกัด"],
                    ["first_visit", "เฉพาะครั้งแรก"],
                    ["calendar_month", "เฉพาะเดือนที่กำหนด"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className={`flex items-center gap-2 rounded-catcha-sm border px-3 py-2 text-[10px] font-bold ${
                      restriction === value ? "border-latte bg-latte/15" : "border-catcha-line bg-paper"
                    }`}
                  >
                    <input
                      type="radio"
                      checked={restriction === value}
                      onChange={() => setRestriction(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {restriction === "calendar_month" && (
              <input
                name="validMonth"
                type="month"
                required
                className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
              />
            )}
          </>
        )}

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
          <label className="text-[10px] font-bold text-brown-soft">
            เริ่มโปร
            <input name="startDate" type="date" required className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
          </label>
          <label className="text-[10px] font-bold text-brown-soft">
            หมดอายุ
            <input name="until" type="date" required className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
          </label>
        </div>
        <button type="submit" className="w-full rounded-catcha-sm bg-honey/40 py-3 text-sm font-extrabold">
          เพิ่มโปร
        </button>
      </form>

      <h2 className="mb-2 text-sm font-extrabold text-catcha-chocolate">📋 รายการโปร</h2>
      <ul className="space-y-3">
        {promos.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-catcha border border-catcha-line bg-card">
            {p.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-24 w-full object-cover" />
            )}
            <div className="p-4">
              <div className="flex justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-brown">
                    {p.kind === "customer" ? "🎁 " : "✨ "}
                    {p.title.th}
                  </p>
                  <p className="text-xs text-brown-soft">{p.body.th}</p>
                  <p className="mt-1 text-[10px] text-brown-faint">
                    {p.startDate} → {p.until}
                    {p.discountPercent ? ` · ${p.discountPercent}%` : ""}
                    {p.discountAmount ? ` · -${p.discountAmount}฿` : ""}
                    {p.kind === "customer" && (
                      <>
                        {" · "}
                        {restrictionLabel(p.restriction, p.validMonth)}
                        {" · "}
                        {p.tiers.join(", ")}
                        {p.couponCode ? ` · รหัส ${p.couponCode}` : ""}
                      </>
                    )}
                  </p>
                  {p.kind === "customer" && claimsFor(p.id).length > 0 && (
                    <div className="mt-2 rounded-catcha-sm bg-sage/10 px-2 py-1.5">
                      <p className="text-[10px] font-extrabold text-ok">
                        กดใช้จากแอปแล้ว {claimsFor(p.id).length} ครั้ง
                      </p>
                      <ul className="mt-1 space-y-0.5 text-[10px] text-brown-soft">
                        {claimsFor(p.id).slice(0, 5).map((c) => (
                          <li key={c.id}>
                            {c.createdAt.slice(0, 10)} · {c.customerName} · {c.source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
