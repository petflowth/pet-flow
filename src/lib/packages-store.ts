import { getSupabase } from "./supabase/server";
import { addFinanceEntry } from "./finance-store";
import { requireTenantId } from "./tenant-context";

/**
 * คอร์สของลูกค้า — นับเป็น "หน่วย" ที่เหลือ (totalUses/usedUses)
 * unit บอกว่า 1 หน่วยหมายถึงอะไร: ครั้ง (อาบน้ำ 1 ครั้ง) หรือ คืน (เข้าพัก 1 คืน)
 * คอร์สแบบคืนหักตามจำนวนคืนที่พักจริง เช่น พัก 5 คืน = หัก 5 หน่วย
 */
export type PackageUnit = "use" | "night";

export type CustomerPackage = {
  id: string;
  customerId: string;
  name: string;
  totalUses: number;
  usedUses: number;
  price: number;
  status: "active" | "done" | "cancelled";
  createdAt: string;
  /** ไม่ระบุ = "use" (คอร์สเดิมทั้งหมดเป็นแบบนับครั้ง) */
  unit?: PackageUnit;
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
  unit?: string | null;
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
    unit: r.unit === "night" ? "night" : "use",
  };
}

/** ขายคอร์สให้ลูกค้า — สร้างคอร์ส + ลงรายรับ (จ่ายเต็มตอนซื้อ) */
export async function sellPackage(data: {
  customerId: string;
  customerName?: string;
  name: string;
  totalUses: number;
  price: number;
  /** ครั้ง หรือ คืน (ไม่ระบุ = ครั้ง) */
  unit?: PackageUnit;
  /** คอร์สที่ยกมาจากระบบเก่า — ลูกค้าได้สิทธิ์ตามปกติ แต่ไม่ใช่รายรับของร้านเดือนนี้ */
  isLegacy?: boolean;
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
    unit: data.unit === "night" ? "night" : "use",
  };

  const sb = getSupabase();
  if (sb) {
    const row = {
      id: pkg.id,
      tenant_id: requireTenantId(),
      customer_id: pkg.customerId,
      name: pkg.name,
      total_uses: pkg.totalUses,
      used_uses: 0,
      price: pkg.price,
      status: "active",
      created_at: pkg.createdAt,
    };
    // คอลัมน์ unit เพิ่มมาทีหลัง — ลองใส่ก่อน ถ้าเครื่องยังไม่ได้อัปเดตฐานข้อมูล
    // ให้ตกไปเขียนแบบเดิม (คอร์สยังขายได้ แค่ถือเป็นแบบนับครั้ง)
    const { error } = await sb
      .from("customer_packages")
      .insert({ ...row, unit: pkg.unit });
    if (error) await sb.from("customer_packages").insert(row);
  } else {
    mem.unshift(pkg);
  }

  // ยกมาจากระบบเก่า: ลูกค้าได้ครั้งครบ แต่เงินรับไปตั้งแต่ระบบเดิมแล้ว
  // ไม่ลงรายรับซ้ำ กันยอดขายเดือนนี้บวมจากเงินที่ไม่ได้รับจริง
  if (pkg.price > 0 && !data.isLegacy) {
    await addFinanceEntry({
      type: "income",
      amount: pkg.price,
      category: "คอร์ส/แพ็กเกจ",
      description: `${data.customerName || pkg.customerId} — ${pkg.name} (${pkg.totalUses} ${
        pkg.unit === "night" ? "คืน" : "ครั้ง"
      })`,
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
/**
 * หักคอร์ส — qty หน่วย (คอร์สแบบคืนหักตามจำนวนคืนที่พัก)
 * หักไม่ครบตามที่ขอถือว่าไม่สำเร็จ เพราะบิลคิดส่วนลดไว้ตามจำนวนที่ขอไปแล้ว
 */
export async function consumePackage(id: string, qty = 1) {
  const need = Math.max(1, Math.round(qty) || 1);
  const p = await getPackage(id);
  if (!p) return { ok: false as const, error: "not_found" };
  if (p.status !== "active" || p.totalUses - p.usedUses < need) {
    return { ok: false as const, error: "no_uses_left", pkg: p };
  }
  const used = p.usedUses + need;
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

/** คืนหน่วยที่หักไป (เช่นยกเลิกบิลที่หักคอร์ส) — ต้องคืนเท่าที่หักไปจริง */
export async function refundPackageUse(id: string, qty = 1) {
  const p = await getPackage(id);
  if (!p || p.usedUses <= 0) return;
  const used = Math.max(0, p.usedUses - Math.max(1, Math.round(qty) || 1));
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
