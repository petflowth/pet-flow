"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/components/LiffProvider";

type Coupon = {
  id: string;
  code: string;
  amount: number;
  reason: string;
  status: "active" | "used" | "expired";
  expiresAt?: string;
};

function daysLeft(iso?: string) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d;
}

export default function CouponsPage() {
  const { ready, profile } = useLiff();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [referralUrl, setReferralUrl] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [packages, setPackages] = useState<
    { id: string; name: string; totalUses: number; usedUses: number }[]
  >([]);
  const [voucher, setVoucher] = useState<Coupon | null>(null);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    fetch(`/api/coupons?lineUserId=${profile.lineUserId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.found) return;
        setCoupons(d.coupons || []);
        setReferralUrl(d.referralUrl || "");
        setReferralCode(d.referralCode || "");
      })
      .finally(() => setLoading(false));
    fetch(`/api/packages?lineUserId=${profile.lineUserId}&active=1`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => {});
  }, [profile?.lineUserId]);

  const share = async () => {
    const text = `🐱 มาเลี้ยงน้องแมวที่ PetFlow กันนะ! สมัครผ่านลิงก์นี้ + มาใช้บริการครั้งแรก รับคูปองส่วนลด 100฿ ทั้งคู่เลย 🎁\n${referralUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const active = coupons.filter((c) => c.status === "active");
  const past = coupons.filter((c) => c.status !== "active");

  return (
    <div className="px-4 pb-10 pt-5">
      <Link href="/app" className="mb-3 inline-block text-xs font-bold text-brown-soft">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-lg font-extrabold text-petflow-chocolate">🎟️ กระเป๋าคูปองของฉัน</h1>

      {/* ── ชวนเพื่อน ── */}
      <div className="mt-4 rounded-petflow border border-honey/50 bg-gradient-to-br from-honey/25 via-card to-latte/15 p-4 shadow-petflow-sm">
        <p className="text-sm font-extrabold text-petflow-chocolate">🎁 ชวนเพื่อน รับคนละ 100฿</p>
        <p className="mt-1 text-xs text-brown-soft">
          ส่งลิงก์ให้เพื่อนสมัคร + <b className="text-latte-deep">มาใช้บริการครั้งแรก</b> — ได้คูปองส่วนลด <b className="text-latte-deep">100฿ ทั้งคุณและเพื่อน</b> 🧡
        </p>
        {referralCode && (
          <p className="mt-2 text-[11px] font-bold text-brown-soft">
            รหัสของคุณ: <span className="rounded bg-paper px-2 py-0.5 font-extrabold text-petflow-chocolate">{referralCode}</span>
          </p>
        )}
        <button
          type="button"
          onClick={share}
          disabled={!referralUrl}
          className="mt-3 w-full rounded-petflow-sm bg-latte-deep py-2.5 text-sm font-extrabold text-card active:scale-[0.98] disabled:opacity-50"
        >
          {copied ? "✅ คัดลอกลิงก์แล้ว — เอาไปส่งเพื่อนได้เลย!" : "📋 คัดลอกลิงก์ชวนเพื่อน"}
        </button>
      </div>

      {/* ── คอร์ส/แพ็กเกจ ── */}
      {packages.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold text-brown-soft">🎫 คอร์สของฉัน</p>
          <div className="space-y-2">
            {packages.map((p) => {
              const left = p.totalUses - p.usedUses;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-petflow border border-sage/40 bg-sage/10 p-3"
                >
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-petflow-sm bg-sage text-card">
                    <span className="text-lg font-extrabold leading-none">{left}</span>
                    <span className="text-[8px]">เหลือ</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-brown">{p.name}</p>
                    <p className="text-[10px] text-brown-faint">
                      ใช้ไป {p.usedUses} จาก {p.totalUses} ครั้ง
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── คูปอง ── */}
      {!ready || loading ? (
        <p className="mt-6 text-sm text-brown-soft">กำลังโหลด…</p>
      ) : (
        <>
          <p className="mt-6 mb-2 text-xs font-bold text-brown-soft">
            คูปองที่ใช้ได้ ({active.length})
          </p>
          {active.length === 0 ? (
            <p className="rounded-petflow-sm bg-paper px-4 py-4 text-center text-xs text-brown-soft">
              ยังไม่มีคูปอง — ชวนเพื่อนมาใช้บริการ รับ 100฿ ได้เลยนะคะ 🧡
            </p>
          ) : (
            <div className="space-y-2">
              {active.map((c) => {
                const dl = daysLeft(c.expiresAt);
                return (
                  <div
                    key={c.id}
                    className="rounded-petflow border border-petflow-line bg-card p-3 shadow-petflow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-petflow-sm bg-latte-deep text-card">
                        <span className="text-lg font-extrabold leading-none">฿{c.amount}</span>
                        <span className="text-[8px]">ส่วนลด</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-brown">{c.reason}</p>
                        <p className="text-[10px] text-brown-faint">
                          โค้ด {c.code}
                          {dl != null ? ` · หมดอายุใน ${dl} วัน` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVoucher(c)}
                      className="mt-2 w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-2.5 text-xs font-extrabold text-petflow-chocolate active:scale-[0.98]"
                    >
                      🎫 กดใช้คูปองนี้
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {past.length > 0 && (
            <>
              <p className="mt-5 mb-2 text-xs font-bold text-brown-faint">ใช้แล้ว / หมดอายุ</p>
              <div className="space-y-2 opacity-60">
                {past.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-petflow-sm border border-petflow-line bg-paper p-2.5"
                  >
                    <span className="text-sm font-extrabold text-brown-faint">฿{c.amount}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-brown-soft">{c.reason}</span>
                    <span className="text-[10px] font-bold text-brown-faint">
                      {c.status === "used" ? "ใช้แล้ว" : "หมดอายุ"}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* วอเชอร์ — แสดงให้พนักงานตอนคิดเงิน */}
      {voucher && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setVoucher(null)}
        >
          <div
            className="w-full max-w-xs rounded-petflow bg-card p-6 text-center shadow-petflow"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-bold text-brown-soft">คูปองส่วนลด</p>
            <p className="mt-1 text-5xl font-extrabold text-latte-deep">฿{voucher.amount}</p>
            <p className="mt-1 text-sm font-bold text-brown">{voucher.reason}</p>
            <div className="mt-4 rounded-petflow-sm border-2 border-dashed border-latte/50 bg-paper py-3">
              <p className="text-[10px] font-bold text-brown-soft">รหัสคูปอง</p>
              <p className="text-2xl font-extrabold tracking-widest text-petflow-chocolate">
                {voucher.code}
              </p>
            </div>
            <p className="mt-4 text-xs font-bold text-petflow-chocolate">
              📸 แสดงหน้านี้ให้พนักงานตอนคิดเงิน
            </p>
            <p className="mt-1 text-[10px] text-brown-faint">
              พนักงานจะกดใช้คูปองให้ตอนออกบิลค่ะ (คูปองจะถูกใช้เมื่อคิดเงินเท่านั้น)
            </p>
            <button
              type="button"
              onClick={() => setVoucher(null)}
              className="mt-5 w-full rounded-petflow-sm bg-latte/25 py-2.5 text-xs font-bold text-petflow-chocolate"
            >
              ปิด
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
