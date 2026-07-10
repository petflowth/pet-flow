"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SiteConfig } from "@/lib/config-types";
import type { RoomType } from "@/lib/business";
import { adminJson } from "@/lib/admin-fetch";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";

type Tab =
  | "shop"
  | "payment"
  | "messages"
  | "rooms"
  | "grooming"
  | "points"
  | "crm"
  | "advanced";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "shop", label: "ร้าน", icon: "🏪" },
  { id: "payment", label: "บัญชี", icon: "🏦" },
  { id: "messages", label: "ข้อความ", icon: "💬" },
  { id: "rooms", label: "ห้อง", icon: "🛏️" },
  { id: "grooming", label: "อาบน้ำ", icon: "🛁" },
  { id: "points", label: "แต้ม", icon: "🎁" },
  { id: "crm", label: "ลูกค้า", icon: "👥" },
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
      {tab === "messages" && (
        <MessagesTab config={config} saving={saving} onSave={save} />
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
      <p className="rounded-catcha-sm bg-paper px-3 py-2 text-[11px] text-brown-faint">
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
      className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ billing: bill, messages: msgs, crm });
      }}
    >
      <p className="text-xs font-extrabold text-catcha-chocolate">
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

      <hr className="border-catcha-line" />
      <p className="text-xs font-extrabold text-catcha-chocolate">
        ⏰ เตือนอัตโนมัติก่อนเข้าพัก
      </p>
      <TextAreaField
        label="เตือนยอดคงเหลือ (7 วันก่อนเข้าพัก)"
        hint="ใช้ได้: {shop} {cat} {checkin} {deposit} {remaining} {bank} {accountNumber} {accountName}"
        value={msgs?.depositReminder || ""}
        onChange={(v) => setMsgs({ ...msgs, depositReminder: v })}
        rows={7}
      />
      <TextAreaField
        label="แจ้งรายละเอียด (3 วันก่อนเข้าพัก)"
        hint="ใช้ได้: {shop} {cat} {checkin} {checkout} {room}"
        value={msgs?.prestayReminder || ""}
        onChange={(v) => setMsgs({ ...msgs, prestayReminder: v })}
        rows={8}
      />

      <hr className="border-catcha-line" />
      <p className="text-xs font-extrabold text-catcha-chocolate">
        💛 ตามลูกค้าที่หายไป
      </p>
      <TextAreaField
        label="ข้อความตามลูกค้า"
        hint="ใช้ได้: {name} {cats} {days}"
        value={crm?.followUpMessage || ""}
        onChange={(v) => setCrm({ ...crm, followUpMessage: v })}
        rows={3}
      />

      <hr className="border-catcha-line" />
      <p className="text-xs font-extrabold text-catcha-chocolate">
        📨 การ์ดเรียกเก็บมัดจำ (ส่งก่อนลูกค้าโอน)
      </p>
      <Field
        label="หัวเรื่อง"
        value={msgs?.depositRequestTitle || ""}
        onChange={(v) => setMsgs({ ...msgs, depositRequestTitle: v })}
      />
      <TextAreaField
        label="ข้อความ"
        hint="ใช้ได้: {name} {cat} {amount}"
        value={msgs?.depositRequestBody || ""}
        onChange={(v) => setMsgs({ ...msgs, depositRequestBody: v })}
        rows={3}
      />

      <hr className="border-catcha-line" />
      <p className="text-xs font-extrabold text-catcha-chocolate">
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

      <hr className="border-catcha-line" />
      <p className="text-xs font-extrabold text-catcha-chocolate">
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

  useEffect(() => {
    setForm(config.crm);
    setPresetsText(config.crm.tierPresets.join(", "));
  }, [config.crm]);

  return (
    <form
      className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm"
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
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
        />
      </label>
      <Field
        label="Tier ที่ตั้งได้ (คั่นด้วย ,)"
        value={presetsText}
        onChange={setPresetsText}
      />
      <p className="text-[10px] text-brown-faint">
        Cron อัตโนมัติ: GET /api/cron/inactive-followup (ตั้งใน Vercel Cron)
      </p>
      <SaveBtn saving={saving} />
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
    <div className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <MigrateSection />
      <ExportSheetsButton />
      <p className="text-[10px] text-brown-faint">
        ส่งออกแท็บ ลูกค้า + รายรับรายจ่าย ไป Google Sheet เดียว (ต้องตั้ง GOOGLE_SPREADSHEET_ID)
      </p>
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
    <div className="rounded-catcha-sm border border-honey/50 bg-honey/10 p-3">
      <p className="text-xs font-extrabold text-catcha-chocolate">
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
        className="w-full rounded-catcha-sm bg-honey-deep/80 py-2 text-xs font-extrabold text-catcha-chocolate disabled:opacity-50"
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
            className="w-full rounded-catcha-sm border border-catcha-line bg-paper p-2 font-mono text-[9px]"
          />
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(bootSql)}
            className="mt-1 w-full rounded-catcha-sm bg-paper py-1.5 text-[10px] font-bold text-brown-soft"
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
        className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm leading-relaxed"
      />
      {hint && (
        <span className="mt-0.5 block font-normal text-[10px] text-brown-faint">
          {hint}
        </span>
      )}
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
