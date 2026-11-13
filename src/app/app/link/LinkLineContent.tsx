"use client";

import { savedPopup } from "@/components/Toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, BTN_SECONDARY, PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useTr } from "@/components/LocaleProvider";

type Preview = {
  id: string;
  name: string;
  phone?: string;
  cats: { id: string; name: string }[];
  hasLine: boolean;
};

export function LinkLineContent() {
  const tr = useTr();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId") || "";
  const { profile, customer, ready, refreshCustomer, error: liffError } = useLiff();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      setError(tr("ลิงก์ไม่ถูกต้อง", "Invalid link"));
      return;
    }
    fetch(`/api/customers/link?customerId=${encodeURIComponent(customerId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.customer) setPreview(d.customer);
        else setError(d.error || tr("ไม่พบลูกค้า", "Customer not found"));
      })
      .catch(() => setError(tr("โหลดข้อมูลไม่สำเร็จ", "Couldn't load data")))
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
      setError(data.error || tr("ผูกไม่สำเร็จ", "Linking failed"));
      return;
    }

    await refreshCustomer();
    setDone(true);
    savedPopup(tr("ผูก LINE สำเร็จ", "LINE linked"), [], { afterNav: true });
    setTimeout(() => router.replace("/app"), 1500);
  };

  if (!ready || loading) {
    return <LoadingScreen message={tr("กำลังเชื่อมต่อ LINE…", "Connecting LINE…")} />;
  }

  if (!customerId || (!preview && error)) {
    return (
      <div className="px-4 pb-6 pt-5">
        <PageHeader eyebrow="Link account" title={tr("ผูกบัญชี LINE", "Link LINE account")} showLang={false} />
        <div className="rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
          <EmptyState icon="alert" title={error || tr("ลิงก์ไม่ถูกต้อง", "Invalid link")} />
        </div>
      </div>
    );
  }

  // เปิดลิงก์แล้วระบบผูก LINE เข้าบัญชีที่ร้านสร้างไว้ให้ทันที (ตอนเชื่อมต่อ LINE) — ไม่ต้องกดอะไร
  if (preview?.hasLine && customer?.id === customerId) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-petflow border border-petflow-line bg-card p-6 text-center shadow-petflow">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <p className="mt-3 text-base font-extrabold text-ok">{tr("ผูก LINE สำเร็จ!", "LINE linked!")}</p>
          <p className="mt-1 text-sm text-brown">{preview.name}</p>
        </div>
        <button
          type="button"
          onClick={() => router.replace("/app")}
          className={`mt-5 ${BTN_PRIMARY}`}
        >
          <Icon name="home" size={16} />
          {tr("ไปหน้าแรก", "Go to home")}
        </button>
      </div>
    );
  }

  if (preview?.hasLine) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-petflow border border-petflow-line bg-card p-6 text-center shadow-petflow">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <p className="mt-3 text-base font-extrabold text-petflow-chocolate">
            {tr("ลูกค้ารายนี้ผูก LINE แล้ว", "This account is already linked to LINE")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.replace("/app")}
          className={`mt-5 ${BTN_SECONDARY}`}
        >
          <Icon name="home" size={16} />
          {tr("ไปหน้าแรก", "Go to home")}
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-petflow border border-petflow-line bg-card p-6 text-center shadow-petflow">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <p className="mt-3 text-base font-extrabold text-ok">{tr("ผูก LINE สำเร็จ!", "LINE linked!")}</p>
          <p className="mt-1 text-xs text-brown-soft">{tr("กำลังพาไปหน้าแรก…", "Taking you home…")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Link account"
        title={tr("ผูกบัญชี LINE", "Link LINE account")}
        subtitle={tr("ร้านบันทึกข้อมูลไว้แล้ว — กดยืนยันเพื่อเชื่อมกับ LINE ของคุณ", "The shop has saved your details. Confirm to link them to your LINE.")}
        showLang={false}
      />

      {preview && (
        <div className="mb-5 overflow-hidden rounded-petflow border border-petflow-line bg-card shadow-petflow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-petflow-chocolate">
              <Icon name="user" size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-petflow-chocolate">{preview.name}</p>
              {preview.phone && (
                <p className="text-xs text-brown-soft">{preview.phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-petflow-line px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/25 text-petflow-chocolate">
              <Icon name="paw" size={20} />
            </span>
            <p className="min-w-0 text-sm text-brown">
              {preview.cats.map((c) => c.name).join(", ") || "—"}
            </p>
          </div>
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
        className={BTN_PRIMARY}
      >
        {!linking && <Icon name="link" size={18} />}
        {linking ? tr("กำลังผูก…", "Linking…") : tr("ยืนยันผูก LINE กับบัญชีนี้", "Link LINE to this account")}
      </button>

      <p className="mt-3 text-center text-[11px] text-brown-faint">
        {tr("ชื่อ LINE", "LINE name")}: {profile?.displayName}
      </p>
    </div>
  );
}
