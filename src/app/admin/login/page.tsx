"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    // ตรวจรหัสที่เซิร์ฟเวอร์เสมอ แล้วรับคุกกี้ที่เซ็นชื่อกลับมา
    // (เมื่อก่อนเทียบรหัสในเบราว์เซอร์ = รหัสจริงติดไปกับไฟล์ JS ให้ใครก็เปิดดูได้)
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        // เก็บไว้แค่ให้หน้าจอรู้ว่าจะโชว์เมนูไหน — สิทธิ์จริงอยู่ที่คุกกี้ฝั่งเซิร์ฟเวอร์
        sessionStorage.setItem("catcha-role", data.role);
        sessionStorage.setItem("catcha-staff-name", data.name || "พนักงาน");
        const next = params.get("next");
        if (data.role === "staff") {
          sessionStorage.setItem("catcha-menus", JSON.stringify(data.menus || []));
          router.push(next || (data.menus || [])[0] || "/admin");
        } else {
          sessionStorage.removeItem("catcha-menus");
          router.push(next || "/admin");
        }
      } else {
        setErr(data.error || "รหัสไม่ถูกต้อง");
      }
    } catch {
      setErr("เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-catcha-gradient px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-catcha border border-catcha-line bg-card p-8 shadow-catcha"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={64} />
          <h1 className="mt-4 text-lg font-extrabold text-catcha-chocolate">
            CatCha Admin
          </h1>
          <p className="mt-1 text-xs text-brown-soft">เข้าสู่ระบบเจ้าของ / พนักงาน</p>
        </div>
        <label className="mb-2 block text-xs font-bold text-brown-soft">
          รหัสผ่าน
        </label>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mb-4 w-full rounded-catcha-sm border border-catcha-line bg-paper px-4 py-3 text-sm outline-none focus:border-latte-deep"
          placeholder="••••••••"
        />
        {err && <p className="mb-3 text-xs font-semibold text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-catcha-sm bg-gradient-to-r from-latte-deep to-catcha-chocolate py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "กำลังตรวจสอบ…" : "เข้าใช้งาน 🐾"}
        </button>
        <p className="mt-4 text-center text-[10px] text-brown-faint">
          พนักงานใช้รหัสที่เจ้าของสร้างให้ (ตั้งค่า → ขั้นสูง → พนักงาน)
        </p>
      </form>
    </div>
  );
}
