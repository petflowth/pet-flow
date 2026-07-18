import { getSupabase } from "./supabase/server";

/**
 * บัญชีพนักงาน — เจ้าของสร้างให้ พร้อมเลือกเมนูที่พนักงานคนนั้นมองเห็นได้
 * รหัสเข้าใช้เก็บในตาราง staff_users (ไม่อยู่ใน site config ที่เปิด public)
 */

export type StaffUser = {
  id: string;
  name: string;
  /** รหัสเข้าใช้งานของพนักงานคนนี้ (ใช้แทนรหัสเจ้าของ) */
  code: string;
  /** เมนูที่เห็นได้ — เก็บเป็น href ของแท็บ เช่น "/admin/billing" */
  menus: string[];
  active: boolean;
  createdAt: string;
};

type StaffRow = {
  id: string;
  name: string;
  code: string;
  menus: string[] | null;
  active: boolean;
  created_at: string;
};

const mem: StaffUser[] = [];

function rowToStaff(r: StaffRow): StaffUser {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    menus: Array.isArray(r.menus) ? r.menus : [],
    active: r.active !== false,
    createdAt: r.created_at,
  };
}

export async function listStaff(): Promise<StaffUser[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("staff_users")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) return [];
      return ((data as StaffRow[] | null) || []).map(rowToStaff);
    } catch {
      return [];
    }
  }
  return [...mem];
}

export async function addStaff(data: {
  name: string;
  code: string;
  menus: string[];
}): Promise<{ ok: true; staff: StaffUser } | { ok: false; error: string }> {
  const name = data.name.trim();
  const code = data.code.trim();
  if (!name || !code) return { ok: false, error: "missing_fields" };
  if (code.length < 4) return { ok: false, error: "code_too_short" };

  const existing = await listStaff();
  if (existing.some((s) => s.code === code)) {
    return { ok: false, error: "code_in_use" };
  }

  const staff: StaffUser = {
    id: `ST${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    name,
    code,
    menus: data.menus,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("staff_users").insert({
        id: staff.id,
        name: staff.name,
        code: staff.code,
        menus: staff.menus,
        active: true,
        created_at: staff.createdAt,
      });
      if (error) return { ok: false, error: "need_sql" };
    } catch {
      return { ok: false, error: "need_sql" };
    }
  } else {
    mem.push(staff);
  }
  return { ok: true, staff };
}

export async function updateStaff(
  id: string,
  patch: Partial<Pick<StaffUser, "name" | "code" | "menus" | "active">>
) {
  const sb = getSupabase();
  if (sb) {
    try {
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name.trim();
      if (patch.code !== undefined) row.code = patch.code.trim();
      if (patch.menus !== undefined) row.menus = patch.menus;
      if (patch.active !== undefined) row.active = patch.active;
      const { error } = await sb.from("staff_users").update(row).eq("id", id);
      if (error) return { ok: false as const, error: "need_sql" };
    } catch {
      return { ok: false as const, error: "need_sql" };
    }
  } else {
    const s = mem.find((x) => x.id === id);
    if (!s) return { ok: false as const, error: "not_found" };
    Object.assign(s, patch);
  }
  return { ok: true as const };
}

export async function deleteStaff(id: string) {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("staff_users").delete().eq("id", id);
    } catch {
      /* ตารางยังไม่มี — ไม่มีอะไรให้ลบ */
    }
  } else {
    const i = mem.findIndex((x) => x.id === id);
    if (i >= 0) mem.splice(i, 1);
  }
  return { ok: true as const };
}

/** เช็ครหัสพนักงานตอนล็อกอิน — คืนข้อมูลสิทธิ์ถ้าเจอและยังเปิดใช้งาน */
export async function verifyStaffCode(code: string): Promise<StaffUser | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const all = await listStaff();
  return all.find((s) => s.code === trimmed && s.active) || null;
}
