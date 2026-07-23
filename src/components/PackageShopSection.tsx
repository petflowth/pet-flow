"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { toJpegDataUrl } from "@/lib/image-convert";

type Offer = {
  id: string;
  kind: "package" | "credit";
  name: string;
  totalUses: number;
  price: number;
  creditAmount?: number;
  description?: string;
  imageUrl?: string;
};

type Order = {
  id: string;
  kind: "package" | "credit";
  name: string;
  totalUses: number;
  price: number;
  creditAmount?: number;
  status: "pending" | "paid" | "cancelled";
  slipUrl?: string;
  createdAt: string;
};

type Payment = { bankName: string; accountNumber: string; accountName: string };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

/**
 * ร้านขายคอร์สในแอปลูกค้า — เห็นว่ามีอะไรขาย กดซื้อ โอน แล้วแนบสลิปได้ในที่เดียว
 * คอร์สจะเข้าระบบก็ต่อเมื่อร้านกดยืนยันรับเงินแล้วเท่านั้น
 *
 * ไม่มีของขายและไม่มีออร์เดอร์ค้าง = ซ่อนทั้งช่อง
 */
export function PackageShopSection() {
  const { profile } = useLiff();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [buying, setBuying] = useState("");
  const [uploading, setUploading] = useState("");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!profile?.lineUserId) return;
    try {
      const r = await fetch(
        `/api/package-shop?lineUserId=${encodeURIComponent(profile.lineUserId)}`
      );
      const d = await r.json();
      setOffers(d.offers || []);
      setOrders(d.orders || []);
      setPayment(d.payment || null);
    } catch {
      /* โหลดไม่ได้ = ซ่อนช่องไปเลย ดีกว่าโชว์ช่องว่าง */
    }
  }, [profile?.lineUserId]);

  useEffect(() => {
    load();
  }, [load]);

  const pending = orders.filter((o) => o.status === "pending");

  const buy = async (offer: Offer) => {
    if (!profile?.lineUserId) return;
    const detail =
      offer.kind === "credit"
        ? `ได้รับเครดิต ${(offer.creditAmount ?? offer.price).toLocaleString()} บาท`
        : `(${offer.totalUses} ครั้ง)`;
    if (
      !confirm(
        `สั่งซื้อ "${offer.name}" ${detail}\n` +
          `ยอดที่ต้องโอน ${offer.price.toLocaleString()} บาท\n\n` +
          `กดตกลงแล้วจะมีเลขบัญชีให้โอน แล้วแนบสลิปได้เลยนะคะ`
      )
    )
      return;
    setBuying(offer.id);
    setMsg("");
    try {
      const res = await fetch("/api/package-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "order",
          lineUserId: profile.lineUserId,
          offerId: offer.id,
        }),
      });
      if (res.ok) {
        setMsg("สั่งซื้อแล้ว — โอนตามเลขบัญชีด้านล่าง แล้วแนบสลิปได้เลยค่ะ 🧡");
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg(
          d.error === "not_registered"
            ? "กรุณาสมัครสมาชิกก่อนสั่งซื้อนะคะ"
            : "สั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"
        );
      }
    } finally {
      setBuying("");
    }
  };

  const uploadSlip = async (orderId: string, file: File) => {
    if (!profile?.lineUserId) return;
    setUploading(orderId);
    setMsg("");
    try {
      // ย่อรูปก่อนส่ง — สลิปจากมือถือไฟล์ใหญ่มาก ถ้าย่อไม่ได้ค่อยส่งไฟล์เดิม
      const slip = await toJpegDataUrl(file, 1200).catch(() => fileToDataUrl(file));
      const res = await fetch("/api/package-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "slip",
          lineUserId: profile.lineUserId,
          orderId,
          slip,
        }),
      });
      setMsg(
        res.ok
          ? "ส่งสลิปแล้ว รอร้านตรวจสอบสักครู่นะคะ 🧾"
          : "ส่งสลิปไม่สำเร็จ ลองใหม่อีกครั้งนะคะ"
      );
      if (res.ok) load();
    } finally {
      setUploading("");
    }
  };

  const copyAccount = async () => {
    if (!payment?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(payment.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* คลิปบอร์ดใช้ไม่ได้บนบางเครื่อง — ลูกค้าพิมพ์เองได้ */
    }
  };

  if (offers.length === 0 && pending.length === 0) return null;

  return (
    <section className="mb-4 rounded-petflow border-2 border-mint-deep/30 bg-mint p-4 shadow-petflow">
      <p className="mb-1 text-sm font-extrabold text-mint-deep">
        🛍️ คอร์สที่เปิดขาย
      </p>
      <p className="mb-3 text-[10px] text-brown-faint">
        ซื้อล่วงหน้าคุ้มกว่า · ใช้ได้ทุกครั้งที่มาใช้บริการ
      </p>

      {offers.length > 0 && (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2">
          {offers.map((o) => {
            const perUse = o.totalUses > 0 ? Math.round(o.price / o.totalUses) : 0;
            return (
              <div
                key={o.id}
                className="overflow-hidden rounded-petflow-sm bg-card/90 shadow-petflow-sm"
              >
                {o.imageUrl && (
                  // พื้นหลังนวลๆ กันภาพสัดส่วนแปลกๆ ดูโล่ง — ตัวรูปโชว์เต็มไม่โดน crop
                  <div className="flex items-center justify-center bg-latte/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={o.imageUrl}
                      alt={o.name}
                      loading="lazy"
                      className="max-h-48 w-full object-contain"
                    />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-sm font-extrabold leading-snug text-petflow-chocolate">
                    {o.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] font-bold text-brown-soft">
                    {o.kind === "credit" ? (
                      <span className="rounded-full bg-sage/20 px-2 py-0.5 text-ok">
                        ได้เครดิต {(o.creditAmount ?? o.price).toLocaleString()}฿
                        {(o.creditAmount ?? o.price) > o.price ? " 🎁" : ""}
                      </span>
                    ) : (
                      <>
                        <span className="rounded-full bg-sage/20 px-2 py-0.5 text-ok">
                          ใช้ได้ {o.totalUses} ครั้ง
                        </span>
                        {perUse > 0 && (
                          <span className="text-brown-faint">
                            ตกครั้งละ {perUse.toLocaleString()}฿
                          </span>
                        )}
                      </>
                    )}
                  </p>
                  {o.description && (
                    <p className="mt-1 text-[10px] leading-relaxed text-brown-faint">
                      {o.description}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-end justify-between gap-2">
                    <p className="text-lg font-extrabold leading-none text-latte-deep">
                      {o.price.toLocaleString()}
                      <span className="text-xs">฿</span>
                    </p>
                    <button
                      type="button"
                      disabled={buying === o.id}
                      onClick={() => buy(o)}
                      className="rounded-full bg-latte-deep px-4 py-1.5 text-[11px] font-extrabold text-card shadow-petflow-sm disabled:opacity-40"
                    >
                      {buying === o.id ? "…" : "ซื้อเลย"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* รอโอน — โชว์เลขบัญชี ยอดที่ต้องโอน และปุ่มแนบสลิป */}
      {pending.map((o) => (
        <div
          key={o.id}
          className="mb-2 rounded-petflow-sm border border-wait/40 bg-paper/70 px-3 py-2.5"
        >
          <p className="text-xs font-extrabold text-wait">⏳ รอโอนเงิน · {o.name}</p>
          <p className="mt-0.5 text-[10px] text-brown-soft">
            ยอดที่ต้องโอน{" "}
            <span className="text-sm font-extrabold text-petflow-chocolate">
              {o.price.toLocaleString()} บาท
            </span>
          </p>

          {payment?.accountNumber && (
            <div className="mt-2 rounded-petflow-sm bg-card px-2.5 py-2">
              <p className="text-[10px] font-bold text-brown-soft">{payment.bankName}</p>
              <p className="text-sm font-extrabold text-ok">{payment.accountNumber}</p>
              {payment.accountName && (
                <p className="text-[10px] text-brown-faint">
                  ชื่อบัญชี: {payment.accountName}
                </p>
              )}
              <button
                type="button"
                onClick={copyAccount}
                className="mt-1.5 w-full rounded-petflow-sm bg-latte/25 py-1.5 text-[10px] font-extrabold text-petflow-chocolate"
              >
                {copied ? "คัดลอกแล้ว ✓" : "📋 คัดลอกเลขบัญชี"}
              </button>
            </div>
          )}

          {o.slipUrl ? (
            <p className="mt-2 rounded-petflow-sm bg-sage/15 px-2.5 py-1.5 text-[10px] font-bold text-ok">
              ✅ ส่งสลิปแล้ว — รอร้านยืนยันรับเงิน คอร์สจะเข้าให้อัตโนมัติค่ะ
            </p>
          ) : (
            <label className="mt-2 block cursor-pointer rounded-petflow-sm bg-honey/40 py-2 text-center text-[11px] font-extrabold text-petflow-chocolate">
              {uploading === o.id ? "กำลังส่ง…" : "📎 แนบสลิปโอนเงิน"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading === o.id}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadSlip(o.id, f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      ))}

      {msg && (
        <p className="mt-1 rounded-petflow-sm bg-card px-2.5 py-1.5 text-[10px] font-bold text-brown-soft">
          {msg}
        </p>
      )}
    </section>
  );
}
