"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";

type Preview = {
  id: string;
  name: string;
  phone?: string;
  cats: { id: string; name: string }[];
  hasLine: boolean;
};

export function LinkLineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId") || "";
  const { profile, ready, refreshCustomer, error: liffError } = useLiff();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      setError("ลิงก์ไม่ถูกต้อง");
      return;
    }
    fetch(`/api/customers/link?customerId=${encodeURIComponent(customerId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.customer) setPreview(d.customer);
        else setError(d.error || "ไม่พบลูกค้า");
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [customerId]);

  const link = async () => {
    if (!profile?.lineUserId || !customerId) return;
    setLinking(true);
    setError("");

    const res = await fetch("/api/customers/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        lineUserId: profile.lineUserId,
        displayName: profile.displayName,
      }),
    });
    const data = await res.json();
    setLinking(false);

    if (!res.ok) {
      setError(data.error || "ผูกไม่สำเร็จ");
      return;
    }

    await refreshCustomer();
    setDone(true);
    setTimeout(() => router.replace("/app"), 1500);
  };

  if (!ready || loading) {
    return (
      <p className="px-4 py-10 text-center text-sm text-brown-soft">
        กำลังเชื่อมต่อ LINE…
      </p>
    );
  }

  if (!customerId || (!preview && error)) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-bold text-wait">{error || "ลิงก์ไม่ถูกต้อง"}</p>
      </div>
    );
  }

  if (preview?.hasLine) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 text-sm font-extrabold text-petflow-chocolate">
          ลูกค้ารายนี้ผูก LINE แล้ว
        </p>
        <button
          type="button"
          onClick={() => router.replace("/app")}
          className="mt-4 rounded-petflow-sm bg-latte/25 px-4 py-2 text-xs font-bold text-petflow-chocolate"
        >
          ไปหน้าแรก
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-2xl">🎉</p>
        <p className="mt-2 text-sm font-extrabold text-ok">ผูก LINE สำเร็จ!</p>
        <p className="mt-1 text-xs text-brown-soft">กำลังพาไปหน้าแรก…</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      <div className="mb-5 rounded-petflow bg-latte/15 p-4 text-center">
        <p className="text-2xl">🔗</p>
        <h1 className="mt-2 text-lg font-extrabold text-petflow-chocolate">
          ผูกบัญชี LINE
        </h1>
        <p className="mt-1 text-xs text-brown-soft">
          ร้านบันทึกข้อมูลไว้แล้ว — กดยืนยันเพื่อเชื่อมกับ LINE ของคุณ
        </p>
      </div>

      {preview && (
        <div className="mb-5 rounded-petflow-sm border border-petflow-line bg-card p-4 text-sm">
          <p className="font-extrabold text-petflow-chocolate">{preview.name}</p>
          {preview.phone && (
            <p className="mt-1 text-xs text-brown-soft">📞 {preview.phone}</p>
          )}
          <p className="mt-2 text-xs text-brown-soft">
            🐱 {preview.cats.map((c) => c.name).join(", ") || "—"}
          </p>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-petflow-sm bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </p>
      )}

      {/* ปุ่มด้านล่างจะกดไม่ได้เงียบๆ ถ้า LIFF ดึงโปรไฟล์ LINE ไม่สำเร็จ (profile.lineUserId ว่าง)
          — ต้องโชว์สาเหตุตรงนี้ ไม่งั้นดูเหมือนปุ่มพังโดยไม่รู้ว่าทำไม */}
      {!profile?.lineUserId && (
        <p className="mb-3 rounded-petflow-sm bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          ⚠️ ดึงโปรไฟล์ LINE ไม่สำเร็จ — กดปุ่มด้านล่างไม่ได้จนกว่าจะแก้
          {liffError ? ` (${liffError})` : ""}
          <br />
          มักเกิดจาก LIFF app ยังไม่ได้ติ๊ก Scope “profile” — เช็คที่ LINE Developers → Channel
          → LIFF → เลือกแอปนี้ → Scopes → ติ๊ก profile (และ openid ถ้ามี) → Update
        </p>
      )}

      <button
        type="button"
        disabled={linking || !profile?.lineUserId}
        onClick={link}
        className="w-full rounded-petflow-sm bg-gradient-to-r from-sage to-[#4A7348] py-3.5 text-sm font-extrabold text-white disabled:opacity-60"
      >
        {linking ? "กำลังผูก…" : "✅ ยืนยันผูก LINE กับบัญชีนี้"}
      </button>

      <p className="mt-3 text-center text-[10px] text-brown-faint">
        ชื่อ LINE: {profile?.displayName}
      </p>
    </div>
  );
}
