import { getSupabase } from "./supabase/server";
import { addFinanceEntry } from "./finance-store";
import { requireTenantId } from "./tenant-context";

export type CustomerPackage = {
  id: string;
  customerId: string;
  name: string;
  totalUses: number;
  usedUses: number;
  price: number;
  status: "active" | "done" | "cancelled";
  createdAt: string;
};

type PackageRow = {
  id: string;
  customer_id: string | null;
  name: string | null;
  total_uses: number;
  used_uses: number;
  price: number;
  status: string;
  created_at: string;
};

const mem: CustomerPackage[] = [];

function rowToPackage(r: PackageRow): CustomerPackage {
  return {
    id: r.id,
    customerId: r.customer_id || "",
    name: r.name || "",
    totalUses: Number(r.total_uses) || 0,
    usedUses: Number(r.used_uses) || 0,
    price: Number(r.price) || 0,
    status: r.status as CustomerPackage["status"],
    createdAt: r.created_at,
  };
}

/** ขายคอร์สให้ลูกค้า — สร้างคอร์ส + ลงรายรับ (จ่ายเต็มตอนซื้อ) */
export async function sellPackage(data: {
  customerId: string;
  customerName?: string;
  name: string;
  totalUses: number;
  price: number;
}): Promise<CustomerPackage> {
  const pkg: CustomerPackage = {
    id: `PKG${Date.now()}${Math.floor(Math.random() * 1000)}`,
    customerId: data.customerId,
    name: data.name,
    totalUses: Math.max(1, Math.round(data.totalUses) || 1),
    usedUses: 0,
    price: Math.round(data.price) || 0,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("customer_packages").insert({
      id: pkg.id,
      tenant_id: requireTenantId(),
      customer_id: pkg.customerId,
      name: pkg.name,
      total_uses: pkg.totalUses,
      used_uses: 0,
      price: pkg.price,
      status: "active",
      created_at: pkg.createdAt,
    });
  } else {
    mem.unshift(pkg);
  }

  if (pkg.price > 0) {
    await addFinanceEntry({
      type: "income",
      amount: pkg.price,
      category: "คอร์ส/แพ็กเกจ",
      description: `${data.customerName || pkg.customerId} — ${pkg.name} (${pkg.totalUses} ครั้ง)`,
      date: pkg.createdAt.slice(0, 10),
      customerId: pkg.customerId,
    });
  }
  return pkg;
}

export async function listCustomerPackages(customerId: string): Promise<CustomerPackage[]> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("customer_packages")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", requireTenantId())
      .order("created_at", { ascending: false });
    return ((data as PackageRow[] | null) || []).map(rowToPackage);
  }
  return mem.filter((p) => p.customerId === customerId);
}

/** คอร์สทุกใบ ทุกลูกค้า — ใช้สำหรับสำรองข้อมูลทั้งร้าน (ลูกค้าจ่ายเงินซื้อไว้ ห้ามหาย) */
export async function listAllPackages(): Promise<CustomerPackage[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("customer_packages")
        .select("*")
        .eq("tenant_id", requireTenantId())
        .order("created_at", { ascending: false });
      if (error) return [];
      return ((data as PackageRow[] | null) || []).map(rowToPackage);
    } catch {
      return [];
    }
  }
  return [...mem];
}

/** คอร์สที่ยังใช้ได้ (active + ยังเหลือครั้ง) */
export async function activeCustomerPackages(customerId: string) {
  return (await listCustomerPackages(customerId)).filter(
    (p) => p.status === "active" && p.usedUses < p.totalUses
  );
}

export async function getPackage(id: string): Promise<CustomerPackage | undefined> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("customer_packages")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();
    return data ? rowToPackage(data as PackageRow) : undefined;
  }
  return mem.find((p) => p.id === id);
}

/** หัก 1 ครั้งจากคอร์ส (ใช้ตอนคิดบิล) */
export async function consumePackage(id: string) {
  const p = await getPackage(id);
  if (!p) return { ok: false as const, error: "not_found" };
  if (p.status !== "active" || p.usedUses >= p.totalUses) {
    return { ok: false as const, error: "no_uses_left", pkg: p };
  }
  const used = p.usedUses + 1;
  const status = used >= p.totalUses ? "done" : "active";
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("customer_packages")
      .update({ used_uses: used, status })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const m = mem.find((x) => x.id === id);
    if (m) {
      m.usedUses = used;
      m.status = status;
    }
  }
  return { ok: true as const, remaining: p.totalUses - used, pkg: { ...p, usedUses: used, status } };
}

/** คืน 1 ครั้ง (เช่นยกเลิกบิลที่หักคอร์ส) */
export async function refundPackageUse(id: string) {
  const p = await getPackage(id);
  if (!p || p.usedUses <= 0) return;
  const used = p.usedUses - 1;
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("customer_packages")
      .update({ used_uses: used, status: "active" })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const m = mem.find((x) => x.id === id);
    if (m) {
      m.usedUses = used;
      m.status = "active";
    }
  }
}

export async function cancelPackage(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("customer_packages")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const m = mem.find((p) => p.id === id);
    if (m) m.status = "cancelled";
  }
  return { ok: true as const };
}
