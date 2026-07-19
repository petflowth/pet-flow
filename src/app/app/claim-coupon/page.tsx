"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";

type Offer = { id: string; title: string; amount: number; reason: string; validDays: number; active: boolean };

function ClaimContent() {
  const params = useSearchParams();
  const offerId = params.get("offer") || "";
  const { profile } = useLiff();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<"" | "ok" | "already" | "error">("");

  useEffect(() => {
    if (!offerId) {
      setLoading(false);
      return;
    }
    fetch(`/api/coupons/claim?offer=${offerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.found) setOffer(d.offer);
      })
      .finally(() => setLoading(false));
  }, [offerId]);

  const claim = async () => {
    if (!offerId || !profile?.lineUserId) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/coupons/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, lineUserId: profile.lineUserId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) setResult("ok");
      else if (d.alreadyClaimed) setResult("already");
      else setResult("error");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <p className="px-4 py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;

  if (!offer)
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm text-brown-soft">ไม่พบคูปองนี้ หรือแคมเปญปิดแล้วค่ะ</p>
        <Link href="/app/coupons" className="mt-4 inline-block text-xs font-bold text-latte-deep">
          ดูกระเป๋าคูปองของฉัน →
        </Link>
      </div>
    );

  if (result === "ok" || result === "already")
    return (
      <div className="px-6 py-16 text-center">
        <div className="text-5xl">🎟️</div>
        <h1 className="mt-4 text-lg font-extrabold text-petflow-chocolate">
          {result === "ok" ? "รับคูปองเรียบร้อยแล้ว!" : "คุณรับคูปองนี้ไปแล้วนะคะ"}
        </h1>
        <p className="mt-2 text-sm text-brown-soft">
          คูปองส่วนลด {offer.amount} บาท อยู่ในกระเป๋าคูปองของคุณแล้ว 🧡
        </p>
        <Link
          href="/app/coupons"
          className="mt-6 inline-block rounded-petflow-sm bg-latte-deep px-5 py-2.5 text-sm font-extrabold text-card"
        >
          🎟️ ดูกระเป๋าคูปอง
        </Link>
      </div>
    );

  return (
    <div className="px-4 pb-10 pt-5">
      <h1 className="text-lg font-extrabold text-petflow-chocolate">🎟️ คูปองส่วนลดพิเศษ</h1>
      <div className="mt-4 rounded-petflow border border-honey/50 bg-gradient-to-br from-honey/25 via-card to-latte/15 p-5 text-center shadow-petflow-sm">
        <p className="text-sm font-bold text-brown">{offer.title}</p>
        <p className="mt-2 text-4xl font-extrabold text-latte-deep">
          ฿{offer.amount.toLocaleString()}
        </p>
        {offer.reason && offer.reason !== offer.title && (
          <p className="mt-2 text-xs text-brown-soft">{offer.reason}</p>
        )}
        <p className="mt-2 text-[10px] text-brown-faint">ใช้เป็นส่วนลดได้ ({offer.validDays} วัน)</p>
      </div>
      {result === "error" && (
        <p className="mt-3 text-center text-xs font-bold text-red-600">รับคูปองไม่สำเร็จ ลองใหม่นะคะ</p>
      )}
      <button
        type="button"
        onClick={claim}
        disabled={claiming || !offer.active}
        className="mt-5 w-full rounded-petflow-sm bg-latte-deep py-3.5 text-sm font-extrabold text-card active:scale-[0.98] disabled:opacity-50"
      >
        {claiming ? "กำลังรับ…" : offer.active ? "🎁 กดรับคูปองเข้ากระเป๋า" : "แคมเปญปิดแล้ว"}
      </button>
      <Link
        href="/app/coupons"
        className="mt-3 block text-center text-xs font-bold text-brown-soft"
      >
        ดูกระเป๋าคูปองของฉัน →
      </Link>
    </div>
  );
}

export default function ClaimCouponPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>}>
      <ClaimContent />
    </Suspense>
  );
}
