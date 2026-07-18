"use client";

import { useEffect, useMemo, useState } from "react";
import type { CardStyleConfig } from "@/lib/config-types";
import { toast } from "@/components/Toast";

/**
 * 🎴 ปรับแต่งการ์ด LINE — เลือกสี/ข้อความ/ส่วนประกอบของการ์ดแต่ละใบ พร้อมพรีวิวสดข้างๆ
 * ค่าเก็บใน site config (cards) — ไม่ตั้ง = หน้าตาเดิมของระบบ
 */

type FieldMeta = { key: string; label: string };
type ColorRole = {
  key: "headerColor" | "headerTextColor" | "buttonColor" | "accentColor";
  label: string;
  fallback: string;
};

type CardMeta = {
  key: string;
  name: string;
  desc: string;
  colors: ColorRole[];
  fields: FieldMeta[];
  closingLabel?: string;
};

const CARDS: CardMeta[] = [
  {
    key: "bookingConfirm",
    name: "📅 ยืนยันนัด",
    desc: "ส่งให้ลูกค้ากดยืนยันนัดหมาย",
    colors: [
      { key: "headerColor", label: "สีแถบหัว", fallback: "#5A8F5A" },
      { key: "headerTextColor", label: "สีตัวหนังสือหัว", fallback: "#FFFFFF" },
      { key: "accentColor", label: "สีชื่อบริการ", fallback: "#5C4033" },
      { key: "buttonColor", label: "สีปุ่มยืนยัน", fallback: "#4A7348" },
    ],
    fields: [
      { key: "location", label: "📍 สถานที่ร้าน" },
      { key: "notes", label: "📝 หมายเหตุ" },
      { key: "map", label: "🗺️ ปุ่มดูแผนที่" },
    ],
  },
  {
    key: "billSummary",
    name: "💳 สรุปยอด / แจ้งชำระ",
    desc: "การ์ดสรุปรายการ + ยอดเงิน + บัญชีโอน",
    colors: [
      { key: "headerColor", label: "สีหัวข้อ", fallback: "#5C4033" },
      { key: "accentColor", label: "สียอดสุทธิ", fallback: "#C4956A" },
      { key: "buttonColor", label: "สีปุ่มคัดลอกบัญชี", fallback: "#4A7348" },
    ],
    fields: [
      { key: "schedule", label: "🗓️ วัน-เวลานัด" },
      { key: "freebies", label: "🎁 กล่องของแถมฟรี" },
      { key: "bank", label: "🏦 กล่องเลขบัญชี + ปุ่มคัดลอก" },
      { key: "closing", label: "💬 ข้อความปิดท้าย" },
    ],
    closingLabel: "ข้อความปิดท้าย (เช่น โอนแล้วแจ้งสลิปได้เลยนะคะ 🧡)",
  },
  {
    key: "depositRequest",
    name: "💰 เรียกเก็บมัดจำ",
    desc: "การ์ดแจ้งยอดมัดจำ + บัญชีโอน",
    colors: [
      { key: "headerColor", label: "สีหัวข้อ", fallback: "#5C4033" },
      { key: "accentColor", label: "สียอดมัดจำ", fallback: "#C4956A" },
      { key: "buttonColor", label: "สีปุ่มคัดลอกบัญชี", fallback: "#4A7348" },
    ],
    fields: [
      { key: "note", label: "📝 โน้ตเพิ่มเติม" },
      { key: "bank", label: "🏦 กล่องเลขบัญชี" },
    ],
    closingLabel: "ข้อความปิดท้าย (ไม่บังคับ)",
  },
  {
    key: "receipt",
    name: "🧾 ใบเสร็จรับเงิน",
    desc: "ส่งอัตโนมัติหลังรับชำระ",
    colors: [
      { key: "headerColor", label: "สีแถบหัว", fallback: "#C4956A" },
      { key: "headerTextColor", label: "สีตัวหนังสือหัว", fallback: "#FFFFFF" },
      { key: "accentColor", label: "สียอดที่ชำระ", fallback: "#4A7348" },
    ],
    fields: [
      { key: "invoiceNo", label: "🔖 เลขที่บิล" },
      { key: "points", label: "🎁 แต้มสะสมที่ได้รับ" },
      { key: "closing", label: "💬 ข้อความขอบคุณ" },
    ],
    closingLabel: "ข้อความขอบคุณท้ายใบเสร็จ",
  },
  {
    key: "review",
    name: "⭐ ขอรีวิว",
    desc: "ส่งหลังใช้บริการ ชวนกดรีวิว",
    colors: [
      { key: "headerColor", label: "สีพื้นหัวการ์ด", fallback: "#FBF4E9" },
      { key: "headerTextColor", label: "สีหัวข้อ", fallback: "#5C4033" },
      { key: "accentColor", label: "สีดาว", fallback: "#C4956A" },
      { key: "buttonColor", label: "สีปุ่มรีวิว", fallback: "#C4956A" },
    ],
    fields: [{ key: "stars", label: "⭐ แถวดาว 5 ดวงบนหัวการ์ด" }],
    closingLabel: "ประโยคเสริมท้ายการ์ด (ไม่บังคับ)",
  },
  {
    key: "groomInfo",
    name: "🩺 สอบถามประวัติก่อนอาบน้ำ",
    desc: "การ์ดลิงก์ให้ลูกค้ากรอกประวัติน้อง",
    colors: [
      { key: "headerColor", label: "สีแถบหัว", fallback: "#5A8F5A" },
      { key: "headerTextColor", label: "สีตัวหนังสือหัว", fallback: "#FFFFFF" },
      { key: "accentColor", label: "สีชื่อน้อง", fallback: "#5C4033" },
      { key: "buttonColor", label: "สีปุ่มแจ้งประวัติ", fallback: "#4A7348" },
    ],
    fields: [{ key: "date", label: "📅 วันเวลานัด" }],
    closingLabel: "ประโยคเสริมท้ายการ์ด (ไม่บังคับ)",
  },
];

const SWATCHES = [
  "#5A8F5A", "#4A7348", "#C4956A", "#5C4033", "#B4553B",
  "#3E6990", "#7C5CBF", "#C75B7A", "#2E8B8B", "#D4A017",
];

function styleValue(st: CardStyleConfig, role: ColorRole) {
  return st[role.key] || role.fallback;
}

/* ── พรีวิวสด — จำลองหน้าตาการ์ดใน LINE ── */
function Preview({ meta, st }: { meta: CardMeta; st: CardStyleConfig }) {
  const show = (k: string) => st.show?.[k] !== false;
  const c = (role: ColorRole["key"], fb: string) => st[role] || fb;

  const bubble = "overflow-hidden rounded-2xl border border-[#e8e0d0] bg-white shadow-lg";
  const btn = (color: string, label: string) => (
    <div className="px-3 pb-3">
      <div
        className="rounded-lg py-2 text-center text-xs font-bold text-white"
        style={{ background: color }}
      >
        {label}
      </div>
    </div>
  );

  if (meta.key === "bookingConfirm") {
    return (
      <div className={bubble}>
        <div className="px-4 py-3" style={{ background: c("headerColor", "#5A8F5A") }}>
          <p className="text-xs font-extrabold" style={{ color: c("headerTextColor", "#FFFFFF") }}>
            📅 กำหนดการนัด
          </p>
        </div>
        <div className="space-y-2 px-4 py-3 text-[11px] text-[#4E3E32]">
          <p className="text-sm font-extrabold" style={{ color: c("accentColor", "#5C4033") }}>
            อาบน้ำ &amp; กรูมมิ่ง · Soju
          </p>
          <p className="text-[10px] text-[#A2907E]">แจ้งกำหนดการนัด 🗓️ คุณตาล</p>
          <p>🗓️ <b>วันที่</b> — 24 ก.ค. 2569</p>
          <p>⏰ <b>เวลา</b> — 12:30 น.</p>
          {show("location") && <p>📍 <b>สถานที่</b> — CatCha Hotel · เทพารักษ์ บางนา</p>}
          {show("notes") && <p>📝 <b>หมายเหตุ</b> — แจ้งในแชทได้เลยนะคะ</p>}
        </div>
        {btn(c("buttonColor", "#4A7348"), "🐾 ยืนยันนัด")}
        {show("map") && (
          <p className="pb-3 text-center text-[10px] font-bold text-[#3E6990]">🗺️ ดูแผนที่ / เส้นทาง</p>
        )}
      </div>
    );
  }

  if (meta.key === "billSummary") {
    return (
      <div className={bubble}>
        <div className="space-y-2 px-4 py-3 text-[11px] text-[#4E3E32]">
          <p className="text-sm font-extrabold" style={{ color: c("headerColor", "#5C4033") }}>
            💳 แจ้งยอดชำระ
          </p>
          <p className="text-[10px] text-[#A2907E]">Soju · ตาล</p>
          {show("schedule") && <p className="text-[10px] font-bold">🛁 นัดอาบน้ำ: 24 ก.ค. 12:30 น.</p>}
          <hr className="border-[#eee3d2]" />
          <div className="flex justify-between"><span>Catcha Premium · แมวไทย M</span><span>900 บาท</span></div>
          <div className="flex justify-between text-[#C08A2E]"><span>ส่วนลด</span><span>-45 บาท</span></div>
          <hr className="border-[#eee3d2]" />
          <div className="flex items-baseline justify-between">
            <span className="font-extrabold">ยอดสุทธิ</span>
            <span className="text-base font-extrabold" style={{ color: c("accentColor", "#C4956A") }}>855 บาท</span>
          </div>
          {show("freebies") && (
            <div className="rounded-lg bg-[#FBF7F0] px-2.5 py-1.5 text-[10px]">
              <b>🎁 ของแถมฟรี</b> · กล้องวงจรปิด (CCTV)
            </div>
          )}
          {show("bank") && (
            <div className="rounded-lg bg-[#F4ECE0] px-2.5 py-2">
              <p className="font-extrabold">กรุงไทย</p>
              <p className="text-sm font-extrabold text-[#4A7348]">664-4-43446-0</p>
              <p className="text-[10px] text-[#A2907E]">ชื่อบัญชี: CatCha Hotel</p>
            </div>
          )}
          {show("closing") && (st.closing || "โอนแล้วแจ้งสลิปได้เลยนะคะ 🧡") && (
            <p className="text-[10px] text-[#A2907E]">{st.closing || "โอนแล้วแจ้งสลิปได้เลยนะคะ 🧡"}</p>
          )}
        </div>
        {show("bank") && btn(c("buttonColor", "#4A7348"), "📋 คัดลอกเลขบัญชี")}
      </div>
    );
  }

  if (meta.key === "depositRequest") {
    return (
      <div className={bubble}>
        <div className="space-y-2 px-4 py-3 text-[11px] text-[#4E3E32]">
          <p className="text-sm font-extrabold" style={{ color: c("headerColor", "#5C4033") }}>
            🧡 ล็อกคิวให้น้องกันค่ะ
          </p>
          <p>รบกวนชำระมัดจำเพื่อจองคิวนะคะ มัดจำหักจากยอดสุดท้าย ไม่เก็บเพิ่มค่ะ</p>
          {show("note") && <p className="text-[10px] text-[#A2907E]">📝 โน้ต: จองคิววันเสาร์</p>}
          <div className="rounded-xl bg-[#FBF4E9] px-3 py-3 text-center">
            <p className="text-[10px] text-[#A2907E]">มัดจำที่ต้องโอน</p>
            <p className="text-2xl font-extrabold" style={{ color: c("accentColor", "#C4956A") }}>200 บาท</p>
          </div>
          {show("bank") && (
            <div className="rounded-lg bg-[#F4ECE0] px-2.5 py-2">
              <p className="font-extrabold">กรุงไทย</p>
              <p className="text-sm font-extrabold text-[#4A7348]">664-4-43446-0</p>
              <p className="text-[10px] text-[#A2907E]">ชื่อบัญชี: CatCha Hotel</p>
            </div>
          )}
          {st.closing && <p className="text-[10px] text-[#A2907E]">{st.closing}</p>}
        </div>
        {btn(c("buttonColor", "#4A7348"), "📋 คัดลอกเลขบัญชี")}
      </div>
    );
  }

  if (meta.key === "receipt") {
    return (
      <div className={bubble}>
        <div className="px-4 py-3" style={{ background: c("headerColor", "#C4956A") }}>
          <p className="text-sm font-extrabold" style={{ color: c("headerTextColor", "#FFFFFF") }}>
            🧾 ใบเสร็จรับเงิน
          </p>
          <p className="text-[10px]" style={{ color: c("headerTextColor", "#FFFFFF") }}>CatCha Hotel</p>
        </div>
        <div className="space-y-2 px-4 py-3 text-[11px] text-[#4E3E32]">
          <p>🐱 <b>ลูกค้า</b> — Soju · ตาล</p>
          {show("invoiceNo") && <p>🔖 <b>เลขที่</b> — INV1784047676893</p>}
          <div className="rounded-xl bg-[#FBF4E9] px-3 py-3 text-center">
            <p className="text-[10px] text-[#A2907E]">ชำระแล้ว</p>
            <p className="text-2xl font-extrabold" style={{ color: c("accentColor", "#4A7348") }}>855 บาท</p>
            <p className="text-[10px] text-[#A2907E]">(โอนเงิน)</p>
          </div>
          {show("points") && (
            <div className="flex justify-between rounded-lg bg-[#F4ECE0] px-2.5 py-2">
              <span>🎁 แต้มสะสมที่ได้รับ</span>
              <b className="text-[#C4956A]">+8</b>
            </div>
          )}
          {show("closing") && (
            <p className="text-center text-[10px] text-[#A2907E]">
              {st.closing || "ขอบคุณที่ไว้วางใจ CatCha Hotel นะคะ 🧡"}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (meta.key === "review") {
    return (
      <div className={bubble}>
        <div className="px-4 py-4 text-center" style={{ background: c("headerColor", "#FBF4E9") }}>
          {show("stars") && (
            <p className="text-sm" style={{ color: c("accentColor", "#C4956A") }}>⭐ ⭐ ⭐ ⭐ ⭐</p>
          )}
          <p className="mt-1 text-xs font-extrabold" style={{ color: c("headerTextColor", "#5C4033") }}>
            ขอบคุณที่ไว้วางใจ CatCha Hotel นะคะ 🧡
          </p>
        </div>
        <div className="space-y-1.5 px-4 py-3 text-[11px] text-[#4E3E32]">
          <p>หวังว่าน้องจะกลับบ้านไปตัวหอม นุ่มฟู และมีความสุขนะคะ 🐱✨</p>
          <p>ถ้าประทับใจบริการของเรา ฝากรีวิวสั้นๆ ให้ทีมงานหน่อยนะคะ</p>
          {st.closing && <p className="text-[10px] text-[#A2907E]">{st.closing}</p>}
        </div>
        {btn(c("buttonColor", "#C4956A"), "⭐ รีวิวให้เราหน่อยนะคะ")}
      </div>
    );
  }

  // groomInfo
  return (
    <div className={bubble}>
      <div className="px-4 py-3" style={{ background: c("headerColor", "#5A8F5A") }}>
        <p className="text-xs font-extrabold" style={{ color: c("headerTextColor", "#FFFFFF") }}>
          🩺 ประวัติน้องก่อนอาบน้ำ
        </p>
      </div>
      <div className="space-y-2 px-4 py-3 text-[11px] text-[#4E3E32]">
        <p className="text-sm font-extrabold" style={{ color: c("accentColor", "#5C4033") }}>🐱 Soju</p>
        {show("date") && <p className="text-[10px] text-[#A2907E]">📅 นัดอาบน้ำ: 24 ก.ค. 12:30</p>}
        <p>รบกวนแจ้งประวัติน้องสั้นๆ เพื่อให้เราเตรียมดูแลน้องได้ถูกวิธีนะคะ 🐾</p>
        {st.closing && <p className="text-[10px] text-[#A2907E]">{st.closing}</p>}
      </div>
      {btn(c("buttonColor", "#4A7348"), "🩺 แจ้งประวัติน้อง")}
    </div>
  );
}

export default function CardsStudioPage() {
  const [cards, setCards] = useState<Record<string, CardStyleConfig>>({});
  const [activeKey, setActiveKey] = useState(CARDS[0].key);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        setCards(d.config?.cards || {});
      })
      .finally(() => setLoaded(true));
  }, []);

  const meta = useMemo(() => CARDS.find((c) => c.key === activeKey)!, [activeKey]);
  const st = cards[activeKey] || {};

  const patch = (p: Partial<CardStyleConfig>) => {
    setCards((prev) => ({ ...prev, [activeKey]: { ...prev[activeKey], ...p } }));
    setDirty(true);
  };

  const toggleField = (key: string) => {
    const cur = st.show?.[key] !== false;
    patch({ show: { ...st.show, [key]: !cur } });
  };

  const resetCard = () => {
    setCards((prev) => {
      const next = { ...prev };
      delete next[activeKey];
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch: { cards } }),
      });
      if (res.ok) {
        toast("✅ บันทึกแล้ว — การ์ดที่ส่งหลังจากนี้ใช้หน้าตาใหม่ทันที", "success");
        setDirty(false);
      } else {
        toast("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-catcha-chocolate">🎴 ปรับแต่งการ์ด LINE</h1>
          <p className="mt-1 text-xs text-brown-soft">
            เลือกสี เปิด/ปิดส่วนประกอบ และข้อความของการ์ดแต่ละใบ — เห็นตัวอย่างสดทางขวาก่อนบันทึก
          </p>
        </div>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={save}
          className="rounded-catcha-sm bg-gradient-to-r from-latte-deep to-catcha-chocolate px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
        >
          {saving ? "กำลังบันทึก…" : dirty ? "💾 บันทึกการเปลี่ยนแปลง" : "✅ บันทึกแล้ว"}
        </button>
      </div>

      {/* เลือกการ์ด */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActiveKey(c.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${
              activeKey === c.key
                ? "bg-latte-deep text-white"
                : "bg-card text-brown-soft border border-catcha-line"
            }`}
          >
            {c.name}
            {cards[c.key] && Object.keys(cards[c.key]).length > 0 ? " •" : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* ── ตัวแก้ไข ── */}
        <div className="space-y-4 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
          <div>
            <p className="text-sm font-extrabold text-catcha-chocolate">{meta.name}</p>
            <p className="text-[11px] text-brown-soft">{meta.desc}</p>
          </div>

          {/* สี */}
          <div>
            <p className="mb-2 text-xs font-extrabold text-brown">🎨 สีของการ์ด</p>
            <div className="space-y-2.5">
              {meta.colors.map((role) => (
                <div key={role.key} className="flex flex-wrap items-center gap-2">
                  <label className="w-36 shrink-0 text-[11px] font-bold text-brown-soft">
                    {role.label}
                  </label>
                  <input
                    type="color"
                    value={styleValue(st, role)}
                    onChange={(e) => patch({ [role.key]: e.target.value })}
                    className="h-8 w-12 cursor-pointer rounded border border-catcha-line bg-paper"
                  />
                  <span className="text-[10px] font-mono text-brown-faint">
                    {styleValue(st, role)}
                  </span>
                  <div className="flex gap-1">
                    {SWATCHES.slice(0, 6).map((sw) => (
                      <button
                        key={sw}
                        type="button"
                        title={sw}
                        onClick={() => patch({ [role.key]: sw })}
                        className="h-5 w-5 rounded-full border border-white shadow"
                        style={{ background: sw }}
                      />
                    ))}
                  </div>
                  {st[role.key] && (
                    <button
                      type="button"
                      onClick={() => patch({ [role.key]: undefined })}
                      className="text-[10px] font-bold text-wait underline"
                    >
                      คืนค่าเดิม
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ส่วนประกอบ */}
          <div>
            <p className="mb-2 text-xs font-extrabold text-brown">🧩 ในการ์ดจะมีอะไรบ้าง</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {meta.fields.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 rounded-catcha-sm bg-paper px-2.5 py-2 text-[11px] font-bold text-brown"
                >
                  <input
                    type="checkbox"
                    checked={st.show?.[f.key] !== false}
                    onChange={() => toggleField(f.key)}
                    className="h-4 w-4 accent-[#4A7348]"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {/* ข้อความปิดท้าย */}
          {meta.closingLabel && (
            <div>
              <p className="mb-1 text-xs font-extrabold text-brown">💬 {meta.closingLabel}</p>
              <textarea
                value={st.closing || ""}
                onChange={(e) => patch({ closing: e.target.value || undefined })}
                placeholder="เว้นว่าง = ใช้ข้อความเดิมของระบบ"
                rows={2}
                className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-xs"
              />
            </div>
          )}

          <button
            type="button"
            onClick={resetCard}
            className="rounded-full bg-paper px-3.5 py-1.5 text-[11px] font-bold text-wait"
          >
            ↩️ รีเซ็ตการ์ดนี้กลับค่าเริ่มต้นทั้งหมด
          </button>
        </div>

        {/* ── พรีวิวสด ── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-center text-[11px] font-extrabold text-brown-soft">
            👀 ตัวอย่างที่ลูกค้าจะเห็นใน LINE (อัปเดตสดตามที่แก้)
          </p>
          <div className="rounded-2xl bg-[#8cabd8] p-4">
            <Preview meta={meta} st={st} />
          </div>
        </div>
      </div>
    </div>
  );
}
