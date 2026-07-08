"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  promoRewardLabel,
  type CustomerTier,
  type PromoKind,
  type PromoRestriction,
  type PromoRewardType,
} from "@/lib/promos-store";

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
  rewardType: PromoRewardType;
  pointsBonus?: number;
  pointsMultiplier?: number;
};

type PromoClaim = {
  id: string;
  promoId: string;
  customerName: string;
  promoTitle: string;
  source: string;
  pointsAwarded?: number;
  createdAt: string;
};

const BUILTIN_TIER_OPTIONS: { value: CustomerTier; label: string }[] = [
  { value: "all", label: "ทุกคน" },
  { value: "member", label: "💎 Member" },
  { value: "new", label: "ลูกค้าใหม่" },
  { value: "returning", label: "ลูกค้าเก่า" },
];

function restrictionLabel(r: PromoRestriction, validMonth?: string) {
  if (r === "first_visit") return "ครั้งแรก";
  if (r === "calendar_month" && validMonth) return `เดือน ${validMonth}`;
  return "ไม่จำกัด";
}

function resetFormState() {
  return {
    imageUrl: "",
    showOnHome: false,
    restriction: "none" as PromoRestriction,
    tiers: ["all"] as CustomerTier[],
    rewardType: "discount" as PromoRewardType,
  };
}

export default function PromosAdminPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [claims, setClaims] = useState<PromoClaim[]>([]);
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [showOnHome, setShowOnHome] = useState(false);
  const [restriction, setRestriction] = useState<PromoRestriction>("none");
  const [tiers, setTiers] = useState<CustomerTier[]>(["all"]);
  const [rewardType, setRewardType] = useState<PromoRewardType>("discount");
  const [tierOptions, setTierOptions] = useState(BUILTIN_TIER_OPTIONS);

  const load = useCallback(async () => {
    const [promoRes, claimRes, configRes] = await Promise.all([
      fetch("/api/promos"),
      fetch("/api/promos?claims=1"),
      fetch("/api/config"),
    ]);
    const promoData = await promoRes.json();
    const claimData = await claimRes.json();
    const configData = await configRes.json();
    setPromos(promoData.promos || []);
    setClaims(claimData.claims || []);
    const presets = (configData.config?.crm?.tierPresets || []) as string[];
    setTierOptions([
      ...BUILTIN_TIER_OPTIONS,
      ...presets.map((p) => ({ value: p as CustomerTier, label: `🏷️ ${p}` })),
    ]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = () => {
    setOpen(false);
    const s = resetFormState();
    setImageUrl(s.imageUrl);
    setShowOnHome(s.showOnHome);
    setRestriction(s.restriction);
    setTiers(s.tiers);
    setRewardType(s.rewardType);
  };

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
    const kind: PromoKind = showOnHome ? "customer" : "display";
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
        rewardType,
        pointsBonus: Number(fd.get("pointsBonus")) || undefined,
        pointsMultiplier: Number(fd.get("pointsMultiplier")) || undefined,
      }),
    });
    closeModal();
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

  const toggleHome = async (p: Promo) => {
    const nextKind: PromoKind = p.kind === "customer" ? "display" : "customer";
    await fetch("/api/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, patch: { kind: nextKind } }),
    });
    load();
  };

  const hasImage = imageUrl.startsWith("data:") || imageUrl.startsWith("http") || imageUrl.startsWith("/");
  const claimsFor = (promoId: string) => claims.filter((c) => c.promoId === promoId);
  const showDiscount = rewardType === "discount" || rewardType === "both";
  const showPoints = rewardType === "points" || rewardType === "both";

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-catcha-chocolate">✨ โปรโมชั่น</h1>
          <p className="mt-1 text-xs text-brown-soft">
            สร้างโปรเดียว · ติ๊กขึ้นหน้าแรกได้ · ส่วนลดหรือแต้ม
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-sage/20 px-2 py-0.5 text-[9px] font-bold text-ok">
          v3
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-5 w-full rounded-catcha-sm border border-dashed border-honey/60 bg-honey/15 py-3 text-sm font-extrabold text-catcha-chocolate"
      >
        ➕ เพิ่มโปรใหม่
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-catcha bg-card p-5 shadow-catcha">
            <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">➕ เพิ่มโปรใหม่</h2>
            <form onSubmit={submit} className="space-y-3">
              <label className="flex items-start gap-3 rounded-catcha-sm border border-honey/50 bg-honey/10 px-3 py-3 text-xs font-bold text-catcha-chocolate">
                <input
                  type="checkbox"
                  checked={showOnHome}
                  onChange={(e) => setShowOnHome(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  🏠 ขึ้นหน้าแรกแอปลูกค้า
                  <span className="mt-0.5 block text-[10px] font-normal text-brown-soft">
                    ติ๊ก = โชว์หน้าแรก + ลูกค้ากดใช้ได้ · ไม่ติ๊ก = แสดงแค่หน้าโปร
                  </span>
                </span>
              </label>

              <div>
                <p className="mb-2 text-[10px] font-bold text-brown-soft">ประเภทรางวัล</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["discount", "ส่วนลด"],
                      ["points", "แต้ม"],
                      ["both", "ทั้งคู่"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRewardType(value)}
                      className={`rounded-catcha-sm px-2 py-2 text-[10px] font-bold ${
                        rewardType === value ? "bg-latte/30 text-catcha-chocolate" : "bg-paper text-brown-faint"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <input name="titleTh" required placeholder="หัวข้อ (ไทย)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
              <textarea name="bodyTh" required placeholder="รายละเอียด" rows={2} className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />

              {showDiscount && (
                <div className="grid grid-cols-2 gap-2">
                  <input name="discountPercent" type="number" placeholder="ส่วนลด %" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
                  <input name="discountAmount" type="number" placeholder="ส่วนลด บาท" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
                </div>
              )}

              {showPoints && (
                <div className="grid grid-cols-2 gap-2">
                  <input name="pointsBonus" type="number" placeholder="แต้มโบนัส (กดใช้แล้วได้ทันที)" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
                  <input name="pointsMultiplier" type="number" step="0.1" placeholder="ตัวคูณแต้ม เช่น 2" className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
                </div>
              )}

              <input name="couponCode" placeholder="รหัสโปร (ถ้ามี)" className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />

              <div>
                <p className="mb-2 text-[10px] font-bold text-brown-soft">
                  กลุ่มลูกค้า (Member = เติมเครดิตแล้ว · ใหม่ = ยังไม่เคยมา · เก่า = เคยมาแล้ว)
                </p>
                <div className="flex flex-wrap gap-2">
                  {tierOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleTier(opt.value)}
                      className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${
                        tiers.includes(opt.value) ? "bg-latte/30 text-catcha-chocolate" : "bg-paper text-brown-faint"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold text-brown-soft">เงื่อนไขการใช้</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["none", "ไม่จำกัด"],
                      ["first_visit", "ครั้งแรก"],
                      ["calendar_month", "เฉพาะเดือน"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRestriction(value)}
                      className={`rounded-catcha-sm px-2 py-2 text-[10px] font-bold ${
                        restriction === value ? "bg-latte/30" : "bg-paper text-brown-faint"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {restriction === "calendar_month" && (
                <input name="validMonth" type="month" required className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
              )}

              <div className="grid grid-cols-2 gap-2">
                <input name="startDate" type="date" required className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
                <input name="until" type="date" required className="rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
              </div>

              <label className="block text-[10px] font-bold text-latte-deep">
                รูปโปร (ถ้ามี)
                <input type="file" accept="image/*" className="mt-1 block w-full text-[10px]" onChange={(e) => e.target.files?.[0] && onImage(e.target.files[0])} />
              </label>
              {hasImage && (
                <Image src={imageUrl} alt="" width={96} height={72} className="h-[72px] w-[96px] rounded-catcha-sm object-cover" unoptimized />
              )}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModal} className="flex-1 rounded-catcha-sm bg-paper py-2.5 text-xs font-bold text-brown-soft">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-2.5 text-xs font-extrabold text-catcha-chocolate">
                  บันทึกโปร
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <h2 className="mb-2 text-sm font-extrabold text-catcha-chocolate">📋 รายการโปร ({promos.length})</h2>
      <ul className="space-y-3">
        {promos.map((p) => {
          const reward = promoRewardLabel(p);
          return (
            <li key={p.id} className="overflow-hidden rounded-catcha border border-catcha-line bg-card">
              <div className="p-4">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-brown">
                      {p.kind === "customer" ? "🏠 " : "✨ "}
                      {p.title.th}
                    </p>
                    <p className="text-xs text-brown-soft">{p.body.th}</p>
                    <p className="mt-1 text-[10px] text-brown-faint">
                      {p.startDate} → {p.until}
                      {reward ? ` · ${reward}` : ""}
                      {" · "}
                      {restrictionLabel(p.restriction, p.validMonth)}
                      {" · "}
                      {p.tiers.join(", ")}
                    </p>
                    {claimsFor(p.id).length > 0 && (
                      <div className="mt-2 rounded-catcha-sm bg-sage/10 px-2 py-1.5 text-[10px] text-brown-soft">
                        ใช้แล้ว {claimsFor(p.id).length} ครั้ง
                        {claimsFor(p.id).slice(0, 3).map((c) => (
                          <div key={c.id}>
                            {c.createdAt.slice(0, 10)} · {c.customerName}
                            {c.pointsAwarded ? ` · +${c.pointsAwarded} แต้ม` : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleHome(p)}
                      className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                        p.kind === "customer" ? "bg-honey/30 text-catcha-chocolate" : "bg-paper text-brown-faint"
                      }`}
                    >
                      {p.kind === "customer" ? "🏠 หน้าแรก" : "หน้าโปร"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(p.id, p.active)}
                      className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                        p.active ? "bg-sage/20 text-ok" : "bg-paper text-brown-faint"
                      }`}
                    >
                      {p.active ? "เปิด" : "ปิด"}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
