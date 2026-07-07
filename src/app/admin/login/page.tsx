"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

// รหัสเริ่มต้น — เปลี่ยนใน env ตอน deploy
const DEFAULT_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || "catcha2026";

export default function AdminLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code === DEFAULT_CODE) {
      sessionStorage.setItem("catcha-admin", code);
      router.push("/admin");
    } else {
      setErr("รหัสไม่ถูกต้อง");
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
          className="w-full rounded-catcha-sm bg-gradient-to-r from-latte-deep to-catcha-chocolate py-3 text-sm font-extrabold text-white"
        >
          เข้าใช้งาน 🐾
        </button>
        <p className="mt-4 text-center text-[10px] text-brown-faint">
          รหัสเริ่มต้น: catcha2026 (เปลี่ยนได้ตอน deploy)
        </p>
      </form>
    </div>
  );
}
