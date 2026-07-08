"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { TIER_LABELS } from "@/lib/customer-tier";

type CatInput = { name: string; note: string };

export default function RegisterPage() {
  const router = useRouter();
  const { profile, ready, customer, refreshCustomer, refreshAccount } = useLiff();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cats, setCats] = useState<CatInput[]>([{ name: "", note: "" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!customer) return;
    setName((prev) => prev || customer.name || "");
    setPhone((prev) => prev || customer.phone || "");
    if (customer.cats.length > 0) {
      setCats((prev) => {
        if (prev.some((c) => c.name.trim())) return prev;
        return customer.cats.map((c) => ({ name: c.name, note: "" }));
      });
    }
  }, [customer]);

  const addCat = () => setCats((prev) => [...prev, { name: "", note: "" }]);

  const updateCat = (idx: number, patch: Partial<CatInput>) => {
    setCats((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  };

  const removeCat = (idx: number) => {
    if (cats.length <= 1) return;
    setCats((prev) => prev.filter((_, i) => i !== idx));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.lineUserId) return;

    setSaving(true);
    setError("");

    const res = await fetch("/api/customers/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: profile.lineUserId,
        name,
        phone,
        cats: cats
          .filter((c) => c.name.trim())
          .map((c) => ({ name: c.name, staffNote: c.note || undefined })),
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

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 rounded-catcha bg-sage/20 p-4 text-center">
        <p className="text-2xl">🐾</p>
        <h1 className="mt-2 text-lg font-extrabold text-catcha-chocolate">
          ลงทะเบียนลูกค้า
        </h1>
        <p className="mt-1 text-xs text-brown-soft">
          กรอกข้อมูลครั้งเดียว — ใช้ยืนยันนัด แต้มสะสม และโปรโมชั่น
        </p>
        {customer?.tier && (
          <p className="mt-2 text-[10px] font-bold text-ok">
            ระดับปัจจุบัน: {TIER_LABELS[customer.tier]}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-brown">ชื่อที่ใช้เรียก</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น คุณมาย"
            className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2.5 text-sm"
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
            className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2.5 text-sm"
          />
        </label>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-brown">น้องแมว</span>
            <button
              type="button"
              onClick={addCat}
              className="text-xs font-bold text-latte-deep"
            >
              + เพิ่มแมว
            </button>
          </div>
          <ul className="space-y-2">
            {cats.map((cat, idx) => (
              <li
                key={idx}
                className="rounded-catcha-sm border border-catcha-line bg-card p-3"
              >
                <input
                  required={idx === 0}
                  value={cat.name}
                  onChange={(e) => updateCat(idx, { name: e.target.value })}
                  placeholder="ชื่อน้องแมว"
                  className="mb-2 w-full rounded-lg border border-catcha-line bg-paper px-3 py-2 text-sm"
                />
                <input
                  value={cat.note}
                  onChange={(e) => updateCat(idx, { note: e.target.value })}
                  placeholder="หมายเหตุ (อาหารแพ้ / นิสัย)"
                  className="w-full rounded-lg border border-catcha-line bg-paper px-3 py-2 text-xs"
                />
                {cats.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCat(idx)}
                    className="mt-2 text-[10px] font-bold text-brown-faint"
                  >
                    ลบ
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

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
