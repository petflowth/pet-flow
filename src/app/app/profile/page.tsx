"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/components/LiffProvider";

export default function ProfilePage() {
  const { ready, profile, customer, needsRegistration, refreshCustomer } = useLiff();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [catNames, setCatNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setName(customer.name || "");
    setPhone(customer.phone || "");
    setCatNames(
      Object.fromEntries((customer.cats || []).map((c) => [c.id, c.name]))
    );
  }, [customer]);

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
          cats: Object.entries(catNames).map(([id, n]) => ({ id, name: n })),
        }),
      });
      if (res.ok) {
        setSaved(true);
        await refreshCustomer();
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pb-10 pt-5">
      <Link href="/app" className="mb-3 inline-block text-xs font-bold text-brown-soft">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-lg font-extrabold text-catcha-chocolate">
        ✏️ แก้ไขข้อมูลของฉัน
      </h1>

      {!ready ? (
        <p className="mt-6 text-sm text-brown-soft">กำลังโหลด…</p>
      ) : needsRegistration || !customer ? (
        <div className="mt-6 rounded-catcha bg-paper px-4 py-4 text-center text-sm text-brown-soft">
          ยังไม่มีข้อมูลของคุณในระบบ
          <Link
            href="/app/register"
            className="mt-3 block rounded-catcha-sm bg-latte-deep py-2.5 text-sm font-extrabold text-card"
          >
            ลงทะเบียนก่อนค่ะ
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
            <label className="block text-xs font-bold text-brown-soft">
              ชื่อผู้ปกครอง
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ชื่อของคุณ"
                className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm font-bold text-brown"
              />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              เบอร์โทร
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08x-xxx-xxxx"
                inputMode="tel"
                className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
              />
            </label>
          </div>

          {(customer.cats || []).length > 0 && (
            <div className="mt-4 space-y-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
              <p className="text-xs font-extrabold text-catcha-chocolate">🐱 น้องแมวของฉัน</p>
              {customer.cats.map((c) => (
                <label key={c.id} className="block text-xs font-bold text-brown-soft">
                  ชื่อน้อง
                  <input
                    value={catNames[c.id] ?? ""}
                    onChange={(e) =>
                      setCatNames((prev) => ({ ...prev, [c.id]: e.target.value }))
                    }
                    className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm font-bold text-brown"
                  />
                </label>
              ))}
              <p className="text-[10px] text-brown-faint">
                อยากเพิ่มน้องใหม่ หรือแก้ประวัติเพิ่มเติม ทักแชทบอกเราได้เลยนะคะ 🧡
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="mt-4 w-full rounded-catcha-sm bg-latte-deep py-3 text-sm font-extrabold text-card active:scale-[0.98] disabled:opacity-50"
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
