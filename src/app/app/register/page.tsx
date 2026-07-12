"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { BirthdayPicker } from "@/components/BirthdayPicker";

type CatGender = "male" | "female";
type CatInput = {
  name: string;
  gender?: CatGender;
  breed: string;
  breedOther: string;
  ageValue: string;
  ageUnit: "year" | "month";
  birthday: string;
  medical: string;
  note: string;
};

const REFERRAL_OPTIONS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Google / ค้นหา",
  "Google Maps",
  "เพื่อนแนะนำ / ผ่านหน้าร้าน",
];

import { BREED_OPTIONS, OTHER_BREED } from "@/lib/cat-breeds";

function emptyCat(): CatInput {
  return {
    name: "",
    breed: "",
    breedOther: "",
    ageValue: "",
    ageUnit: "year",
    birthday: "",
    medical: "",
    note: "",
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const { profile, ready, customer, refreshCustomer, refreshAccount } = useLiff();
  const { config } = useConfig();
  const breeds = config.options?.catBreeds?.length ? config.options.catBreeds : BREED_OPTIONS;
  const referrals = config.options?.referralOptions?.length
    ? config.options.referralOptions
    : REFERRAL_OPTIONS;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [referral, setReferral] = useState("");
  const [consent, setConsent] = useState(true);
  const [cats, setCats] = useState<CatInput[]>([emptyCat()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customer) return;
    // ชื่อผู้ปกครอง: เว้นว่างให้กรอกเอง (ไม่ดึงชื่อ LINE มาใส่)
    // เบอร์เดิมช่วยเติมให้ ถ้าเคยมีในระบบ
    setPhone((prev) => prev || customer.phone || "");
  }, [customer]);

  const addCat = () => setCats((prev) => [...prev, emptyCat()]);

  const updateCat = (idx: number, patch: Partial<CatInput>) => {
    setCats((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeCat = (idx: number) => {
    if (cats.length <= 1) return;
    setCats((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.lineUserId) return;

    const named = cats.filter((c) => c.name.trim());
    if (named.some((c) => !c.gender)) {
      setError("เลือกเพศน้องแมวทุกตัวด้วยนะคะ 🐱");
      return;
    }

    setSaving(true);
    setError("");

    const res = await fetch("/api/customers/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: profile.lineUserId,
        name,
        phone,
        email,
        birthday,
        referralSource: referral,
        marketingConsent: consent,
        cats: cats
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name,
            gender: c.gender,
            breed:
              (c.breed === OTHER_BREED ? c.breedOther.trim() : c.breed) ||
              undefined,
            ageValue: c.ageValue ? Number(c.ageValue) : undefined,
            ageUnit: c.ageUnit,
            birthday: c.birthday || undefined,
            medical: c.medical || undefined,
            staffNote: c.note || undefined,
          })),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || "ลงทะเบียนไม่สำเร็จ");
      return;
    }

    await refreshCustomer();
    await refreshAccount();
    router.replace("/app");
  };

  if (!ready) {
    return (
      <p className="px-4 py-10 text-center text-sm text-brown-soft">
        กำลังเชื่อมต่อ LINE…
      </p>
    );
  }

  const fieldClass =
    "w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2.5 text-sm";
  const subFieldClass =
    "w-full rounded-lg border border-catcha-line bg-paper px-3 py-2 text-sm";

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 rounded-catcha bg-sage/20 p-4 text-center">
        <p className="text-2xl">🐾</p>
        <h1 className="mt-2 font-extrabold leading-tight text-catcha-chocolate">
          <span className="block text-2xl">สมัครสมาชิก</span>
          <span className="mt-0.5 block text-sm text-latte-deep">
            เพื่อรับสิทธิพิเศษ
          </span>
        </h1>
        <p className="mt-1 text-xs text-brown-soft">
          กรอกข้อมูลครั้งเดียว — ใช้ยืนยันนัด แต้มสะสม และโปรโมชั่น
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* ── ข้อมูลผู้ปกครอง ── */}
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brown">
            ชื่อผู้ปกครอง{" "}
            <span className="font-normal text-brown-faint">
              (ชื่อเล่นหรือชื่อจริงก็ได้นะคะ)
            </span>
          </span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น คุณมาย"
            className={fieldClass}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brown">เบอร์โทร</span>
          <input
            required
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08x-xxx-xxxx"
            className={fieldClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brown">อีเมล</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-brown">
              วันเกิดผู้ปกครอง
            </span>
            <BirthdayPicker
              required
              value={birthday}
              onChange={setBirthday}
              yearsBack={90}
            />
          </label>
        </div>

        {/* ── น้องแมว ── */}
        <div>
          <div className="mb-2">
            <span className="text-xs font-bold text-brown">น้องแมว</span>
          </div>
          <ul className="space-y-3">
            {cats.map((cat, idx) => (
              <li
                key={idx}
                className="space-y-2 rounded-catcha-sm border border-catcha-line bg-card p-3"
              >
                <input
                  required={idx === 0}
                  value={cat.name}
                  onChange={(e) => updateCat(idx, { name: e.target.value })}
                  placeholder="ชื่อน้องแมว"
                  className={subFieldClass}
                />

                <div className="flex gap-2">
                  {(
                    [
                      ["male", "♂ ผู้"],
                      ["female", "♀ เมีย"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        updateCat(idx, {
                          gender: cat.gender === value ? undefined : value,
                        })
                      }
                      className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                        cat.gender === value
                          ? "bg-latte/40 text-catcha-chocolate ring-1 ring-latte-deep"
                          : "bg-paper text-brown-faint"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <select
                  required={idx === 0}
                  value={cat.breed}
                  onChange={(e) => updateCat(idx, { breed: e.target.value })}
                  className={`${subFieldClass} ${
                    cat.breed ? "text-brown" : "text-brown-faint"
                  }`}
                >
                  <option value="">เลือกสายพันธุ์…</option>
                  {breeds.map((b) => (
                    <option key={b} value={b} className="text-brown">
                      {b}
                    </option>
                  ))}
                  <option value={OTHER_BREED} className="text-brown">
                    {OTHER_BREED}
                  </option>
                </select>
                {cat.breed === OTHER_BREED && (
                  <input
                    required
                    value={cat.breedOther}
                    onChange={(e) => updateCat(idx, { breedOther: e.target.value })}
                    placeholder="ระบุสายพันธุ์"
                    className={subFieldClass}
                  />
                )}
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cat.ageValue}
                    onChange={(e) => updateCat(idx, { ageValue: e.target.value })}
                    placeholder="อายุ"
                    className="min-w-0 flex-1 rounded-lg border border-catcha-line bg-paper px-3 py-2 text-sm"
                  />
                  <select
                    value={cat.ageUnit}
                    onChange={(e) =>
                      updateCat(idx, {
                        ageUnit: e.target.value as "year" | "month",
                      })
                    }
                    className="w-24 shrink-0 rounded-lg border border-catcha-line bg-paper px-3 py-2 text-sm"
                  >
                    <option value="year">ปี</option>
                    <option value="month">เดือน</option>
                  </select>
                </div>
                <div className="text-[10px] font-bold text-brown-soft">
                  วันเกิดน้องแมว{" "}
                  <span className="font-normal text-brown-faint">
                    (ถ้าทราบ · ไม่บังคับ)
                  </span>
                  <div className="mt-0.5">
                    <BirthdayPicker
                      value={cat.birthday}
                      onChange={(iso) => updateCat(idx, { birthday: iso })}
                      yearsBack={25}
                    />
                  </div>
                </div>

                <input
                  value={cat.medical}
                  onChange={(e) => updateCat(idx, { medical: e.target.value })}
                  placeholder="โรคประจำตัว (ถ้ามี)"
                  className={subFieldClass}
                />
                <input
                  value={cat.note}
                  onChange={(e) => updateCat(idx, { note: e.target.value })}
                  placeholder="🐾 รายละเอียดเพิ่มเติม (ถ้ามี)"
                  className={`${subFieldClass} text-xs`}
                />

                {cats.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCat(idx)}
                    className="text-[10px] font-bold text-brown-faint"
                  >
                    ลบน้องแมวตัวนี้
                  </button>
                )}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={addCat}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-catcha-sm border-2 border-dashed border-latte/60 bg-latte/10 py-3 text-sm font-extrabold text-latte-deep transition active:scale-[.98]"
          >
            <span className="text-lg">🐱</span> เพิ่มน้องแมวอีกตัว
            <span className="text-lg">🐾</span>
          </button>
        </div>

        {/* ── รู้จักเราจากทางไหน ── */}
        <div>
          <span className="mb-2 block text-xs font-bold text-brown">
            รู้จักเราจากทางไหน?{" "}
            <span className="font-normal text-brown-faint">(ไม่บังคับ)</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {referrals.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setReferral((prev) => (prev === opt ? "" : opt))}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                  referral === opt
                    ? "bg-latte/40 text-catcha-chocolate ring-1 ring-latte-deep"
                    : "bg-paper text-brown-faint"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* ── ยินยอมรับข่าวสาร ── */}
        <label className="flex items-start gap-3 rounded-catcha-sm border border-catcha-line bg-card p-3">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-none accent-[#4A7348]"
          />
          <span className="text-xs text-brown">
            ยินยอมให้ส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษ
            <span className="mt-0.5 block text-[10px] text-brown-faint">
              ถ้าไม่ยินยอม จะไม่ได้รับโปร/ข่าวสาร แต่ยังได้รับการยืนยันนัดและแจ้งชำระเงินตามปกติ
            </span>
          </span>
        </label>

        {error && (
          <p className="rounded-catcha-sm bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-catcha-sm bg-gradient-to-r from-sage to-[#4A7348] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {saving ? "กำลังบันทึก…" : "✅ บันทึกข้อมูล"}
        </button>
      </form>
    </div>
  );
}
