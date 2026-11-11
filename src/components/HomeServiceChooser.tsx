"use client";

import { useEffect, useRef } from "react";
import type { SiteConfig } from "@/lib/config-types";
import { homeFeeText, homeServiceConfig, homeServiceLabel, homeZones } from "@/lib/home-service";
import { customerFetch } from "@/lib/customer-fetch";

export type HomeChoice = {
  on: boolean;
  zoneId: string;
  address: string;
  mapUrl: string;
};

export const EMPTY_HOME_CHOICE: HomeChoice = { on: false, zoneId: "", address: "", mapUrl: "" };

/** ข้อมูลครบพอจะจองบริการที่บ้านได้ไหม (ที่อยู่หรือแผนที่ + โซนถ้าร้านแยกโซน) */
export function homeChoiceReady(config: Pick<SiteConfig, "homeService">, v: HomeChoice): boolean {
  if (!v.on) return true;
  if (!v.address.trim() && !/^https?:\/\//.test(v.mapUrl.trim())) return false;
  const zones = homeZones(config);
  return !zones.length || zones.some((z) => z.id === v.zoneId);
}

/**
 * ลูกค้าเลือกว่าจะ "มาที่ร้าน" หรือ "ให้ช่างไปที่บ้าน" (บริการนอกสถานที่)
 * ชื่อบริการ เงื่อนไข โซน และค่าเดินทาง มาจากตั้งค่าของร้าน/สาขาทั้งหมด
 * เลือก "ที่บ้าน" ครั้งแรก = เติมที่อยู่จากโปรไฟล์ลูกค้าให้เอง
 */
export function HomeServiceChooser({
  config,
  value,
  onChange,
  lineUserId,
}: {
  config: Pick<SiteConfig, "homeService" | "features">;
  value: HomeChoice;
  onChange: (v: HomeChoice) => void;
  lineUserId?: string;
}) {
  const label = homeServiceLabel(config);
  const note = String(homeServiceConfig(config).note || "").trim();
  const zones = homeZones(config);
  const feeText = homeFeeText(config);
  const prefilled = useRef(false);

  useEffect(() => {
    if (!value.on || prefilled.current || !lineUserId) return;
    prefilled.current = true;
    if (value.address || value.mapUrl) return;
    customerFetch(`/api/customers/self?lineUserId=${encodeURIComponent(lineUserId)}`)
      .then((r) => r.json())
      .then((d) => {
        const c = d?.customer;
        if (!d?.found || !c) return;
        if (c.address || c.addressMapUrl) {
          onChange({ ...value, address: c.address || "", mapUrl: c.addressMapUrl || "" });
        }
      })
      .catch(() => {
        /* เติมให้ไม่ได้ก็กรอกเอง */
      });
  }, [value, lineUserId, onChange]);

  const chip = (active: boolean) =>
    `flex-1 rounded-petflow-sm border px-3 py-2.5 text-left text-xs font-bold transition ${
      active ? "border-latte-deep bg-latte-deep/10 text-petflow-chocolate" : "border-petflow-line bg-card text-brown-soft"
    }`;

  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-bold text-brown-soft">📍 รับบริการที่ไหน</p>
      <div className="flex gap-2">
        <button type="button" aria-pressed={!value.on} onClick={() => onChange({ ...value, on: false })} className={chip(!value.on)}>
          {!value.on ? "✓ " : ""}🏪 ที่ร้าน
        </button>
        <button type="button" aria-pressed={value.on} onClick={() => onChange({ ...value, on: true })} className={chip(value.on)}>
          {value.on ? "✓ " : ""}🏠 {label}
          {feeText ? <span className="block text-[10px] font-normal">ค่าเดินทาง {feeText}</span> : null}
        </button>
      </div>
      {value.on && (
        <div className="mt-2 space-y-2 rounded-petflow-sm bg-paper p-3">
          {note ? <p className="whitespace-pre-line text-[11px] text-brown">{note}</p> : null}
          {zones.length > 0 && (
            <label className="block text-[11px] font-bold text-brown-soft">
              พื้นที่ / โซน
              <select
                value={value.zoneId}
                onChange={(e) => onChange({ ...value, zoneId: e.target.value })}
                className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-card px-3 py-2 text-sm"
              >
                <option value="">— เลือกโซนที่บ้านอยู่ —</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                    {Number(z.fee) > 0 ? ` (+฿${Number(z.fee).toLocaleString("th-TH")})` : " (ไม่มีค่าเดินทาง)"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-[11px] font-bold text-brown-soft">
            ที่อยู่ / จุดสังเกต
            <textarea
              value={value.address}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
              rows={2}
              placeholder="บ้านเลขที่ ซอย หมู่บ้าน จุดจอดรถ"
              className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-card px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-[11px] font-bold text-brown-soft">
            ลิงก์ Google Maps (ถ้ามี)
            <input
              value={value.mapUrl}
              onChange={(e) => onChange({ ...value, mapUrl: e.target.value })}
              inputMode="url"
              placeholder="https://maps.app.goo.gl/…"
              className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-card px-3 py-2 text-sm"
            />
          </label>
          {!value.address.trim() && !value.mapUrl.trim() && (
            <p className="text-[11px] font-bold text-wait">ใส่ที่อยู่หรือลิงก์แผนที่ก่อนนะคะ ช่างจะได้ไปถูก</p>
          )}
          {zones.length > 0 && !value.zoneId && (
            <p className="text-[11px] font-bold text-wait">เลือกโซนก่อนนะคะ</p>
          )}
        </div>
      )}
    </div>
  );
}
