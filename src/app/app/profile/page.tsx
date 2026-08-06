"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { BREED_OPTIONS, OTHER_BREED } from "@/lib/cat-breeds";
import { LoadingScreen } from "@/components/LoadingScreen";
import { StaffNoteTagPicker } from "@/components/StaffNoteTagPicker";

const REFERRAL_FALLBACK = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Google / ค้นหา",
  "Google Maps",
  "เพื่อนแนะนำ / ผ่านหน้าร้าน",
];

type CatForm = {
  id: string;
  name: string;
  gender: "" | "male" | "female";
  breed: string;
  breedOther: string;
  ageValue: string;
  ageUnit: "year" | "month";
  birthday: string;
  medical: string;
  note: string;
};

export default function ProfilePage() {
  const { ready, profile } = useLiff();
  const { config } = useConfig();
  const breeds = config.options?.catBreeds?.length ? config.options.catBreeds : BREED_OPTIONS;
  const referrals = config.options?.referralOptions?.length
    ? config.options.referralOptions
    : REFERRAL_FALLBACK;

  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [referral, setReferral] = useState("");
  const [address, setAddress] = useState("");
  const [addressMapUrl, setAddressMapUrl] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [consent, setConsent] = useState(true);
  const [cats, setCats] = useState<CatForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    fetch(`/api/customers/self?lineUserId=${profile.lineUserId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.found) return;
        setFound(true);
        const c = d.customer;
        setName(c.name || "");
        setPhone(c.phone || "");
        setEmail(c.email || "");
        setBirthday(c.birthday || "");
        setReferral(c.referralSource || "");
        setAddress(c.address || "");
        setAddressMapUrl(c.addressMapUrl || "");
        setPostalCode(c.postalCode || "");
        setConsent(c.marketingConsent !== false);
        setCats(
          (c.cats || []).map((x: Record<string, unknown>) => {
            const breedVal = String(x.breed || "");
            const known = breeds.includes(breedVal);
            return {
              id: String(x.id),
              name: String(x.name || ""),
              gender: (x.gender as CatForm["gender"]) || "",
              breed: breedVal ? (known ? breedVal : OTHER_BREED) : "",
              breedOther: breedVal && !known ? breedVal : "",
              ageValue: x.ageValue != null ? String(x.ageValue) : "",
              ageUnit: (x.ageUnit as "year" | "month") || "year",
              birthday: String(x.birthday || ""),
              medical: String(x.medical || ""),
              note: String(x.note || ""),
            };
          })
        );
      })
      .finally(() => setLoading(false));
  }, [profile?.lineUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCat = (idx: number, patch: Partial<CatForm>) =>
    setCats((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  // id ขึ้นต้นด้วย "new-" = ยังไม่บันทึกจริง — /api/customers/self ใช้แยกว่าต้องสร้างใหม่ ไม่ใช่แก้ตัวเดิม
  const addCat = () =>
    setCats((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        gender: "",
        breed: "",
        breedOther: "",
        ageValue: "",
        ageUnit: "year",
        birthday: "",
        medical: "",
        note: "",
      },
    ]);

  const removeCat = (idx: number) =>
    setCats((prev) => prev.filter((_, i) => i !== idx));

  const save = async () => {
    if (!profile?.lineUserId || !name.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/customers/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.lineUserId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          birthday,
          referralSource: referral,
          address,
          addressMapUrl,
          postalCode,
          marketingConsent: consent,
          cats: cats.map((c) => ({
            id: c.id,
            name: c.name,
            gender: c.gender || undefined,
            breed:
              (c.breed === OTHER_BREED ? c.breedOther.trim() : c.breed) || undefined,
            ageValue: c.ageValue,
            ageUnit: c.ageUnit,
            birthday: c.birthday || undefined,
            medical: c.medical || undefined,
            note: c.note || undefined,
          })),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const field = "w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2.5 text-sm";
  const sub = "w-full rounded-lg border border-petflow-line bg-paper px-3 py-2 text-sm";

  return (
    <div className="px-4 pb-10 pt-5">
      <Link href="/app" className="mb-3 inline-block text-xs font-bold text-brown-soft">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-lg font-extrabold text-petflow-chocolate">
        ✏️ แก้ไขข้อมูลของฉัน
      </h1>

      {!ready || loading ? (
        <LoadingScreen />
      ) : !found ? (
        <div className="mt-6 rounded-petflow bg-paper px-4 py-4 text-center text-sm text-brown-soft">
          ยังไม่มีข้อมูลของคุณในระบบ
          <Link
            href="/app/register"
            className="mt-3 block rounded-petflow-sm bg-latte-deep py-2.5 text-sm font-extrabold text-card"
          >
            ลงทะเบียนก่อนค่ะ
          </Link>
        </div>
      ) : (
        <>
          {/* ── ผู้ปกครอง ── */}
          <div className="mt-4 space-y-3 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
            <label className="block text-xs font-bold text-brown-soft">
              ชื่อผู้ปกครอง
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1 font-bold text-brown`} />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              เบอร์โทร
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08x-xxx-xxxx" className={`${field} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-brown-soft">
                อีเมล
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" className={`${field} mt-1`} />
              </label>
              <label className="block text-xs font-bold text-brown-soft">
                วันเกิด
                <input value={birthday} onChange={(e) => setBirthday(e.target.value)} type="date" className={`${field} mt-1`} />
              </label>
            </div>
            <label className="block text-xs font-bold text-brown-soft">
              📍 ที่อยู่บ้าน{" "}
              <span className="font-normal text-brown-faint">(ไว้ใช้บริการรับ-ส่ง)</span>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="เช่น บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ"
                rows={2}
                className={`${field} mt-1`}
              />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              ลิงก์ Google Maps
              <input
                value={addressMapUrl}
                onChange={(e) => setAddressMapUrl(e.target.value)}
                placeholder="เปิด Maps แล้วกดแชร์ลิงก์มาวางตรงนี้"
                className={`${field} mt-1`}
              />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              รหัสไปรษณีย์
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="เช่น 10260"
                className={`${field} mt-1`}
              />
            </label>
          </div>

          {/* ── น้องแมว ── */}
          <div className="mt-4 space-y-3">
            <p className="text-xs font-extrabold text-petflow-chocolate">🐱 น้องแมวของฉัน</p>
            {cats.map((cat, idx) => (
              <div key={cat.id} className="space-y-2 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
                <div className="flex items-center justify-between gap-2">
                  <label className="block flex-1 text-xs font-bold text-brown-soft">
                    ชื่อน้อง
                    <input value={cat.name} onChange={(e) => updateCat(idx, { name: e.target.value })} className={`${sub} mt-1 font-bold text-brown`} />
                  </label>
                  {cat.id.startsWith("new-") && (
                    <button
                      type="button"
                      onClick={() => removeCat(idx)}
                      className="shrink-0 pl-1 text-[10px] font-bold text-wait"
                    >
                      ✕ ลบ
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  {([["male", "♂ ผู้"], ["female", "♀ เมีย"]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateCat(idx, { gender: cat.gender === v ? "" : v })}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold ${cat.gender === v ? "bg-latte/40 text-petflow-chocolate ring-1 ring-latte-deep" : "bg-paper text-brown-faint"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <select
                  value={cat.breed}
                  onChange={(e) => updateCat(idx, { breed: e.target.value })}
                  className={`${sub} ${cat.breed ? "text-brown" : "text-brown-faint"}`}
                >
                  <option value="">เลือกสายพันธุ์…</option>
                  {breeds.map((b) => (
                    <option key={b} value={b} className="text-brown">{b}</option>
                  ))}
                  <option value={OTHER_BREED} className="text-brown">{OTHER_BREED}</option>
                </select>
                {cat.breed === OTHER_BREED && (
                  <input value={cat.breedOther} onChange={(e) => updateCat(idx, { breedOther: e.target.value })} placeholder="ระบุสายพันธุ์" className={sub} />
                )}
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cat.ageValue}
                    onChange={(e) => updateCat(idx, { ageValue: e.target.value })}
                    placeholder="อายุ"
                    className="min-w-0 flex-1 rounded-lg border border-petflow-line bg-paper px-3 py-2 text-sm"
                  />
                  <select
                    value={cat.ageUnit}
                    onChange={(e) => updateCat(idx, { ageUnit: e.target.value as "year" | "month" })}
                    className="w-24 shrink-0 rounded-lg border border-petflow-line bg-paper px-3 py-2 text-sm"
                  >
                    <option value="year">ปี</option>
                    <option value="month">เดือน</option>
                  </select>
                </div>
                <label className="block text-[10px] font-bold text-brown-soft">
                  วันเกิดน้อง <span className="font-normal text-brown-faint">(ถ้าทราบ)</span>
                  <input type="date" value={cat.birthday} onChange={(e) => updateCat(idx, { birthday: e.target.value })} className={`${sub} mt-0.5`} />
                </label>
                <StaffNoteTagPicker
                  medicalValue={cat.medical}
                  noteValue={cat.note}
                  onChange={(medical, note) => updateCat(idx, { medical, note })}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addCat}
              className="w-full rounded-petflow-sm border border-dashed border-petflow-line bg-paper py-2.5 text-xs font-extrabold text-latte-deep"
            >
              ➕ เพิ่มน้องแมว
            </button>
          </div>

          {/* ── รู้จักเราจากทางไหน ── */}
          <div className="mt-4">
            <span className="mb-2 block text-xs font-bold text-brown-soft">รู้จักเราจากทางไหน?</span>
            <div className="flex flex-wrap gap-2">
              {referrals.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setReferral((p) => (p === opt ? "" : opt))}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${referral === opt ? "bg-latte/40 text-petflow-chocolate ring-1 ring-latte-deep" : "bg-paper text-brown-faint"}`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* ── ยินยอมรับข่าวสาร ── */}
          <label className="mt-4 flex items-start gap-3 rounded-petflow-sm border border-petflow-line bg-card p-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-latte-deep" />
            <span className="text-xs text-brown">ยินยอมให้ส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษ</span>
          </label>

          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="mt-4 w-full rounded-petflow-sm bg-latte-deep py-3 text-sm font-extrabold text-card active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : "💾 บันทึกข้อมูล"}
          </button>
          {saved && (
            <p className="mt-2 text-center text-sm font-extrabold text-ok">
              ✅ บันทึกเรียบร้อยแล้วค่ะ 🧡
            </p>
          )}
        </>
      )}
    </div>
  );
}
