"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SiteConfig } from "@/lib/config-types";
import type { RoomType } from "@/lib/business";
import { adminJson } from "@/lib/admin-fetch";
import { toJpegDataUrl } from "@/lib/image-convert";
import { extractLogoColors } from "@/lib/color-extract";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";

type Tab =
  | "shop"
  | "payment"
  | "messages"
  | "automation"
  | "lists"
  | "rooms"
  | "grooming"
  | "points"
  | "crm"
  | "advanced";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "shop", label: "ร้าน", icon: "🏪" },
  { id: "payment", label: "บัญชี", icon: "🏦" },
  { id: "messages", label: "ข้อความ", icon: "💬" },
  { id: "automation", label: "อัตโนมัติ", icon: "⏰" },
  { id: "lists", label: "รายการ", icon: "📋" },
  { id: "rooms", label: "ห้อง", icon: "🛏️" },
  { id: "grooming", label: "อาบน้ำ", icon: "🛁" },
  { id: "points", label: "แต้ม", icon: "🎁" },
  { id: "crm", label: "ลูกค้า", icon: "👥" },
  { id: "advanced", label: "ขั้นสูง", icon: "⚙️" },
];

// index ต้องตรงกับ Date.prototype.getDay() (0=อาทิตย์ … 6=เสาร์) — ใช้เทียบกับ config.closedWeekdays
const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function SettingsPage() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [tab, setTab] = useState<Tab>("shop");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [jsonText, setJsonText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await adminJson<{ config: SiteConfig }>("/api/config");
    if (result.ok && result.data.config) {
      setConfig(result.data.config);
      setJsonText(JSON.stringify(result.data.config, null, 2));
    } else {
      setConfig(null);
      setError(result.ok ? "โหลดข้อมูลไม่สำเร็จ" : result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: Partial<SiteConfig>) => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patch }),
    });
    const data = await res.json();
    if (res.ok) {
      setConfig(data.config);
      setJsonText(JSON.stringify(data.config, null, 2));
      setMsg("✅ บันทึกแล้ว — หน้าลูกค้าอัปเดตทันที");
    } else {
      setMsg("❌ บันทึกไม่สำเร็จ");
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const saveJson = async () => {
    try {
      const parsed = JSON.parse(jsonText) as SiteConfig;
      setSaving(true);
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replace", config: parsed }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        setMsg("✅ นำเข้า config สำเร็จ");
      }
    } catch {
      setMsg("❌ JSON ไม่ถูกต้อง");
    }
    setSaving(false);
  };

  if (loading) {
    return <p className="text-center text-sm text-brown-soft py-10">กำลังโหลด…</p>;
  }

  if (!config) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold text-wait">{error || "โหลดไม่สำเร็จ"}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-petflow-sm bg-honey/40 px-4 py-2 text-xs font-bold"
        >
          🔄 ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-petflow-chocolate">⚙️ ตั้งค่าระบบ</h1>
      <p className="mb-4 text-xs text-brown-soft">
        แก้รูป ราคา โปร ข้อมูลร้าน — ไม่ต้องแก้โค้ด · v{config.version}
      </p>

      {msg && (
        <p className="mb-3 rounded-petflow-sm bg-sage/15 px-3 py-2 text-xs font-bold text-ok">
          {msg}
        </p>
      )}

      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              tab === t.id ? "bg-honey/45 text-petflow-chocolate" : "bg-paper text-brown-soft"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <Link
        href="/admin/promos"
        className="mb-4 block rounded-petflow-sm border border-petflow-line bg-card px-4 py-3 text-xs font-bold text-latte-deep"
      >
        ✨ จัดการโปรโมชั่น (แยกหน้า) →
      </Link>

      {tab === "shop" && (
        <ShopTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "payment" && (
        <PaymentTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "messages" && (
        <MessagesTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "automation" && (
        <AutomationTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "lists" && (
        <ListsTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "rooms" && (
        <RoomsTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "grooming" && (
        <GroomingTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "points" && (
        <PointsTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "crm" && (
        <CrmTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "advanced" && (
        <AdvancedTab
          jsonText={jsonText}
          setJsonText={setJsonText}
          saving={saving}
          onSaveJson={saveJson}
          onExport={() => navigator.clipboard.writeText(jsonText)}
        />
      )}
    </div>
  );
}

const BRANDING_DEFAULT: NonNullable<SiteConfig["branding"]> = {
  primary: "#a9855f",
  accent: "#ebc583",
  heading: "#5c4033",
  background: "#fbf6ef",
  surface: "#fffdfa",
  text: "#4e3e32",
};

function ShopTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [form, setForm] = useState(config.business);
  const [branding, setBranding] = useState({ ...BRANDING_DEFAULT, ...config.branding });
  const gradientOn = Boolean(branding.backgroundGradientFrom && branding.backgroundGradientTo);
  const [extracting, setExtracting] = useState(false);
  const [extractErr, setExtractErr] = useState("");

  const autoDetectColors = async () => {
    if (!branding.logoUrl) return;
    setExtracting(true);
    setExtractErr("");
    const picked = await extractLogoColors(branding.logoUrl);
    setExtracting(false);
    if (!picked) {
      setExtractErr("ดึงสีจากโลโก้ไม่สำเร็จ — ลองอัปโหลดรูปใหม่ หรือปรับสีเองด้านล่างได้เลย");
      return;
    }
    setBranding((b) => ({ ...b, ...picked }));
  };

  useEffect(() => {
    setForm(config.business);
  }, [config.business]);
  useEffect(() => {
    setBranding({ ...BRANDING_DEFAULT, ...config.branding });
  }, [config.branding]);

  return (
    <form
      className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ business: form, branding });
      }}
    >
      <p className="text-xs font-extrabold text-petflow-chocolate">🎨 สีและโลโก้ประจำร้าน</p>
      <p className="text-[10px] text-brown-faint">
        ปรับสีทั้งหน้า (พื้นหลัง การ์ด ปุ่ม หัวข้อ ตัวอักษร) และโลโก้ ให้เข้ากับแบรนด์ร้าน —
        มีผลทั้งหน้าลูกค้าและหลังบ้าน ไม่ต้องแก้โค้ด
      </p>
      <PosterField
        label="โลโก้ร้าน"
        value={branding.logoUrl || ""}
        onChange={(v) => setBranding({ ...branding, logoUrl: v })}
        onUpload={(f) => {
          const reader = new FileReader();
          reader.onload = () => {
            const url = String(reader.result);
            setBranding((b) => ({ ...b, logoUrl: url }));
            extractLogoColors(url).then((picked) => {
              if (picked) setBranding((b) => ({ ...b, ...picked }));
            });
          };
          reader.readAsDataURL(f);
        }}
      />
      {branding.logoUrl && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={extracting}
            onClick={autoDetectColors}
            className="rounded-full bg-honey/30 px-3 py-1.5 text-[11px] font-bold text-latte-deep disabled:opacity-50"
          >
            {extracting ? "กำลังดึงสี…" : "🪄 ดึงสีจากโลโก้อัตโนมัติ"}
          </button>
          {extractErr && <span className="text-[10px] font-bold text-wait">{extractErr}</span>}
        </div>
      )}
      <p className="text-[10px] font-bold text-brown-soft">ปุ่ม / จุดเน้น</p>
      <div className="grid grid-cols-3 gap-2">
        <ColorField
          label="สีหลัก (ปุ่ม)"
          value={branding.primary}
          onChange={(v) => setBranding({ ...branding, primary: v })}
        />
        <ColorField
          label="สีไฮไลท์"
          value={branding.accent}
          onChange={(v) => setBranding({ ...branding, accent: v })}
        />
        <ColorField
          label="สีหัวข้อ"
          value={branding.heading}
          onChange={(v) => setBranding({ ...branding, heading: v })}
        />
      </div>
      <p className="text-[10px] font-bold text-brown-soft">พื้นหลัง / ตัวอักษร</p>
      <div className="grid grid-cols-3 gap-2">
        <ColorField
          label={gradientOn ? "พื้นหลัง (ทึบ — สำรอง)" : "พื้นหลังเว็บ"}
          value={branding.background}
          onChange={(v) => setBranding({ ...branding, background: v })}
        />
        <ColorField
          label="พื้นการ์ด"
          value={branding.surface}
          onChange={(v) => setBranding({ ...branding, surface: v })}
        />
        <ColorField
          label="ตัวอักษร"
          value={branding.text}
          onChange={(v) => setBranding({ ...branding, text: v })}
        />
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="🌈 พื้นหลังไล่เฉด (gradient) แทนสีทึบ"
          checked={gradientOn}
          onChange={(v) =>
            setBranding((b) => ({
              ...b,
              backgroundGradientFrom: v ? b.background : "",
              backgroundGradientTo: v ? b.accent : "",
            }))
          }
        />
        {gradientOn && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ColorField
              label="จุดเริ่มไล่สี"
              value={branding.backgroundGradientFrom || branding.background}
              onChange={(v) => setBranding({ ...branding, backgroundGradientFrom: v })}
            />
            <ColorField
              label="จุดจบไล่สี"
              value={branding.backgroundGradientTo || branding.accent}
              onChange={(v) => setBranding({ ...branding, backgroundGradientTo: v })}
            />
          </div>
        )}
      </div>

      <div
        className="space-y-2 rounded-petflow-sm p-4"
        style={{
          background: gradientOn
            ? `linear-gradient(135deg, ${branding.backgroundGradientFrom} 0%, ${branding.backgroundGradientTo} 100%)`
            : branding.background,
        }}
      >
        <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: branding.text, opacity: 0.5 }}>
          ตัวอย่าง
        </p>
        <div className="rounded-petflow-sm p-3" style={{ background: branding.surface }}>
          <p className="text-sm font-extrabold" style={{ color: branding.heading }}>
            ตัวอย่างหัวข้อ
          </p>
          <p className="mb-2 text-xs" style={{ color: branding.text }}>
            ตัวอย่างข้อความเนื้อหาในการ์ด
          </p>
          <span
            className="inline-block rounded-full px-3 py-1.5 text-xs font-extrabold text-white"
            style={{ background: branding.primary }}
          >
            ตัวอย่างปุ่ม
          </span>
          <span
            className="ml-2 inline-block rounded-full px-3 py-1.5 text-xs font-extrabold"
            style={{ background: branding.accent, color: branding.heading }}
          >
            ไฮไลท์
          </span>
        </div>
      </div>
      {JSON.stringify(branding) !== JSON.stringify({ ...BRANDING_DEFAULT, ...config.branding }) && (
        <button
          type="button"
          onClick={() => setBranding(BRANDING_DEFAULT)}
          className="text-[10px] font-bold text-brown-faint underline"
        >
          รีเซ็ตเป็นสีเริ่มต้น
        </button>
      )}

      <hr className="border-petflow-line" />
      <Field label="ชื่อร้าน" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Field label="LINE OA" value={form.lineOa} onChange={(v) => setForm({ ...form, lineOa: v })} />
      <Field
        label="เบอร์โทร (คั่นด้วย ,)"
        value={form.phones.join(", ")}
        onChange={(v) => setForm({ ...form, phones: v.split(",").map((s) => s.trim()) })}
      />
      <Field label="Google Maps URL" value={form.maps} onChange={(v) => setForm({ ...form, maps: v })} />
      <Field label="Facebook" value={form.facebook} onChange={(v) => setForm({ ...form, facebook: v })} />
      <Field
        label="⭐ ลิงก์รีวิว (Google) — ส่งให้ลูกค้ารีวิว"
        value={form.reviewUrl || ""}
        onChange={(v) => setForm({ ...form, reviewUrl: v })}
      />
      <Field
        label="คำในปุ่มรีวิว"
        value={form.reviewButtonText || ""}
        onChange={(v) => setForm({ ...form, reviewButtonText: v })}
      />
      <Field label="ที่อยู่ (ไทย)" value={form.location.th} onChange={(v) => setForm({ ...form, location: { ...form.location, th: v } })} />
      <Field label="ที่อยู่ (EN)" value={form.location.en} onChange={(v) => setForm({ ...form, location: { ...form.location, en: v } })} />
      <Field
        label="เลขประจำตัวผู้เสียภาษี (โชว์บนเอกสารภาษี · ไม่บังคับ)"
        value={form.taxId || ""}
        onChange={(v) => setForm({ ...form, taxId: v })}
      />
      <Field
        label="อัตราแต้ม (บาท = 1 แต้ม)"
        type="number"
        value={String(form.pointsRate)}
        onChange={(v) => setForm({ ...form, pointsRate: Number(v) || 100 })}
      />
      <SaveBtn saving={saving} />
    </form>
  );
}

function PaymentTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [form, setForm] = useState(config.payment);
  useEffect(() => setForm(config.payment), [config.payment]);

  return (
    <form
      className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ payment: form });
      }}
    >
      <Field label="ธนาคาร" value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} />
      <Field label="เลขบัญชี" value={form.accountNumber} onChange={(v) => setForm({ ...form, accountNumber: v })} />
      <Field label="ชื่อบัญชี" value={form.accountName} onChange={(v) => setForm({ ...form, accountName: v })} />
      <p className="rounded-petflow-sm bg-paper px-3 py-2 text-[11px] text-brown-faint">
        💬 ข้อความสรุป/แจ้งมัดจำ/เก็บเงิน และข้อความอื่นๆ ที่ส่งให้ลูกค้า
        ย้ายไปแก้ที่แท็บ <b>💬 ข้อความ</b> แล้ว
      </p>
      <SaveBtn saving={saving} />
    </form>
  );
}

function MessagesTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [bill, setBill] = useState(config.billing);
  const [msgs, setMsgs] = useState(config.messages);
  const [crm, setCrm] = useState(config.crm);
  useEffect(() => setBill(config.billing), [config.billing]);
  useEffect(() => setMsgs(config.messages), [config.messages]);
  useEffect(() => setCrm(config.crm), [config.crm]);

  return (
    <form
      className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ billing: bill, messages: msgs, crm });
      }}
    >
      <p className="text-xs font-extrabold text-petflow-chocolate">
        🧾 สรุปยอด / แจ้งมัดจำ / เก็บเงิน (ตอนกดคิดเงิน)
      </p>
      <Field
        label="หัวเรื่อง — สรุปการจอง"
        value={bill?.summaryBookingTitle || ""}
        onChange={(v) => setBill({ ...bill, summaryBookingTitle: v })}
      />
      <Field
        label="หัวเรื่อง — แจ้งมัดจำ"
        value={bill?.summaryDepositTitle || ""}
        onChange={(v) => setBill({ ...bill, summaryDepositTitle: v })}
      />
      <Field
        label="หัวเรื่อง — แจ้งยอดเต็ม (เก็บเงิน)"
        value={bill?.summaryFullTitle || ""}
        onChange={(v) => setBill({ ...bill, summaryFullTitle: v })}
      />
      <Field
        label="ข้อความปิดท้าย (ทุกแบบ)"
        value={bill?.summaryClosing || ""}
        onChange={(v) => setBill({ ...bill, summaryClosing: v })}
      />

      <hr className="border-petflow-line" />
      <p className="text-xs font-extrabold text-petflow-chocolate">
        ⏰ เตือนอัตโนมัติก่อนเข้าพัก
      </p>
      <TextAreaField
        label="เตือนยอดคงเหลือ (7 วันก่อนเข้าพัก)"
        hint="ใช้ได้: {shop} {cat} {checkin} {deposit} {remaining} {bank} {accountNumber} {accountName}"
        value={msgs?.depositReminder || ""}
        onChange={(v) => setMsgs({ ...msgs, depositReminder: v })}
        rows={7}
      />
      <p className="text-[11px] font-bold text-brown-soft">
        การ์ดแจ้งเข้าพัก (จัดรูปแบบสวยงามอัตโนมัติ · ส่ง 3 วันก่อนเข้าพัก)
      </p>
      <TextAreaField
        label="ทักทายเปิดการ์ด"
        hint="ใช้ได้: {shop} {cat}"
        value={msgs?.prestayIntro || ""}
        onChange={(v) => setMsgs({ ...msgs, prestayIntro: v })}
        rows={2}
      />
      <TextAreaField
        label="เกริ่นก่อนลิสต์ของที่ต้องเตรียม"
        value={msgs?.prestayPrepIntro || ""}
        onChange={(v) => setMsgs({ ...msgs, prestayPrepIntro: v })}
        rows={2}
      />
      <TextAreaField
        label="ของที่ต้องเตรียม (1 บรรทัด = 1 ข้อ · ใส่อีโมจิหน้าได้)"
        value={(msgs?.prestayPrepItems || []).join("\n")}
        onChange={(v) =>
          setMsgs({
            ...msgs,
            prestayPrepItems: v.split("\n").map((s) => s.trim()).filter(Boolean),
          })
        }
        rows={4}
      />
      <TextAreaField
        label="ข้อความปิดท้าย (ชวนแจ้งการดูแลพิเศษ)"
        hint="ใช้ได้: {cat}"
        value={msgs?.prestayCareNote || ""}
        onChange={(v) => setMsgs({ ...msgs, prestayCareNote: v })}
        rows={3}
      />
      <TextAreaField
        label="🐈 ข้อความเตือนให้เตรียมทราย (เฉพาะเข้าพักสั้นกว่าเกณฑ์แถมฟรี)"
        hint="ใช้ได้: {min} = จำนวนคืนขั้นต่ำที่แถมทรายฟรี (ตั้งในแท็บ ⏰ อัตโนมัติ)"
        value={msgs?.prestayLitterNote || ""}
        onChange={(v) => setMsgs({ ...msgs, prestayLitterNote: v })}
        rows={3}
      />
      <TextAreaField
        label="🧳 เตือนเช็คอิน (ก่อนวันเข้าพัก)"
        hint="ใช้ได้: {shop} {cat} {checkin} {room} {litterNote}"
        value={msgs?.checkinReminder || ""}
        onChange={(v) => setMsgs({ ...msgs, checkinReminder: v })}
        rows={8}
      />
      <TextAreaField
        label="🧳 เตือนเช็คเอาท์ (ก่อนวันออก)"
        hint="ใช้ได้: {shop} {cat} {checkout}"
        value={msgs?.checkoutReminder || ""}
        onChange={(v) => setMsgs({ ...msgs, checkoutReminder: v })}
        rows={6}
      />
      <TextAreaField
        label="⭐ ขอรีวิว (หลังเช็คเอาท์)"
        hint="ใช้ได้: {shop} {cat}"
        value={msgs?.reviewRequest || ""}
        onChange={(v) => setMsgs({ ...msgs, reviewRequest: v })}
        rows={5}
      />
      <TextAreaField
        label="🩺 สอบถามประวัติน้องก่อนอาบน้ำ"
        hint="ใช้ได้: {shop} {cat}"
        value={msgs?.groomInfoIntro || ""}
        onChange={(v) => setMsgs({ ...msgs, groomInfoIntro: v })}
        rows={5}
      />

      <hr className="border-petflow-line" />
      <p className="text-xs font-extrabold text-petflow-chocolate">
        💛 ตามลูกค้าที่หายไป
      </p>
      <TextAreaField
        label="ข้อความตามลูกค้า"
        hint="ใช้ได้: {name} {cats} {days}"
        value={crm?.followUpMessage || ""}
        onChange={(v) => setCrm({ ...crm, followUpMessage: v })}
        rows={3}
      />

      <hr className="border-petflow-line" />
      <p className="text-xs font-extrabold text-petflow-chocolate">
        📨 การ์ดเรียกเก็บมัดจำ (ส่งก่อนลูกค้าโอน)
      </p>
      <Field
        label="หัวเรื่อง"
        value={msgs?.depositRequestTitle || ""}
        onChange={(v) => setMsgs({ ...msgs, depositRequestTitle: v })}
      />
      <TextAreaField
        label="ข้อความ"
        hint="ใช้ได้: {name} {cat} {amount} · {pct} = ' 30% ของค่าบริการ' (เว้นว่างถ้าไม่ได้เลือก %)"
        value={msgs?.depositRequestBody || ""}
        onChange={(v) => setMsgs({ ...msgs, depositRequestBody: v })}
        rows={4}
      />

      <hr className="border-petflow-line" />
      <p className="text-xs font-extrabold text-petflow-chocolate">
        🧡 การ์ดขอบคุณตอนรับมัดจำ
      </p>
      <Field
        label="หัวเรื่อง"
        value={msgs?.depositThanksTitle || ""}
        onChange={(v) => setMsgs({ ...msgs, depositThanksTitle: v })}
      />
      <TextAreaField
        label="ข้อความขอบคุณ"
        hint="ใช้ได้: {name} {cat} {amount}"
        value={msgs?.depositThanksBody || ""}
        onChange={(v) => setMsgs({ ...msgs, depositThanksBody: v })}
        rows={4}
      />
      <TextAreaField
        label="เงื่อนไขมัดจำ (1 บรรทัด = 1 ข้อ)"
        value={(msgs?.depositTerms || []).join("\n")}
        onChange={(v) =>
          setMsgs({
            ...msgs,
            depositTerms: v.split("\n").map((s) => s.trim()).filter(Boolean),
          })
        }
        rows={5}
      />

      <hr className="border-petflow-line" />
      <p className="text-xs font-extrabold text-petflow-chocolate">
        📋 ข้อตกลงก่อนเข้าพัก (หน้า /app/consent)
      </p>
      <Field
        label="หัวเรื่อง"
        value={msgs?.consentTitle || ""}
        onChange={(v) => setMsgs({ ...msgs, consentTitle: v })}
      />
      <TextAreaField
        label="ข้อตกลง (1 บรรทัด = 1 ข้อ)"
        value={(msgs?.consentTerms || []).join("\n")}
        onChange={(v) =>
          setMsgs({
            ...msgs,
            consentTerms: v.split("\n").map((s) => s.trim()).filter(Boolean),
          })
        }
        rows={6}
      />
      <TextAreaField
        label="ข้อความชวนกดยอมรับเงื่อนไข (แนบลิงก์ตอนแจ้งเข้าพัก + ปุ่ม 📋 เงื่อนไข)"
        hint="ใช้ได้: {shop} {cat} {url} — ต้องมี {url} เพื่อแนบลิงก์"
        value={msgs?.consentInvite || ""}
        onChange={(v) => setMsgs({ ...msgs, consentInvite: v })}
        rows={3}
      />

      <hr className="border-petflow-line" />
      <p className="text-xs font-extrabold text-petflow-chocolate">
        🎂 อวยพรวันเกิดแมวอัตโนมัติ
      </p>
      <p className="text-[10px] text-brown-soft">
        ส่งอัตโนมัติเที่ยงวันที่ตรงกับวันเกิดน้อง (เฉพาะลูกค้าที่ยินยอมรับข่าวสาร)
      </p>
      <TextAreaField
        label="ข้อความอวยพร"
        hint="ใช้ได้: {shop} {name} {cat}"
        value={msgs?.birthdayGreeting || ""}
        onChange={(v) => setMsgs({ ...msgs, birthdayGreeting: v })}
        rows={5}
      />

      <SaveBtn saving={saving} />
    </form>
  );
}

function RoomsTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [rooms, setRooms] = useState(config.rooms);
  useEffect(() => setRooms(config.rooms), [config.rooms]);

  const updateRoom = (idx: number, patch: Partial<RoomType>) => {
    const next = [...rooms];
    next[idx] = { ...next[idx], ...patch };
    setRooms(next);
  };

  const onImage = (idx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = () => updateRoom(idx, { image: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {rooms.map((room, idx) => (
        <div key={room.id} className="rounded-petflow border border-petflow-line bg-card p-4">
          <p className="mb-2 font-bold text-brown">{room.name}</p>
          <div className="mb-3 flex gap-3">
            {room.image.startsWith("data:") || room.image.startsWith("http") ? (
              <Image
                src={room.image}
                alt=""
                width={80}
                height={100}
                className="h-[100px] w-[80px] rounded-petflow-sm object-contain bg-paper"
                unoptimized
              />
            ) : (
              <div className="flex h-[100px] w-[80px] items-center justify-center rounded-petflow-sm bg-paper text-xs text-brown-faint">
                ไม่มีรูป
              </div>
            )}
            <div className="flex-1 space-y-2">
              <Field
                label="ราคา/คืน (บาท)"
                type="number"
                value={String(room.price)}
                onChange={(v) => updateRoom(idx, { price: Number(v) })}
              />
              <Field
                label="URL รูปโปสเตอร์"
                value={room.image.startsWith("data:") ? "" : room.image}
                onChange={(v) => updateRoom(idx, { image: v })}
                placeholder="/catalog/rooms/xxx.jpg หรือ https://..."
              />
              <label className="block text-[10px] font-bold text-latte-deep">
                อัปโหลดรูป
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-[10px]"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImage(idx, f);
                  }}
                />
              </label>
            </div>
          </div>
          <Field
            label="โน้ต (ไทย)"
            value={room.note?.th || ""}
            onChange={(v) =>
              updateRoom(idx, { note: { th: v, en: room.note?.en || v } })
            }
          />
        </div>
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={() => onSave({ rooms })}
        className="w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-petflow-chocolate disabled:opacity-50"
      >
        {saving ? "กำลังบันทึก…" : "💾 บันทึกห้องทั้งหมด"}
      </button>
    </div>
  );
}

function GroomingTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const menus = config.grooming.menus as {
    bath?: { poster?: string };
    advance?: { poster?: string };
  };
  const [slotRows, setSlotRows] = useState(() =>
    config.groomSlots.map((time) => ({
      time,
      capacity: config.groomSlotCapacity?.[time] ?? config.groomSlotDefaultCapacity ?? 1,
    }))
  );
  const [defaultCapacity, setDefaultCapacity] = useState(config.groomSlotDefaultCapacity ?? 1);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>(config.closedWeekdays ?? []);
  const [closedDates, setClosedDates] = useState<{ date: string; note?: string }[]>(
    config.closedDates ?? []
  );
  const [bathPoster, setBathPoster] = useState(menus.bath?.poster || "");
  const [advancePoster, setAdvancePoster] = useState(menus.advance?.poster || "");
  const [transportTh, setTransportTh] = useState(config.transport.th.join("\n"));
  const [transportEn, setTransportEn] = useState(config.transport.en.join("\n"));

  const onPoster = (which: "bath" | "advance", file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      if (which === "bath") setBathPoster(url);
      else setAdvancePoster(url);
    };
    reader.readAsDataURL(file);
  };

  const submit = () => {
    const grooming = JSON.parse(JSON.stringify(config.grooming)) as SiteConfig["grooming"];
    const m = grooming.menus as { bath?: { poster?: string }; advance?: { poster?: string } };
    if (m.bath) m.bath.poster = bathPoster;
    if (m.advance) m.advance.poster = advancePoster;
    const cleanRows = slotRows.filter((r) => r.time.trim());
    onSave({
      groomSlots: cleanRows.map((r) => r.time.trim()),
      groomSlotCapacity: Object.fromEntries(
        cleanRows.map((r) => [r.time.trim(), Math.max(1, r.capacity || 1)])
      ),
      groomSlotDefaultCapacity: Math.max(1, defaultCapacity || 1),
      closedWeekdays,
      closedDates: closedDates.filter((d) => d.date.trim()),
      transport: {
        th: transportTh.split("\n").filter(Boolean),
        en: transportEn.split("\n").filter(Boolean),
      },
      grooming,
    });
  };

  return (
    <div className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm">
      <div>
        <p className="mb-1 text-xs font-extrabold text-petflow-chocolate">
          🕒 รอบเวลาอาบน้ำ + จำนวนคิวที่รับต่อรอบ
        </p>
        <p className="mb-2 text-[10px] text-brown-faint">
          ใช้กับหน้า “จองคิวเอง” ของลูกค้า — สล็อตที่เต็มแล้วลูกค้าจะเลือกไม่ได้
        </p>
        <div className="space-y-2">
          {slotRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                value={row.time}
                onChange={(e) => {
                  const next = [...slotRows];
                  next[i] = { ...next[i], time: e.target.value };
                  setSlotRows(next);
                }}
                className="rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={1}
                value={row.capacity}
                onChange={(e) => {
                  const next = [...slotRows];
                  next[i] = { ...next[i], capacity: Number(e.target.value) || 1 };
                  setSlotRows(next);
                }}
                className="w-16 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-sm"
              />
              <span className="text-[10px] text-brown-faint">คิว/รอบ</span>
              <button
                type="button"
                onClick={() => setSlotRows(slotRows.filter((_, k) => k !== i))}
                className="ml-auto shrink-0 px-2 text-wait"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSlotRows([...slotRows, { time: "10:00", capacity: defaultCapacity }])}
            className="w-full rounded-petflow-sm border border-dashed border-petflow-line py-2 text-xs font-bold text-latte-deep"
          >
            + เพิ่มรอบเวลา
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] font-bold text-brown-soft">
          จำนวนคิวเริ่มต้น (ใช้ตอนเพิ่มรอบใหม่)
          <input
            type="number"
            min={1}
            value={defaultCapacity}
            onChange={(e) => setDefaultCapacity(Number(e.target.value) || 1)}
            className="w-16 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-sm font-normal"
          />
        </label>
      </div>

      <div>
        <p className="mb-1 text-xs font-extrabold text-petflow-chocolate">🚫 วันที่ร้านปิด</p>
        <p className="mb-2 text-[10px] text-brown-faint">
          มีผลกับ “จองคิวเอง” ทั้งอาบน้ำและห้องพัก — ลูกค้าจองวันนี้ไม่ได้ (แมวที่เข้าพักอยู่แล้วไม่กระทบ)
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, idx) => {
            const active = closedWeekdays.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setClosedWeekdays(
                    active ? closedWeekdays.filter((d) => d !== idx) : [...closedWeekdays, idx]
                  )
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-wait bg-wait/15 text-wait"
                    : "border-petflow-line bg-paper text-brown-soft"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {closedDates.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="date"
                value={row.date}
                onChange={(e) => {
                  const next = [...closedDates];
                  next[i] = { ...next[i], date: e.target.value };
                  setClosedDates(next);
                }}
                className="rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="หมายเหตุ (ไม่บังคับ) เช่น ปิดปีใหม่"
                value={row.note || ""}
                onChange={(e) => {
                  const next = [...closedDates];
                  next[i] = { ...next[i], note: e.target.value };
                  setClosedDates(next);
                }}
                className="flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setClosedDates(closedDates.filter((_, k) => k !== i))}
                className="shrink-0 px-2 text-wait"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setClosedDates([...closedDates, { date: "", note: "" }])}
            className="w-full rounded-petflow-sm border border-dashed border-petflow-line py-2 text-xs font-bold text-latte-deep"
          >
            + เพิ่มวันหยุด
          </button>
        </div>
      </div>

      <PosterField
        label="รูปเมนูอาบน้ำ"
        value={bathPoster}
        onChange={setBathPoster}
        onUpload={(f) => onPoster("bath", f)}
      />
      <PosterField
        label="รูปเมนู Advance"
        value={advancePoster}
        onChange={setAdvancePoster}
        onUpload={(f) => onPoster("advance", f)}
      />

      <label className="block text-xs font-bold text-brown-soft">
        รับส่ง (ไทย) — หนึ่งบรรทัดต่อข้อ
        <textarea value={transportTh} onChange={(e) => setTransportTh(e.target.value)} rows={4} className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm" />
      </label>
      <label className="block text-xs font-bold text-brown-soft">
        รับส่ง (EN)
        <textarea value={transportEn} onChange={(e) => setTransportEn(e.target.value)} rows={4} className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm" />
      </label>
      <p className="text-[10px] text-brown-faint">
        หน้าลูกค้าจะแสดงรูป 2 รูปนี้เต็มๆ — ไม่มีตารางราคา
      </p>
      <button type="button" disabled={saving} onClick={submit} className="w-full rounded-petflow-sm bg-honey/40 py-3 text-sm font-extrabold disabled:opacity-50">
        {saving ? "กำลังบันทึก…" : "💾 บันทึกอาบน้ำ/กรูมมิ่ง"}
      </button>
    </div>
  );
}

function PointsTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [rewards, setRewards] = useState(config.pointsRewards);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  useEffect(() => setRewards(config.pointsRewards), [config.pointsRewards]);

  const onRewardImage = async (i: number, id: string, file: File) => {
    setUploadingId(id);
    try {
      const dataUrl = await toJpegDataUrl(file);
      setRewards((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], imageUrl: dataUrl };
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {rewards.map((r, i) => (
        <div key={r.id} className="rounded-petflow border border-petflow-line bg-card p-3 space-y-2">
          <p className="text-xs font-bold text-brown-faint">{r.id}</p>
          <div className="flex gap-3">
            {r.imageUrl ? (
              <Image
                src={r.imageUrl}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-petflow-sm object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-petflow-sm bg-paper text-2xl">
                🎁
              </div>
            )}
            <label className="flex-1 text-[10px] font-bold text-latte-deep">
              รูปของรางวัล (ไม่บังคับ)
              <input
                type="file"
                accept="image/*"
                disabled={uploadingId === r.id}
                className="mt-1 block w-full text-[10px]"
                onChange={(e) => e.target.files?.[0] && onRewardImage(i, r.id, e.target.files[0])}
              />
              {r.imageUrl && (
                <button
                  type="button"
                  onClick={() => {
                    const next = [...rewards];
                    next[i] = { ...next[i], imageUrl: undefined };
                    setRewards(next);
                  }}
                  className="mt-1 text-wait"
                >
                  ลบรูป
                </button>
              )}
            </label>
          </div>
          <Field
            label="แต้มที่ใช้"
            type="number"
            value={String(r.points)}
            onChange={(v) => {
              const next = [...rewards];
              next[i] = { ...r, points: Number(v) };
              setRewards(next);
            }}
          />
          <Field
            label="มูลค่าส่วนลด (บาท) — ตั้งไว้ = แลกแต้มแล้วได้คูปองใช้จริง"
            type="number"
            value={String(r.discount ?? "")}
            onChange={(v) => {
              const next = [...rewards];
              next[i] = { ...r, discount: v ? Number(v) : undefined };
              setRewards(next);
            }}
          />
          <Field
            label="รางวัล (ไทย)"
            value={r.reward.th}
            onChange={(v) => {
              const next = [...rewards];
              next[i] = { ...r, reward: { ...r.reward, th: v } };
              setRewards(next);
            }}
          />
          <Field
            label="รางวัล (EN)"
            value={r.reward.en}
            onChange={(v) => {
              const next = [...rewards];
              next[i] = { ...r, reward: { ...r.reward, en: v } };
              setRewards(next);
            }}
          />
        </div>
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={() => onSave({ pointsRewards: rewards })}
        className="w-full rounded-petflow-sm bg-honey/40 py-3 text-sm font-extrabold disabled:opacity-50"
      >
        💾 บันทึกรางวัลแต้ม
      </button>
    </div>
  );
}

function CrmTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [form, setForm] = useState(config.crm);
  const [presetsText, setPresetsText] = useState(config.crm.tierPresets.join(", "));
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalcMsg, setRecalcMsg] = useState("");

  useEffect(() => {
    setForm(config.crm);
    setPresetsText(config.crm.tierPresets.join(", "));
  }, [config.crm]);

  const rules = form.tierRules || {
    regularMinVisits: 1,
    vipMinVisits: 5,
    vipMinSpend: 0,
  };
  const setRule = (patch: Partial<typeof rules>) =>
    setForm({ ...form, tierRules: { ...rules, ...patch } });

  const recalcAll = async () => {
    setRecalcBusy(true);
    setRecalcMsg("");
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalc_all_tiers" }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setRecalcMsg(`✅ คำนวณใหม่ ${d.total} คน · เปลี่ยนระดับ ${d.updated} คน`);
      } else {
        setRecalcMsg("❌ คำนวณไม่สำเร็จ");
      }
    } finally {
      setRecalcBusy(false);
    }
  };

  return (
    <form
      className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          crm: {
            ...form,
            tierPresets: presetsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          },
        });
      }}
    >
      <p className="text-xs text-brown-soft">
        ตั้งค่าตรวจจับลูกค้าที่หายไป + ข้อความตามทาง LINE · ใช้ใน Admin และ Telegram Bot
      </p>
      <Field
        label="ถือว่าหายไป (วัน)"
        type="number"
        value={String(form.inactiveDays)}
        onChange={(v) => setForm({ ...form, inactiveDays: Math.max(1, Number(v) || 60) })}
      />
      <Field
        label="ไม่ส่งซ้ำภายใน (วัน)"
        type="number"
        value={String(form.followUpCooldownDays)}
        onChange={(v) =>
          setForm({ ...form, followUpCooldownDays: Math.max(1, Number(v) || 30) })
        }
      />
      <label className="block text-xs font-bold text-brown-soft">
        ข้อความตามลูกค้า — ใช้ {"{name}"} {"{days}"} {"{cats}"}
        <textarea
          value={form.followUpMessage}
          onChange={(e) => setForm({ ...form, followUpMessage: e.target.value })}
          rows={5}
          className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
        />
      </label>
      <Field
        label="Tier ที่ตั้งได้ (คั่นด้วย ,)"
        value={presetsText}
        onChange={setPresetsText}
      />

      <hr className="border-petflow-line" />
      <p className="text-xs font-extrabold text-petflow-chocolate">
        ⭐ เงื่อนไขเลื่อนระดับลูกค้าอัตโนมัติ
      </p>
      <p className="text-[10px] text-brown-faint">
        ระบบจะเลื่อนระดับให้เองเมื่อลูกค้ามาใช้บริการครบ หรือยอดสะสมถึงเกณฑ์
        (Member = ลูกค้าที่เติมเครดิต)
      </p>
      <Field
        label="ลูกค้าประจำ — มาใช้บริการ (ครั้ง) ขึ้นไป"
        type="number"
        value={String(rules.regularMinVisits)}
        onChange={(v) => setRule({ regularMinVisits: Math.max(0, Number(v) || 0) })}
      />
      <Field
        label="VIP — มาใช้บริการ (ครั้ง) ขึ้นไป"
        type="number"
        value={String(rules.vipMinVisits)}
        onChange={(v) => setRule({ vipMinVisits: Math.max(0, Number(v) || 0) })}
      />
      <Field
        label="VIP — หรือยอดสะสมรวม (บาท) ขึ้นไป · 0 = ปิด"
        type="number"
        value={String(rules.vipMinSpend)}
        onChange={(v) => setRule({ vipMinSpend: Math.max(0, Number(v) || 0) })}
      />

      <SaveBtn saving={saving} />

      <hr className="border-petflow-line" />
      <button
        type="button"
        onClick={recalcAll}
        disabled={recalcBusy}
        className="w-full rounded-petflow-sm bg-latte/25 py-2.5 text-xs font-extrabold text-petflow-chocolate disabled:opacity-50"
      >
        {recalcBusy ? "กำลังคำนวณ…" : "🔄 คำนวณระดับลูกค้าใหม่ทั้งหมด (หลังแก้เงื่อนไข)"}
      </button>
      {recalcMsg && (
        <p className="text-center text-[11px] font-bold text-ok">{recalcMsg}</p>
      )}
      <p className="text-[10px] text-brown-faint">
        Cron อัตโนมัติ: GET /api/cron/inactive-followup (ตั้งใน Vercel Cron)
      </p>
    </form>
  );
}

function AdvancedTab({
  jsonText,
  setJsonText,
  saving,
  onSaveJson,
  onExport,
}: {
  jsonText: string;
  setJsonText: (s: string) => void;
  saving: boolean;
  onSaveJson: () => void;
  onExport: () => void;
}) {
  return (
    <div className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm">
      <MigrateSection />
      <MigratePhotosSection />
      <ExportSheetsButton />
      <p className="text-[10px] text-brown-faint">
        ส่งออก 5 แท็บ: ลูกค้า+น้องแมว · การจอง · บิล · รายรับรายจ่าย · แต้มสะสม
        ไป Google Sheet เดียว (ต้องตั้ง GOOGLE_SPREADSHEET_ID) · ระบบทำให้อัตโนมัติทุกคืนอยู่แล้ว
      </p>

      {/* สำรองแบบครบทุกฟิลด์ — เอาไว้กู้คืนจริง ต่างจาก Sheets ที่ยุบข้อมูลให้อ่านง่าย */}
      <a
        href="/api/admin/backup"
        download
        className="block w-full rounded-petflow-sm bg-latte/20 py-2.5 text-center text-xs font-extrabold text-latte-deep"
      >
        💾 ดาวน์โหลดสำรองข้อมูลทั้งหมด (.json)
      </a>
      <p className="text-[10px] text-brown-faint">
        ไฟล์เดียวครบทุกอย่าง ลูกค้า แมว นัด บิล บัญชี แต้ม โปร คูปอง คอร์ส
        บทความ พนักงาน ประวัติเติมเครดิต ประวัติใช้บริการ และการตั้งค่า —
        เก็บไว้กู้คืนได้จริง ⚠️ มีข้อมูลส่วนตัวลูกค้าและรหัสพนักงาน เก็บในที่ปลอดภัย
      </p>
      <p className="text-xs text-brown-soft">
        แก้ตารางราคากรูมมิ่ง หรือสำรอง/กู้คืน config ทั้งหมด (สำหรับผู้ดูแลระบบ)
      </p>
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        rows={16}
        className="w-full rounded-petflow-sm border border-petflow-line bg-paper p-3 font-mono text-[10px]"
      />
      <div className="flex gap-2">
        <button type="button" onClick={onExport} className="flex-1 rounded-petflow-sm bg-paper py-2 text-xs font-bold">
          📋 Copy
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSaveJson}
          className="flex-1 rounded-petflow-sm bg-latte/30 py-2 text-xs font-bold disabled:opacity-50"
        >
          {saving ? "…" : "📥 นำเข้า JSON"}
        </button>
      </div>
    </div>
  );
}

function MigratePhotosSection() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const run = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/migrate-photos", { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setMsg(`❌ ${d.error || "ทำไม่สำเร็จ"}`);
      } else {
        const total = d.photos + d.media + d.signatures;
        setMsg(
          total === 0
            ? "✅ ไม่มีรูปเก่าที่ต้องย้ายแล้ว (เก็บเป็นไฟล์หมดแล้ว)"
            : `✅ ย้ายแล้ว — รูปโปรไฟล์ ${d.photos}, อัลบั้ม ${d.media}, ลายเซ็น ${d.signatures}` +
              (d.errors?.length ? ` (พลาด ${d.errors.length} รายการ)` : "")
        );
      }
    } catch {
      setMsg("❌ เชื่อมต่อไม่สำเร็จ");
    }
    setBusy(false);
  };

  return (
    <div className="rounded-petflow-sm border border-sage/40 bg-sage/10 p-3">
      <p className="text-xs font-extrabold text-petflow-chocolate">
        🖼️ ย้ายรูป/วิดีโอเก่าไป Storage
      </p>
      <p className="mb-2 text-[10px] text-brown-soft">
        รูปโปรไฟล์แมว, อัลบั้มหลังบ้าน, ลายเซ็นยินยอม ที่เคยเก็บเป็น base64 ยัดในฐานข้อมูลตรงๆ
        (กินพื้นที่เปลือง) — ย้ายไปเก็บเป็นไฟล์แทน ประหยัดพื้นที่กว่าเดิม กดซ้ำได้ปลอดภัย
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="w-full rounded-petflow-sm bg-sage/70 py-2 text-xs font-extrabold text-petflow-chocolate disabled:opacity-50"
      >
        {busy ? "กำลังย้าย… (อาจใช้เวลาสักครู่)" : "🖼️ ย้ายรูปเก่าตอนนี้"}
      </button>
      {msg && <p className="mt-2 text-[11px] font-bold text-brown">{msg}</p>}
    </div>
  );
}

function MigrateSection() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [bootSql, setBootSql] = useState("");

  const run = async () => {
    setBusy(true);
    setMsg("");
    setBootSql("");
    try {
      const res = await fetch("/api/admin/migrate", { method: "POST" });
      const d = await res.json();
      if (d.bootstrapNeeded) {
        setBootSql(d.bootstrapSql || "");
        setMsg(
          "⚠️ ต้องตั้งค่าครั้งแรกก่อน (ครั้งเดียว) — ก๊อป SQL ด้านล่างไปวางใน Supabase → SQL Editor → Run แล้วกดปุ่มนี้อีกครั้ง"
        );
      } else if (d.ok) {
        setMsg(
          d.applied.length > 0
            ? `✅ อัปเดตฐานข้อมูลเรียบร้อย (${d.applied.length} รายการ) — ทุกฟีเจอร์พร้อมใช้แล้ว`
            : "✅ ฐานข้อมูลเป็นเวอร์ชันล่าสุดอยู่แล้ว"
        );
      } else {
        setMsg(
          "❌ บางรายการไม่สำเร็จ: " +
            (d.errors || []).map((e: { name: string }) => e.name).join(", ")
        );
      }
    } catch {
      setMsg("❌ เชื่อมต่อไม่สำเร็จ");
    }
    setBusy(false);
  };

  return (
    <div className="rounded-petflow-sm border border-honey/50 bg-honey/10 p-3">
      <p className="text-xs font-extrabold text-petflow-chocolate">
        🗄️ อัปเดตฐานข้อมูล (อัตโนมัติ)
      </p>
      <p className="mb-2 text-[10px] text-brown-soft">
        เพิ่มคอลัมน์/ตารางที่ฟีเจอร์ใหม่ต้องใช้ให้เอง — ไม่ต้องไปพิมพ์ SQL ใน Supabase อีก
        (ปลอดภัย กดซ้ำได้)
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="w-full rounded-petflow-sm bg-honey-deep/80 py-2 text-xs font-extrabold text-petflow-chocolate disabled:opacity-50"
      >
        {busy ? "กำลังอัปเดต…" : "🔄 อัปเดตฐานข้อมูลตอนนี้"}
      </button>
      {msg && (
        <p className="mt-2 text-[11px] font-bold text-brown">{msg}</p>
      )}
      {bootSql && (
        <div className="mt-2">
          <textarea
            readOnly
            value={bootSql}
            rows={10}
            className="w-full rounded-petflow-sm border border-petflow-line bg-paper p-2 font-mono text-[9px]"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(bootSql)}
            className="mt-1 w-full rounded-petflow-sm bg-paper py-1.5 text-[10px] font-bold text-brown-soft"
          >
            📋 คัดลอก SQL (วางใน Supabase ครั้งเดียว)
          </button>
        </div>
      )}
    </div>
  );
}

function PosterField({
  label,
  value,
  onChange,
  onUpload,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onUpload: (f: File) => void;
}) {
  const hasImage = value.startsWith("data:") || value.startsWith("http") || value.startsWith("/");

  return (
    <div className="rounded-petflow-sm border border-petflow-line bg-paper p-3">
      <p className="mb-2 text-xs font-bold text-brown-soft">{label}</p>
      <div className="flex gap-3">
        {hasImage ? (
          <Image
            src={value}
            alt=""
            width={72}
            height={96}
            className="h-24 w-[72px] shrink-0 rounded-petflow-sm object-cover bg-card"
            unoptimized
          />
        ) : (
          <div className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-petflow-sm bg-card text-[9px] text-brown-faint">
            ยังไม่มี
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
                if (f) onUpload(f);
              }}
            />
          </label>
          <input
            value={value.startsWith("data:") ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="หรือวาง URL"
            className="w-full rounded-petflow-sm border border-petflow-line bg-card px-2 py-1.5 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[10px] font-bold text-brown-soft">
      {label}
      <div className="mt-1 flex items-center gap-1.5 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : "#000000"}
          onChange={(e) => onChange(e.target.value.trim())}
          className="h-6 w-6 shrink-0 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          className="min-w-0 flex-1 bg-transparent text-xs font-mono outline-none"
        />
      </div>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  hint,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm leading-relaxed"
      />
      {hint && (
        <span className="mt-0.5 block font-normal text-[10px] text-brown-faint">
          {hint}
        </span>
      )}
    </label>
  );
}

const AUTOMATION_DEFAULT = {
  confirmTomorrowEnabled: true,
  confirmDaysBefore: 1,
  depositReminderEnabled: true,
  depositReminderDays: 7,
  prestayReminderEnabled: true,
  prestayReminderDays: 3,
  checkinReminderEnabled: true,
  checkinReminderDays: 1,
  checkoutReminderEnabled: true,
  checkoutReminderDays: 1,
  reviewRequestEnabled: true,
  reviewRequestDaysAfter: 1,
  groomInfoEnabled: true,
  freeLitterMinNights: 3,
  birthdayEnabled: true,
  birthdayCouponEnabled: true,
  birthdayCouponAmount: 100,
  bookingApprovedEnabled: true,
};

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-2 py-1 text-left"
    >
      <span className="text-xs font-bold text-brown">{label}</span>
      <span
        className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition ${
          checked ? "bg-sage justify-end" : "bg-paper justify-start"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-card shadow-petflow-sm" />
      </span>
    </button>
  );
}

function AutomationTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [form, setForm] = useState({ ...AUTOMATION_DEFAULT, ...config.automation });
  useEffect(
    () => setForm({ ...AUTOMATION_DEFAULT, ...config.automation }),
    [config.automation]
  );
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <form
      className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ automation: form });
      }}
    >
      <p className="text-[11px] text-brown-soft">
        ระบบส่งอัตโนมัติ เที่ยงวัน (เวลาไทย) ทุกวัน — เปิด/ปิด และตั้งจำนวนวันได้เอง
      </p>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="🎉 แจ้งลูกค้าทันทีที่ร้านกดยืนยันคิว"
          checked={form.bookingApprovedEnabled}
          onChange={(v) => set({ bookingApprovedEnabled: v })}
        />
        <p className="mt-1 text-[10px] text-brown-faint">
          ส่งทันทีตอนกดปุ่ม “✔️ ยืนยันนัด” — คนละอันกับการ์ดเตือนล่วงหน้าด้านล่างที่ส่งใกล้ถึงวันจริง
        </p>
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="✅ ส่งการ์ดยืนยันนัดอัตโนมัติ (เตือนล่วงหน้า)"
          checked={form.confirmTomorrowEnabled}
          onChange={(v) => set({ confirmTomorrowEnabled: v })}
        />
        {form.confirmTomorrowEnabled && (
          <Field
            label="ส่งล่วงหน้า (วัน) — 1 = พรุ่งนี้"
            type="number"
            value={String(form.confirmDaysBefore)}
            onChange={(v) => set({ confirmDaysBefore: Math.max(1, Number(v) || 1) })}
          />
        )}
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="💰 เตือนยอดคงเหลือก่อนเข้าพัก"
          checked={form.depositReminderEnabled}
          onChange={(v) => set({ depositReminderEnabled: v })}
        />
        {form.depositReminderEnabled && (
          <Field
            label="ส่งก่อนเข้าพัก (วัน)"
            type="number"
            value={String(form.depositReminderDays)}
            onChange={(v) => set({ depositReminderDays: Math.max(0, Number(v) || 0) })}
          />
        )}
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="🏠 แจ้งเข้าพัก + เงื่อนไข ก่อนเข้าพัก"
          checked={form.prestayReminderEnabled}
          onChange={(v) => set({ prestayReminderEnabled: v })}
        />
        {form.prestayReminderEnabled && (
          <Field
            label="ส่งก่อนเข้าพัก (วัน)"
            type="number"
            value={String(form.prestayReminderDays)}
            onChange={(v) => set({ prestayReminderDays: Math.max(0, Number(v) || 0) })}
          />
        )}
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="🧳 เตือนเช็คอิน ก่อนวันเข้าพัก"
          checked={form.checkinReminderEnabled}
          onChange={(v) => set({ checkinReminderEnabled: v })}
        />
        {form.checkinReminderEnabled && (
          <Field
            label="ส่งก่อนเข้าพัก (วัน)"
            type="number"
            value={String(form.checkinReminderDays)}
            onChange={(v) => set({ checkinReminderDays: Math.max(0, Number(v) || 0) })}
          />
        )}
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="🧳 เตือนเช็คเอาท์ ก่อนวันออก"
          checked={form.checkoutReminderEnabled}
          onChange={(v) => set({ checkoutReminderEnabled: v })}
        />
        {form.checkoutReminderEnabled && (
          <Field
            label="ส่งก่อนเช็คเอาท์ (วัน)"
            type="number"
            value={String(form.checkoutReminderDays)}
            onChange={(v) => set({ checkoutReminderDays: Math.max(0, Number(v) || 0) })}
          />
        )}
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="⭐ ขอรีวิวอัตโนมัติ หลังเช็คเอาท์ (ห้องพัก)"
          checked={form.reviewRequestEnabled}
          onChange={(v) => set({ reviewRequestEnabled: v })}
        />
        {form.reviewRequestEnabled && (
          <Field
            label="ส่งหลังเช็คเอาท์ (วัน)"
            type="number"
            value={String(form.reviewRequestDaysAfter)}
            onChange={(v) => set({ reviewRequestDaysAfter: Math.max(0, Number(v) || 0) })}
          />
        )}
        <p className="mt-1 text-[10px] text-brown-soft">
          แยกคำขอรีวิวออกจากใบเสร็จ — ลูกค้าที่จ่ายล่วงหน้าก่อนเข้าพักจะไม่ถูกขอรีวิวตอนจ่ายเงิน
        </p>
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Field
          label="🐈 แถมทรายฟรีเมื่อเข้าพัก (คืน) ขึ้นไป"
          type="number"
          value={String(form.freeLitterMinNights)}
          onChange={(v) => set({ freeLitterMinNights: Math.max(1, Number(v) || 1) })}
        />
        <p className="mt-1 text-[10px] text-brown-soft">
          ถ้าเข้าพักน้อยกว่านี้ การ์ดเตือนเตรียมตัวจะบอกให้ลูกค้าเตรียมทรายมาเอง
          (ใส่ {"{litterNote}"} ในข้อความ)
        </p>
      </div>

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="🩺 สอบถามประวัติน้องก่อนอาบน้ำ (พ่วงกับยืนยันนัด)"
          checked={form.groomInfoEnabled}
          onChange={(v) => set({ groomInfoEnabled: v })}
        />
        <p className="mt-1 text-[10px] text-brown-soft">
          นัดอาบน้ำ: หลังส่งการ์ดยืนยันนัด จะส่งการ์ดให้ลูกค้ากรอกประวัติน้อง (โรค/นิสัย/แพ้) ต่อทันที
        </p>
      </div>

      <Toggle
        label="🎂 อวยพรวันเกิดแมวอัตโนมัติ"
        checked={form.birthdayEnabled}
        onChange={(v) => set({ birthdayEnabled: v })}
      />

      <div className="rounded-petflow-sm border border-petflow-line p-3">
        <Toggle
          label="🎁 แจกคูปองวันเกิดอัตโนมัติ (แมว/เจ้าของ)"
          checked={form.birthdayCouponEnabled}
          onChange={(v) => set({ birthdayCouponEnabled: v })}
        />
        {form.birthdayCouponEnabled && (
          <Field
            label="มูลค่าคูปองวันเกิด (บาท)"
            type="number"
            value={String(form.birthdayCouponAmount)}
            onChange={(v) => set({ birthdayCouponAmount: Math.max(0, Number(v) || 0) })}
          />
        )}
        <p className="mt-1 text-[10px] text-brown-soft">
          วันเกิดน้อง/เจ้าของ ระบบจะแถมคูปองเข้ากระเป๋าให้เอง (ครั้งเดียวต่อปี · ใช้ได้ 30 วัน) พร้อมข้อความอวยพร
        </p>
      </div>

      <SaveBtn saving={saving} />
    </form>
  );
}

const OPTIONS_DEFAULT = {
  servicePresets: [] as { label: string; amount: number }[],
  freebies: [] as string[],
  catBreeds: [] as string[],
  referralOptions: [] as string[],
};

function ListsTab({
  config,
  saving,
  onSave,
}: {
  config: SiteConfig;
  saving: boolean;
  onSave: (p: Partial<SiteConfig>) => void;
}) {
  const [form, setForm] = useState({ ...OPTIONS_DEFAULT, ...config.options });
  useEffect(() => setForm({ ...OPTIONS_DEFAULT, ...config.options }), [config.options]);
  const presets = form.servicePresets;

  const setPreset = (i: number, patch: Partial<{ label: string; amount: number }>) =>
    setForm((f) => ({
      ...f,
      servicePresets: f.servicePresets.map((p, k) => (k === i ? { ...p, ...patch } : p)),
    }));

  return (
    <form
      className="space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          options: {
            ...form,
            servicePresets: form.servicePresets.filter((p) => p.label.trim()),
          },
        });
      }}
    >
      <p className="text-xs font-extrabold text-petflow-chocolate">
        ✨ บริการเสริม (หน้าคิดเงิน) — ชื่อ + ราคา
      </p>
      <div className="space-y-2">
        {presets.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={p.label}
              onChange={(e) => setPreset(i, { label: e.target.value })}
              placeholder="ชื่อบริการ"
              className="min-w-0 flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={String(p.amount)}
              onChange={(e) => setPreset(i, { amount: Number(e.target.value) || 0 })}
              className="w-20 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-2 text-right text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  servicePresets: f.servicePresets.filter((_, k) => k !== i),
                }))
              }
              className="shrink-0 px-2 text-wait"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setForm((f) => ({
              ...f,
              servicePresets: [...f.servicePresets, { label: "", amount: 0 }],
            }))
          }
          className="w-full rounded-petflow-sm border border-dashed border-petflow-line py-2 text-xs font-bold text-latte-deep"
        >
          + เพิ่มบริการ
        </button>
      </div>

      <hr className="border-petflow-line" />
      <TextAreaField
        label="🎁 ของแถม (ฟรี) — 1 บรรทัด = 1 อย่าง"
        value={form.freebies.join("\n")}
        onChange={(v) =>
          setForm((f) => ({ ...f, freebies: v.split("\n").map((s) => s.trim()).filter(Boolean) }))
        }
        rows={4}
      />
      <TextAreaField
        label="🐱 สายพันธุ์แมว (หน้าลงทะเบียน) — 1 บรรทัด = 1 พันธุ์"
        value={form.catBreeds.join("\n")}
        onChange={(v) =>
          setForm((f) => ({ ...f, catBreeds: v.split("\n").map((s) => s.trim()).filter(Boolean) }))
        }
        rows={8}
      />
      <TextAreaField
        label="📣 รู้จักร้านจากไหน (referral) — 1 บรรทัด = 1 ตัวเลือก"
        value={form.referralOptions.join("\n")}
        onChange={(v) =>
          setForm((f) => ({
            ...f,
            referralOptions: v.split("\n").map((s) => s.trim()).filter(Boolean),
          }))
        }
        rows={5}
      />

      <SaveBtn saving={saving} />
    </form>
  );
}

function SaveBtn({ saving }: { saving: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-petflow-chocolate disabled:opacity-50"
    >
      {saving ? "กำลังบันทึก…" : "💾 บันทึก"}
    </button>
  );
}
