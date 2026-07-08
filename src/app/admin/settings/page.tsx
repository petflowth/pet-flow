"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SiteConfig } from "@/lib/config-types";
import type { RoomType } from "@/lib/business";
import { adminJson } from "@/lib/admin-fetch";

type Tab = "shop" | "payment" | "rooms" | "grooming" | "points" | "advanced";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "shop", label: "ร้าน", icon: "🏪" },
  { id: "payment", label: "บัญชี", icon: "🏦" },
  { id: "rooms", label: "ห้อง", icon: "🛏️" },
  { id: "grooming", label: "อาบน้ำ", icon: "🛁" },
  { id: "points", label: "แต้ม", icon: "🎁" },
  { id: "advanced", label: "ขั้นสูง", icon: "⚙️" },
];

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
          className="mt-4 rounded-catcha-sm bg-honey/40 px-4 py-2 text-xs font-bold"
        >
          🔄 ลองใหม่
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-extrabold text-catcha-chocolate">⚙️ ตั้งค่าระบบ</h1>
      <p className="mb-4 text-xs text-brown-soft">
        แก้รูป ราคา โปร ข้อมูลร้าน — ไม่ต้องแก้โค้ด · v{config.version}
      </p>

      {msg && (
        <p className="mb-3 rounded-catcha-sm bg-sage/15 px-3 py-2 text-xs font-bold text-ok">
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
              tab === t.id ? "bg-honey/45 text-catcha-chocolate" : "bg-paper text-brown-soft"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <Link
        href="/admin/promos"
        className="mb-4 block rounded-catcha-sm border border-catcha-line bg-card px-4 py-3 text-xs font-bold text-latte-deep"
      >
        ✨ จัดการโปรโมชั่น (แยกหน้า) →
      </Link>

      {tab === "shop" && (
        <ShopTab config={config} saving={saving} onSave={save} />
      )}
      {tab === "payment" && (
        <PaymentTab config={config} saving={saving} onSave={save} />
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

  useEffect(() => {
    setForm(config.business);
  }, [config.business]);

  return (
    <form
      className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ business: form });
      }}
    >
      <Field label="ชื่อร้าน" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Field label="LINE OA" value={form.lineOa} onChange={(v) => setForm({ ...form, lineOa: v })} />
      <Field
        label="เบอร์โทร (คั่นด้วย ,)"
        value={form.phones.join(", ")}
        onChange={(v) => setForm({ ...form, phones: v.split(",").map((s) => s.trim()) })}
      />
      <Field label="Google Maps URL" value={form.maps} onChange={(v) => setForm({ ...form, maps: v })} />
      <Field label="Facebook" value={form.facebook} onChange={(v) => setForm({ ...form, facebook: v })} />
      <Field label="ที่อยู่ (ไทย)" value={form.location.th} onChange={(v) => setForm({ ...form, location: { ...form.location, th: v } })} />
      <Field label="ที่อยู่ (EN)" value={form.location.en} onChange={(v) => setForm({ ...form, location: { ...form.location, en: v } })} />
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
      className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ payment: form });
      }}
    >
      <Field label="ธนาคาร" value={form.bankName} onChange={(v) => setForm({ ...form, bankName: v })} />
      <Field label="เลขบัญชี" value={form.accountNumber} onChange={(v) => setForm({ ...form, accountNumber: v })} />
      <Field label="ชื่อบัญชี" value={form.accountName} onChange={(v) => setForm({ ...form, accountName: v })} />
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
        <div key={room.id} className="rounded-catcha border border-catcha-line bg-card p-4">
          <p className="mb-2 font-bold text-brown">{room.name}</p>
          <div className="mb-3 flex gap-3">
            {room.image.startsWith("data:") || room.image.startsWith("http") ? (
              <Image
                src={room.image}
                alt=""
                width={80}
                height={100}
                className="h-[100px] w-[80px] rounded-catcha-sm object-contain bg-paper"
                unoptimized
              />
            ) : (
              <div className="flex h-[100px] w-[80px] items-center justify-center rounded-catcha-sm bg-paper text-xs text-brown-faint">
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
        className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-50"
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
  const [slots, setSlots] = useState(config.groomSlots.join(", "));
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
    onSave({
      groomSlots: slots.split(",").map((s) => s.trim()).filter(Boolean),
      transport: {
        th: transportTh.split("\n").filter(Boolean),
        en: transportEn.split("\n").filter(Boolean),
      },
      grooming,
    });
  };

  return (
    <div className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <Field label="รอบเวลาแนะนำ (คั่นด้วย ,)" value={slots} onChange={setSlots} />

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
        <textarea value={transportTh} onChange={(e) => setTransportTh(e.target.value)} rows={4} className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
      </label>
      <label className="block text-xs font-bold text-brown-soft">
        รับส่ง (EN)
        <textarea value={transportEn} onChange={(e) => setTransportEn(e.target.value)} rows={4} className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm" />
      </label>
      <p className="text-[10px] text-brown-faint">
        หน้าลูกค้าจะแสดงรูป 2 รูปนี้เต็มๆ — ไม่มีตารางราคา
      </p>
      <button type="button" disabled={saving} onClick={submit} className="w-full rounded-catcha-sm bg-honey/40 py-3 text-sm font-extrabold disabled:opacity-50">
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
  useEffect(() => setRewards(config.pointsRewards), [config.pointsRewards]);

  return (
    <div className="space-y-3">
      {rewards.map((r, i) => (
        <div key={r.id} className="rounded-catcha border border-catcha-line bg-card p-3 space-y-2">
          <p className="text-xs font-bold text-brown-faint">{r.id}</p>
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
        className="w-full rounded-catcha-sm bg-honey/40 py-3 text-sm font-extrabold disabled:opacity-50"
      >
        💾 บันทึกรางวัลแต้ม
      </button>
    </div>
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
    <div className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <p className="text-xs text-brown-soft">
        แก้ตารางราคากรูมมิ่ง หรือสำรอง/กู้คืน config ทั้งหมด (สำหรับผู้ดูแลระบบ)
      </p>
      <textarea
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        rows={16}
        className="w-full rounded-catcha-sm border border-catcha-line bg-paper p-3 font-mono text-[10px]"
      />
      <div className="flex gap-2">
        <button type="button" onClick={onExport} className="flex-1 rounded-catcha-sm bg-paper py-2 text-xs font-bold">
          📋 Copy
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSaveJson}
          className="flex-1 rounded-catcha-sm bg-latte/30 py-2 text-xs font-bold disabled:opacity-50"
        >
          {saving ? "…" : "📥 นำเข้า JSON"}
        </button>
      </div>
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
    <div className="rounded-catcha-sm border border-catcha-line bg-paper p-3">
      <p className="mb-2 text-xs font-bold text-brown-soft">{label}</p>
      <div className="flex gap-3">
        {hasImage ? (
          <Image
            src={value}
            alt=""
            width={72}
            height={96}
            className="h-24 w-[72px] shrink-0 rounded-catcha-sm object-cover bg-card"
            unoptimized
          />
        ) : (
          <div className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-catcha-sm bg-card text-[9px] text-brown-faint">
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
            className="w-full rounded-catcha-sm border border-catcha-line bg-card px-2 py-1.5 text-xs"
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
        className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
      />
    </label>
  );
}

function SaveBtn({ saving }: { saving: boolean }) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-50"
    >
      {saving ? "กำลังบันทึก…" : "💾 บันทึก"}
    </button>
  );
}
