"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/Toast";
import { toJpegDataUrl } from "@/lib/image-convert";

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string;
  stockCount: number;
  active: boolean;
};

/** แถวสินค้า — กดแก้ไขแล้วกลายเป็นฟอร์มอินไลน์ (ชื่อ/หมวดหมู่/ราคา), สต็อกแยกปุ่มต่างหาก */
function ProductRow({
  product,
  patch,
  restock,
  pickImage,
}: {
  product: Product;
  patch: (body: Record<string, unknown>, okMsg: string, key: string) => Promise<void>;
  restock: (id: string, delta: number) => Promise<void>;
  pickImage: (file: File, onDone: (dataUrl: string) => void) => Promise<void>;
}) {
  const p = product;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const [category, setCategory] = useState(p.category);
  const [price, setPrice] = useState(String(p.price));
  const [saving, setSaving] = useState(false);
  const [restockInput, setRestockInput] = useState("");

  const startEdit = () => {
    setName(p.name);
    setCategory(p.category);
    setPrice(String(p.price));
    setEditing(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast("กรอกชื่อสินค้า", "error");
      return;
    }
    setSaving(true);
    try {
      await patch(
        {
          action: "update",
          id: p.id,
          name: name.trim(),
          category: category.trim(),
          price: Math.round(Number(price) || 0),
        },
        "แก้ไขสินค้าแล้ว ✏️",
        p.id
      );
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm";

  if (editing) {
    return (
      <li className="rounded-petflow-sm border border-latte/50 bg-paper/70 p-3">
        <p className="mb-2 text-[11px] font-extrabold text-petflow-chocolate">
          ✏️ แก้ไขสินค้า
        </p>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อสินค้า"
            className={field}
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="หมวดหมู่ เช่น ทรายแมว"
            list="product-categories"
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-petflow-sm bg-paper py-2 text-xs font-bold text-brown-soft"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="flex-1 rounded-petflow-sm bg-latte-deep py-2 text-xs font-extrabold text-card disabled:opacity-40"
            >
              {saving ? "…" : "💾 บันทึก"}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`rounded-petflow-sm border px-3 py-2 ${
        p.active
          ? "border-petflow-line bg-paper/50"
          : "border-petflow-line bg-paper/30 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-petflow-sm bg-paper">
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
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
                    { action: "set_image", id: p.id, image: dataUrl },
                    "เปลี่ยนรูปแล้ว 📷",
                    p.id
                  )
                );
              }}
            />
          </label>
          <div className="min-w-0">
            <p className="text-xs font-bold text-brown">
              {p.name} {!p.active && "(ปิดขายอยู่)"}
            </p>
            <p className="text-[10px] text-brown-soft">
              {p.price.toLocaleString()} ฿{p.category ? ` · ${p.category}` : ""}
            </p>
            <p
              className={`text-[10px] font-bold ${
                p.stockCount <= 0 ? "text-wait" : "text-brown-faint"
              }`}
            >
              {p.stockCount <= 0 ? "⚠️ สต็อกหมด" : `คงเหลือ ${p.stockCount} ชิ้น`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={startEdit}
            className="text-[10px] font-bold text-latte-deep"
          >
            ✏️ แก้ไข
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                patch(
                  { action: "set_active", id: p.id, active: !p.active },
                  p.active ? "ปิดขายแล้ว" : "เปิดขายแล้ว",
                  p.id
                )
              }
              className="text-[10px] font-bold text-latte-deep"
            >
              {p.active ? "ปิดขาย" : "เปิดขาย"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`ลบ "${p.name}" ออกจากรายการสินค้า?`)) return;
                patch({ action: "delete", id: p.id }, "ลบสินค้าแล้ว", p.id);
              }}
              className="text-[10px] font-bold text-wait"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 border-t border-petflow-line/60 pt-2">
        <span className="text-[10px] font-bold text-brown-soft">เติมสต็อก:</span>
        <input
          type="number"
          value={restockInput}
          onChange={(e) => setRestockInput(e.target.value)}
          placeholder="จำนวน"
          className="w-20 rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={async () => {
            const n = Math.round(Number(restockInput) || 0);
            if (!n) return;
            await restock(p.id, n);
            setRestockInput("");
          }}
          className="rounded-full bg-sage/25 px-2.5 py-1 text-[10px] font-extrabold text-ok"
        >
          + เพิ่ม
        </button>
        <button
          type="button"
          onClick={async () => {
            const n = Math.round(Number(restockInput) || 0);
            if (!n) return;
            await restock(p.id, -n);
            setRestockInput("");
          }}
          className="rounded-full bg-wait/15 px-2.5 py-1 text-[10px] font-bold text-wait"
        >
          − ลด
        </button>
      </div>
    </li>
  );
}

/** 🛒 สินค้าหน้าร้าน — ตั้งสินค้าที่จะขายหน้าเคาน์เตอร์ (แยกจากคอร์ส/แพ็กเกจในแอป) พร้อมนับสต็อก */
export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState("ทั้งหมด");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [stockCount, setStockCount] = useState("");
  const [image, setImage] = useState("");

  const pickImage = async (file: File, onDone: (dataUrl: string) => void) => {
    try {
      onDone(await toJpegDataUrl(file, 900));
    } catch {
      toast("อ่านรูปไม่ได้ ลองรูปอื่นนะคะ", "error");
    }
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/products");
      const d = r.ok ? await r.json() : {};
      setProducts(d.products || []);
    } catch {
      /* ไม่ให้ค้างที่ "กำลังโหลด" ถ้า API พัง */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))],
    [products]
  );
  const tabs = ["ทั้งหมด", ...categories];
  const visible = tab === "ทั้งหมด" ? products : products.filter((p) => p.category === tab);

  const addProduct = async () => {
    if (!name.trim()) {
      toast("กรอกชื่อสินค้า", "error");
      return;
    }
    setBusy("add");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          category: category.trim(),
          price: Math.round(Number(price) || 0),
          stockCount: Math.round(Number(stockCount) || 0),
          image: image || undefined,
        }),
      });
      if (res.ok) {
        toast("เพิ่มสินค้าแล้ว — เลือกขายได้จากหน้าคิดเงิน 🛒", "success");
        setName("");
        setCategory("");
        setPrice("");
        setStockCount("");
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
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast(okMsg, "success");
        load();
      } else {
        toast("ไม่สำเร็จ — ลองกด 'อัปเดตฐานข้อมูล' ในหน้าตั้งค่าแล้วลองใหม่", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const restock = async (id: string, delta: number) => {
    await patch(
      { action: "restock", id, delta },
      delta > 0 ? `เติมสต็อก +${delta} แล้ว` : `ลดสต็อก ${delta} แล้ว`,
      id
    );
  };

  const field =
    "w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm";

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-petflow-chocolate">
        🛒 สินค้าหน้าร้าน
      </h1>

      <datalist id="product-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <section className="mb-4 rounded-petflow bg-card p-4 shadow-petflow-sm">
        <h2 className="mb-1 text-sm font-extrabold text-petflow-chocolate">📦 รายการสินค้า</h2>
        <p className="mb-3 text-[10px] text-brown-faint">
          กดสินค้าจากหน้าคิดเงินได้เลย — ขายแล้วตัดสต็อกอัตโนมัติ
        </p>

        {tabs.length > 1 && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                  tab === t
                    ? "bg-honey/40 text-petflow-chocolate"
                    : "bg-paper text-brown-soft"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {visible.length > 0 ? (
          <ul className="mb-3 space-y-2">
            {visible.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                patch={patch}
                restock={restock}
                pickImage={pickImage}
              />
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-brown-soft">ยังไม่มีสินค้าในหมวดนี้</p>
        )}
      </section>

      <section className="rounded-petflow bg-card p-4 shadow-petflow-sm">
        <h2 className="mb-3 text-sm font-extrabold text-petflow-chocolate">➕ เพิ่มสินค้าใหม่</h2>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อสินค้า เช่น ทรายแมว 5 กก."
            className={field}
          />
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="หมวดหมู่ เช่น ทรายแมว"
            list="product-categories"
            className={field}
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="ราคา (บาท)"
              className={field}
            />
            <input
              type="number"
              min={0}
              value={stockCount}
              onChange={(e) => setStockCount(e.target.value)}
              placeholder="สต็อกเริ่มต้น"
              className={field}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-petflow-sm border border-dashed border-petflow-line bg-paper px-3 py-2.5">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt="รูปสินค้า"
                className="h-14 w-14 shrink-0 rounded-petflow-sm object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-petflow-sm bg-card text-xl">
                📷
              </span>
            )}
            <span className="min-w-0 text-[11px] font-bold text-brown-soft">
              {image ? "เปลี่ยนรูปสินค้า" : "ใส่รูปสินค้า (ถ้ามี)"}
              <span className="block font-normal text-brown-faint">
                มีรูปกดขายง่ายกว่าเยอะเวลาคิดเงิน
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
            onClick={addProduct}
            className="w-full rounded-petflow-sm bg-latte/30 py-2.5 text-sm font-extrabold text-petflow-chocolate disabled:opacity-40"
          >
            {busy === "add" ? "กำลังเพิ่ม…" : "➕ เพิ่มสินค้า"}
          </button>
        </div>
      </section>
    </div>
  );
}
