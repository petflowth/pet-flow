"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { toJpegDataUrl } from "@/lib/image-convert";

type Offer = {
  id: string;
  name: string;
  totalUses: number;
  price: number;
  description?: string;
  imageUrl?: string;
  active: boolean;
};

type Order = {
  id: string;
  customerId: string;
  customerName: string;
  name: string;
  totalUses: number;
  price: number;
  status: "pending" | "paid" | "cancelled";
  slipUrl?: string;
  createdAt: string;
  paidAt?: string;
};

/**
 * 🛍️ ขายคอร์สในแอป — ตั้งว่าจะขายอะไร + ยืนยันรับเงินจากออร์เดอร์ที่ลูกค้ากดซื้อ
 * กดยืนยันแล้วระบบจะเพิ่มคอร์สให้ลูกค้า + ลงรายรับให้อัตโนมัติ
 */
export default function AdminPackagesPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [zoomSlip, setZoomSlip] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [uses, setUses] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState("");

  /** ย่อรูปก่อนส่งเสมอ — รูปจากมือถือ 5MB ยิงขึ้นไปตรงๆ จะโดนตีกลับ */
  const pickImage = async (file: File, onDone: (dataUrl: string) => void) => {
    try {
      onDone(await toJpegDataUrl(file, 900));
    } catch {
      toast("อ่านรูปไม่ได้ ลองรูปอื่นนะคะ", "error");
    }
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/package-shop");
      const d = r.ok ? await r.json() : {};
      setOffers(d.offers || []);
      setOrders(d.orders || []);
    } catch {
      /* ไม่ให้ค้างที่ "กำลังโหลด" ถ้า API พัง */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addOffer = async () => {
    const n = Math.round(Number(uses) || 0);
    if (!name.trim() || n <= 0) {
      toast("กรอกชื่อคอร์สและจำนวนครั้ง", "error");
      return;
    }
    setBusy("add");
    try {
      const res = await fetch("/api/package-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_offer",
          name: name.trim(),
          totalUses: n,
          price: Math.round(Number(price) || 0),
          description: desc.trim() || undefined,
          image: image || undefined,
        }),
      });
      if (res.ok) {
        toast("เพิ่มคอร์สที่ขายแล้ว — ลูกค้าเห็นในแอปทันที 🛍️", "success");
        setName("");
        setUses("");
        setPrice("");
        setDesc("");
        setImage("");
        load();
      } else {
        toast("เพิ่มไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const patch = async (body: Record<string, unknown>, okMsg: string, key: string) => {
    setBusy(key);
    try {
      const res = await fetch("/api/package-shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // เงินเข้าแล้วเสมอ — ถ้าส่งการ์ดไม่ได้ต้องบอกตรงๆ ไม่ใช่บอกว่าแจ้งแล้ว
        toast(
          d.notifyError ? `${okMsg} · ⚠️ ส่ง LINE ไม่ได้: ${d.notifyError}` : okMsg,
          d.notifyError ? "error" : "success"
        );
        load();
      } else if (d.error === "not_pending") {
        toast("ออร์เดอร์นี้ถูกจัดการไปแล้ว (อาจกดซ้ำ) — รีเฟรชให้แล้ว", "error");
        load();
      } else {
        toast("ไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const pending = orders.filter((o) => o.status === "pending");
  const done = orders.filter((o) => o.status !== "pending");
  const field =
    "w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm";

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-petflow-chocolate">
        🛍️ ขายคอร์สในแอป
      </h1>

      {/* ── ออร์เดอร์รอยืนยัน ── */}
      <section className="mb-4 rounded-petflow bg-card p-4 shadow-petflow-sm">
        <h2 className="mb-1 text-sm font-extrabold text-petflow-chocolate">
          ⏳ รอยืนยันรับเงิน {pending.length > 0 && `(${pending.length})`}
        </h2>
        <p className="mb-3 text-[10px] text-brown-faint">
          กดยืนยันแล้วระบบจะเพิ่มคอร์สให้ลูกค้า + ลงรายรับ + แจ้งลูกค้าให้อัตโนมัติ
        </p>
        {pending.length === 0 ? (
          <p className="text-xs text-brown-soft">ยังไม่มีออร์เดอร์รอยืนยัน</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((o) => (
              <li
                key={o.id}
                className="rounded-petflow-sm border border-wait/40 bg-paper/60 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/customers?id=${o.customerId}`}
                      className="text-xs font-extrabold text-latte-deep underline"
                    >
                      👤 {o.customerName}
                    </Link>
                    <p className="text-xs font-bold text-brown">{o.name}</p>
                    <p className="text-[10px] text-brown-soft">
                      {o.totalUses} ครั้ง · {o.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-petflow-chocolate">
                    {o.price.toLocaleString()} ฿
                  </p>
                </div>

                {o.slipUrl ? (
                  <button
                    type="button"
                    onClick={() => setZoomSlip(o.slipUrl!)}
                    className="mt-2 block w-full rounded-petflow-sm bg-sage/15 py-1.5 text-[10px] font-bold text-ok"
                  >
                    🧾 ลูกค้าแนบสลิปแล้ว — แตะดูรูป
                  </button>
                ) : (
                  <p className="mt-2 rounded-petflow-sm bg-honey/20 px-2 py-1.5 text-[10px] font-bold text-wait">
                    ⏳ ยังไม่ได้แนบสลิป
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      if (
                        !confirm(
                          `ยืนยันว่าได้รับเงิน ${o.price.toLocaleString()} บาท จาก ${o.customerName}?\n` +
                            `ระบบจะเพิ่มคอร์ส "${o.name}" (${o.totalUses} ครั้ง) ให้ลูกค้าทันที`
                        )
                      )
                        return;
                      patch(
                        { action: "confirm_order", orderId: o.id },
                        "ยืนยันรับเงินแล้ว — เพิ่มคอร์สให้ลูกค้าเรียบร้อย 🎫",
                        o.id
                      );
                    }}
                    className="rounded-full bg-sage/25 px-3 py-1.5 text-[11px] font-extrabold text-ok disabled:opacity-40"
                  >
                    {busy === o.id ? "…" : "✅ ได้รับเงินแล้ว"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      if (!confirm("ยกเลิกออร์เดอร์นี้? (ลูกค้าจะไม่ได้คอร์ส)")) return;
                      patch(
                        { action: "cancel_order", orderId: o.id },
                        "ยกเลิกออร์เดอร์แล้ว",
                        o.id
                      );
                    }}
                    className="rounded-full bg-wait/15 px-3 py-1.5 text-[11px] font-bold text-wait disabled:opacity-40"
                  >
                    ❌ ยกเลิก
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── ตั้งว่าจะขายอะไร ── */}
      <section className="mb-4 rounded-petflow bg-card p-4 shadow-petflow-sm">
        <h2 className="mb-1 text-sm font-extrabold text-petflow-chocolate">
          🏷️ คอร์สที่เปิดขายในแอป
        </h2>
        <p className="mb-3 text-[10px] text-brown-faint">
          ลูกค้าจะเห็นรายการนี้ในหน้าแรกของแอป และกดซื้อได้เลย
        </p>

        {offers.length > 0 && (
          <ul className="mb-3 space-y-2">
            {offers.map((o) => (
              <li
                key={o.id}
                className={`rounded-petflow-sm border px-3 py-2 ${
                  o.active
                    ? "border-petflow-line bg-paper/50"
                    : "border-petflow-line bg-paper/30 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-petflow-sm bg-paper">
                      {o.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-lg">
                          📷
                        </span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          pickImage(f, (dataUrl) =>
                            patch(
                              { action: "set_offer_image", offerId: o.id, image: dataUrl },
                              "เปลี่ยนรูปแล้ว 📷",
                              o.id
                            )
                          );
                        }}
                      />
                    </label>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brown">
                        {o.name} {!o.active && "(ปิดขายอยู่)"}
                      </p>
                      <p className="text-[10px] text-brown-soft">
                        {o.totalUses} ครั้ง · {o.price.toLocaleString()} ฿
                        {o.description ? ` · ${o.description}` : ""}
                      </p>
                      <p className="text-[10px] text-brown-faint">
                        แตะรูปเพื่อ{o.imageUrl ? "เปลี่ยน" : "ใส่"}รูป
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        patch(
                          { action: "set_offer_active", offerId: o.id, active: !o.active },
                          o.active ? "ปิดขายแล้ว" : "เปิดขายแล้ว",
                          o.id
                        )
                      }
                      className="text-[10px] font-bold text-latte-deep"
                    >
                      {o.active ? "ปิดขาย" : "เปิดขาย"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`ลบ "${o.name}" ออกจากรายการขาย?`)) return;
                        patch(
                          { action: "delete_offer", offerId: o.id },
                          "ลบออกจากรายการขายแล้ว",
                          o.id
                        );
                      }}
                      className="text-[10px] font-bold text-wait"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อคอร์ส เช่น อาบน้ำ 10 ครั้ง"
            className={field}
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={uses}
              onChange={(e) => setUses(e.target.value)}
              placeholder="กี่ครั้ง"
              className={field}
            />
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="ราคา (บาท)"
              className={field}
            />
          </div>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="คำโปรย (ถ้ามี) เช่น ประหยัดกว่าซื้อแยก 500฿"
            className={field}
          />

          <label className="flex cursor-pointer items-center gap-3 rounded-petflow-sm border border-dashed border-petflow-line bg-paper px-3 py-2.5">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt="รูปหน้าปกคอร์ส"
                className="h-14 w-14 shrink-0 rounded-petflow-sm object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-petflow-sm bg-card text-xl">
                📷
              </span>
            )}
            <span className="min-w-0 text-[11px] font-bold text-brown-soft">
              {image ? "เปลี่ยนรูปหน้าปก" : "ใส่รูปหน้าปก (ถ้ามี)"}
              <span className="block font-normal text-brown-faint">
                รูปสวยๆ ช่วยให้ลูกค้ากดซื้อง่ายขึ้นเยอะเลยค่ะ
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) pickImage(f, setImage);
              }}
            />
          </label>

          <button
            type="button"
            disabled={busy === "add"}
            onClick={addOffer}
            className="w-full rounded-petflow-sm bg-latte/30 py-2.5 text-sm font-extrabold text-petflow-chocolate disabled:opacity-40"
          >
            {busy === "add" ? "กำลังเพิ่ม…" : "➕ เพิ่มคอร์สที่จะขาย"}
          </button>
        </div>
      </section>

      {/* ── ประวัติออร์เดอร์ ── */}
      {done.length > 0 && (
        <section className="rounded-petflow bg-card p-4 shadow-petflow-sm">
          <h2 className="mb-2 text-sm font-extrabold text-petflow-chocolate">
            📋 ออร์เดอร์ที่จบแล้ว
          </h2>
          <ul className="space-y-1.5">
            {done.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-petflow-sm bg-paper/50 px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate text-brown-soft">
                  {(o.paidAt || o.createdAt).slice(0, 10)} · {o.customerName} · {o.name}
                </span>
                <span
                  className={`shrink-0 font-bold ${
                    o.status === "paid" ? "text-ok" : "text-wait"
                  }`}
                >
                  {o.status === "paid" ? `✅ ${o.price.toLocaleString()}฿` : "ยกเลิก"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ดูสลิปเต็มจอ */}
      {zoomSlip && (
        <button
          type="button"
          onClick={() => setZoomSlip(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomSlip}
            alt="สลิปโอนเงิน"
            className="max-h-full max-w-full rounded-petflow object-contain"
          />
        </button>
      )}
    </div>
  );
}
