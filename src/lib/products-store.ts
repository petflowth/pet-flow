import { getSupabase } from "./supabase/server";
import { uploadDataUrlToStorage } from "./supabase/storage";
import { requireTenantId } from "./tenant-context";

/**
 * สินค้าขายหน้าร้าน (ของกิน/ทราย/ของเล่น) — แยกจากคอร์ส/แพ็กเกจใน package-shop-store.ts
 * เพราะมีสต็อกนับจำนวนได้ (คอร์สไม่มีแนวคิดสต็อก)
 *
 * สต็อกตัด/คืนอัตโนมัติที่ markInvoicePaid/revertInvoicePaid ใน invoices-store.ts
 * (ดู adjustProductStock) — ไม่ใช่ตอนเพิ่มลงตะกร้าหรือสร้างบิล เพราะบิลที่ยังไม่จ่ายเงิน
 * อาจถูกยกเลิก/แก้ไขได้ ตัดสต็อกตอนนั้นจะทำให้ตัวเลขเพี้ยน
 */

export type ProductRecord = {
  id: string;
  name: string;
  /** หมวดหมู่ — พิมพ์เองอิสระ ใช้แยกแท็บในหน้าคิดเงิน/จัดการสินค้า */
  category: string;
  price: number;
  imageUrl?: string;
  stockCount: number;
  active: boolean;
  createdAt: string;
};

type ProductRow = {
  id: string;
  name: string | null;
  category: string | null;
  price: number;
  image_url?: string | null;
  stock_count: number;
  active: boolean;
  created_at: string;
};

const memProducts: ProductRecord[] = [];

function rowToProduct(r: ProductRow): ProductRecord {
  return {
    id: r.id,
    name: r.name || "",
    category: r.category || "",
    price: Number(r.price) || 0,
    imageUrl: r.image_url || undefined,
    stockCount: Number(r.stock_count) || 0,
    active: r.active !== false,
    createdAt: r.created_at,
  };
}

export async function listProducts(activeOnly = false): Promise<ProductRecord[]> {
  const sb = getSupabase();
  let list: ProductRecord[];
  if (sb) {
    try {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .eq("tenant_id", requireTenantId())
        .order("category", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return [];
      list = ((data as ProductRow[] | null) || []).map(rowToProduct);
    } catch {
      return [];
    }
  } else {
    list = [...memProducts];
  }
  return activeOnly ? list.filter((p) => p.active) : list;
}

export async function getProduct(id: string): Promise<ProductRecord | undefined> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();
    return data ? rowToProduct(data as ProductRow) : undefined;
  }
  return memProducts.find((p) => p.id === id);
}

export async function createProduct(data: {
  name: string;
  category: string;
  price: number;
  stockCount?: number;
  /** data URL จากช่องอัปโหลด — จะถูกเก็บขึ้น Storage ให้ ไม่ยัด base64 ลง DB */
  image?: string;
}): Promise<ProductRecord | null> {
  const name = data.name.trim();
  if (!name) return null;
  const category = data.category.trim();
  const price = Math.max(0, Math.round(data.price) || 0);
  const stockCount = Math.max(0, Math.round(data.stockCount ?? 0) || 0);

  const id = `PRD${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // อัปรูปก่อน แต่ถ้าอัปไม่ขึ้นก็ยังต้องสร้างสินค้าให้ได้ — รูปเป็นของแถม ไม่ใช่เงื่อนไข
  let imageUrl: string | undefined;
  if (data.image) {
    try {
      imageUrl = await uploadDataUrlToStorage(`products/${id}.jpg`, data.image);
    } catch {
      /* ไม่มีรูปก็ขายได้ */
    }
  }

  const product: ProductRecord = {
    id,
    name,
    category,
    price,
    imageUrl,
    stockCount,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    const row = {
      id: product.id,
      tenant_id: requireTenantId(),
      name: product.name,
      category: product.category,
      price: product.price,
      image_url: product.imageUrl || null,
      stock_count: product.stockCount,
      active: true,
      created_at: product.createdAt,
    };
    const { error } = await sb.from("products").insert(row);
    if (error) {
      // ร้านที่ยังไม่เคยรัน migration นี้ — ตารางยังไม่มี ซ่อมให้เองแล้วลองใหม่ 1 ครั้ง
      const { ensureMigration } = await import("./migrations");
      const healed = await ensureMigration("products.table");
      if (!healed) return null;
      const retry = await sb.from("products").insert(row);
      if (retry.error) return null;
    }
  } else {
    memProducts.push(product);
  }
  return product;
}

/** เปลี่ยน/ลบรูปสินค้า — image ว่าง = เอารูปออก */
export async function setProductImage(id: string, image: string) {
  let imageUrl: string | null = null;
  if (image) {
    try {
      imageUrl = await uploadDataUrlToStorage(`products/${id}.jpg`, image);
    } catch {
      return { ok: false as const, error: "upload_failed" };
    }
  }
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("products")
      .update({ image_url: imageUrl })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
    if (error) return { ok: false as const, error: "write_failed" };
  } else {
    const p = memProducts.find((x) => x.id === id);
    if (p) p.imageUrl = imageUrl || undefined;
  }
  return { ok: true as const };
}

/** แก้ไขสินค้า — ชื่อ/หมวดหมู่/ราคา/เปิดปิดขาย (รูปแยกไปที่ setProductImage, สต็อกแยกไปที่ adjustProductStock) */
export async function updateProduct(
  id: string,
  data: { name?: string; category?: string; price?: number; active?: boolean }
) {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) return { ok: false as const, error: "name_required" };
    patch.name = name;
  }
  if (data.category !== undefined) patch.category = data.category.trim();
  if (data.price !== undefined) patch.price = Math.max(0, Math.round(data.price) || 0);
  if (data.active !== undefined) patch.active = data.active;
  if (Object.keys(patch).length === 0) return { ok: true as const };

  const sb = getSupabase();
  if (sb) {
    await sb.from("products").update(patch).eq("id", id).eq("tenant_id", requireTenantId());
  } else {
    const p = memProducts.find((x) => x.id === id);
    if (p) {
      if (patch.name !== undefined) p.name = patch.name as string;
      if (patch.category !== undefined) p.category = patch.category as string;
      if (patch.price !== undefined) p.price = patch.price as number;
      if (patch.active !== undefined) p.active = patch.active as boolean;
    }
  }
  return { ok: true as const };
}

export async function setProductActive(id: string, active: boolean) {
  return updateProduct(id, { active });
}

export async function deleteProduct(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb.from("products").delete().eq("id", id).eq("tenant_id", requireTenantId());
  } else {
    const i = memProducts.findIndex((x) => x.id === id);
    if (i >= 0) memProducts.splice(i, 1);
  }
  return { ok: true as const };
}

/**
 * เปลี่ยนสต็อก (+เพิ่มตอนเติมของ / -ลดตอนขาย) — เรียกจาก markInvoicePaid/revertInvoicePaid
 * เป็นหลัก (ดู invoices-store.ts) กับปุ่ม "เติมสต็อก" ของแอดมินที่เรียกตรง
 * ไม่ยอมให้ติดลบ — ถ้าสต็อกไม่พอตอนขาย ลดได้แค่เท่าที่มี กันเลขติดลบดูแปลกในหน้าจัดการสินค้า
 */
export async function adjustProductStock(
  id: string,
  delta: number
): Promise<{ ok: boolean; stockCount: number }> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("products")
      .select("stock_count")
      .eq("id", id)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();
    const current = Number((data as { stock_count?: number } | null)?.stock_count) || 0;
    const next = Math.max(0, current + Math.round(delta));
    const { error } = await sb
      .from("products")
      .update({ stock_count: next })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
    if (error) return { ok: false, stockCount: current };
    return { ok: true, stockCount: next };
  }
  const p = memProducts.find((x) => x.id === id);
  if (!p) return { ok: false, stockCount: 0 };
  p.stockCount = Math.max(0, p.stockCount + Math.round(delta));
  return { ok: true, stockCount: p.stockCount };
}
