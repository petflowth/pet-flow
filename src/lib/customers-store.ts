import { bookingMatchesCustomer, datesForBooking, isUpcomingBooking } from "./booking-customer-match";
import type { Booking } from "./business";
import {
  computeTier,
  DEFAULT_TIER_RULES,
  type CustomerTier,
} from "./customer-tier";
import { listBookings } from "./bookings-store";
import { getAccount, getPointsHistory } from "./points-store";
import { getSupabase } from "./supabase/server";
import { seedEnabled } from "./demo-seed";
import { uploadDataUrlToStorage } from "./supabase/storage";
import { getSiteConfig } from "./config-store";
import { requireTenantId } from "./tenant-context";

export type { CustomerTier } from "./customer-tier";

export type CatGender = "male" | "female";

export type CatRecord = {
  id: string;
  name: string;
  gender?: CatGender;
  breed?: string;
  /** อายุที่ระบุ ณ วันสมัคร (ใช้คู่กับ ageUnit + ageAsOf เพื่อคำนวณอายุปัจจุบัน) */
  ageValue?: number;
  ageUnit?: "year" | "month";
  ageAsOf?: string;
  birthday?: string;
  medical?: string;
  /** ขนสั้น/ขนยาว — ถามพร้อมสายพันธุ์ตอนสมัครสมาชิก */
  furLength?: "short" | "long";
  /** สี/ลักษณะเด่น — ถามตอนสมัครสมาชิก */
  color?: string;
  photoDataUrl?: string;
  staffNote?: string;
  /** โน้ตลับของร้าน — ซ่อนจากลูกค้า (ต้องรัน OVERNIGHT_SQL.md ก่อนถึงจะเซฟได้) */
  staffPrivateNote?: string;
  /** ประวัติน้องก่อนอาบน้ำ (JSON) — เก็บถาวรที่แมว ถามครั้งแรกครั้งเดียว */
  groomHealthInfo?: string;
  /** อัลบั้มรูป/วิดีโออ้างอิงหน้าตา-นิสัยแมว — เก็บหลังบ้านเท่านั้น ลูกค้าไม่เห็น (ต้องรัน migration cats.media ก่อน) */
  media?: CatMediaItem[];
};

export type CatMediaItem = {
  id: string;
  type: "photo" | "video";
  dataUrl: string;
  caption?: string;
  createdAt: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birthday?: string;
  lineUserId?: string;
  /**
   * LINE User ID ทุกตัวของลูกค้าคนนี้ — LINE ให้ ID คนละตัวได้บนคอม (LIFF) กับมือถือ
   * ถ้า LIFF app กับ OA คนละ Provider เก็บทุกตัวไว้ที่นี่ ลูกค้าคนเดียวจะไม่แตกเป็นหลาย record
   */
  lineUserIds?: string[];
  /** ชื่อจากโปรไฟล์ LINE — อัปเดตอัตโนมัติ ไม่ทับชื่อที่ร้านตั้ง */
  lineDisplayName?: string;
  /** ยินยอมรับข่าวสาร/โปรโมชั่น — ถ้า false จะไม่ส่งโปรหา (แต่ยืนยันนัด/จ่ายเงินยังส่งได้) */
  marketingConsent: boolean;
  /** รู้จักร้านจากทางไหน */
  referralSource?: string;
  /** ที่อยู่บ้าน (พิมพ์เอง) — ไว้ใช้บริการรับ-ส่ง ไม่ต้องถามซ้ำทุกครั้ง */
  address?: string;
  /** ลิงก์ Google Maps ปักหมุดบ้านลูกค้า */
  addressMapUrl?: string;
  /** รหัสไปรษณีย์ — ไว้ดูว่าลูกค้าส่วนใหญ่อยู่แถวไหนสำหรับทำการตลาด */
  postalCode?: string;
  /** รหัสชวนเพื่อนของลูกค้าคนนี้ (แชร์ให้เพื่อนสมัคร) */
  referralCode?: string;
  /** ถูกชวนมาโดยลูกค้ารหัสนี้ (กันออกคูปองซ้ำ) */
  referredBy?: string;
  cats: CatRecord[];
  isMember: boolean;
  memberCredit: number;
  /** มัดจำล่วงหน้าคงเหลือ — หักออกจากบิลถัดไปอัตโนมัติ (ต้องรัน OVERNIGHT_SQL.md) */
  depositCredit: number;
  /** ลบแบบกู้คืนได้ (soft delete) */
  deletedAt?: string;
  memberSince?: string;
  tier: CustomerTier;
  /** วันที่ส่งข้อความตามลูกค้าครั้งล่าสุด */
  lastFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRecord = {
  id: string;
  customerId: string;
  catName: string;
  service: string;
  date: string;
  time?: string;
  amount?: number;
  invoiceId?: string;
  bookingId?: string;
  at: string;
};

/** ประวัติเติมเครดิต Member — แยกเงินที่รับจริง vs แถม */
export type MemberTopupRecord = {
  id: string;
  customerId: string;
  paidAmount: number;
  bonusAmount: number;
  creditAdded: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
  /** ยอดยกมาจากระบบเก่า — เติมเครดิตให้ลูกค้าจริง แต่ไม่ใช่รายรับของร้านเดือนนี้ */
  isLegacy?: boolean;
};

/** รายการใช้เครดิต Member จ่ายบิล */
export type MemberCreditUsageRecord = {
  id: string;
  customerId: string;
  amount: number;
  description: string;
  date: string;
  at: string;
};

type CatRow = {
  id: string;
  customer_id: string;
  name: string;
  gender: string | null;
  breed: string | null;
  age: string | null;
  age_value: number | null;
  age_unit: string | null;
  age_as_of: string | null;
  birthday: string | null;
  medical: string | null;
  fur_length?: string | null;
  color?: string | null;
  photo_data_url: string | null;
  staff_note: string | null;
  staff_private_note?: string | null;
  groom_health_info?: string | null;
  media?: CatMediaItem[] | null;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  line_user_id: string | null;
  line_user_ids?: string[] | null;
  line_display_name: string | null;
  marketing_consent: boolean | null;
  referral_source: string | null;
  address?: string | null;
  address_map_url?: string | null;
  postal_code?: string | null;
  referral_code?: string | null;
  referred_by?: string | null;
  is_member: boolean;
  member_credit: number;
  deposit_credit?: number | null;
  member_since: string | null;
  tier: string | null;
  last_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  cats?: CatRow[];
};

type ServiceRow = {
  id: string;
  customer_id: string;
  cat_name: string;
  service: string;
  date: string;
  time: string | null;
  amount: number | null;
  invoice_id: string | null;
  booking_id: string | null;
  created_at: string;
};

type MemberTopupRow = {
  id: string;
  customer_id: string;
  paid_amount: number;
  bonus_amount: number;
  credit_added: number;
  balance_after: number;
  note: string | null;
  created_at: string;
  is_legacy?: boolean | null;
};

const memCustomers = new Map<string, CustomerRecord>();
const memServices: ServiceRecord[] = [];
const memMemberTopups: MemberTopupRecord[] = [];

function seedMem() {
  if (!seedEnabled()) return;
  const c: CustomerRecord = {
    id: "C001",
    name: "คุณมาย",
    lineUserId: "dev-user",
    marketingConsent: true,
    cats: [{ id: "CAT001", name: "น้องส้ม", staffNote: "อาบง่าย ไม่ดุ" }],
    isMember: false,
    memberCredit: 0,
    depositCredit: 0,
    tier: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  memCustomers.set(c.id, c);
}
seedMem();

function mapCustomer(row: CustomerRow): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    birthday: row.birthday ?? undefined,
    lineUserId: row.line_user_id ?? undefined,
    lineUserIds: row.line_user_ids ?? undefined,
    lineDisplayName: row.line_display_name ?? undefined,
    marketingConsent: row.marketing_consent !== false,
    referralSource: row.referral_source ?? undefined,
    address: row.address ?? undefined,
    addressMapUrl: row.address_map_url ?? undefined,
    postalCode: row.postal_code ?? undefined,
    referralCode: row.referral_code ?? undefined,
    referredBy: row.referred_by ?? undefined,
    isMember: row.is_member,
    memberCredit: Number(row.member_credit),
    depositCredit: Number(row.deposit_credit) || 0,
    deletedAt: row.deleted_at ?? undefined,
    memberSince: row.member_since ?? undefined,
    tier: (row.tier as CustomerTier) || "new",
    lastFollowUpAt: row.last_follow_up_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cats: (row.cats || []).map((c) => ({
      id: c.id,
      name: c.name,
      gender: (c.gender as CatGender) ?? undefined,
      breed: c.breed ?? undefined,
      ageValue: c.age_value ?? undefined,
      ageUnit: (c.age_unit as "year" | "month") ?? undefined,
      ageAsOf: c.age_as_of ?? undefined,
      birthday: c.birthday ?? undefined,
      medical: c.medical ?? undefined,
      furLength: (c.fur_length as "short" | "long" | undefined) ?? undefined,
      color: c.color ?? undefined,
      photoDataUrl: c.photo_data_url ?? undefined,
      staffNote: c.staff_note ?? undefined,
      staffPrivateNote: c.staff_private_note ?? undefined,
      groomHealthInfo: c.groom_health_info ?? undefined,
      media: Array.isArray(c.media) ? c.media : undefined,
    })),
  };
}

async function fetchAllCustomers(
  includeDeleted = false
): Promise<CustomerRecord[]> {
  const sb = getSupabase();
  let all: CustomerRecord[];
  if (sb) {
    const { data } = await sb
      .from("customers")
      .select("*, cats(*)")
      .eq("tenant_id", requireTenantId())
      .order("updated_at", { ascending: false });
    all = ((data as CustomerRow[] | null) || []).map(mapCustomer);
  } else {
    all = [...memCustomers.values()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }
  return includeDeleted ? all : all.filter((c) => !c.deletedAt);
}

/** ลูกค้าที่ถูกลบ (ถังขยะ) — กู้คืนได้ */
export async function listTrashedCustomers() {
  const all = await fetchAllCustomers(true);
  return all.filter((c) => c.deletedAt);
}

async function touchCustomer(id: string) {
  const sb = getSupabase();
  const now = new Date().toISOString();
  if (sb) {
    await sb
      .from("customers")
      .update({ updated_at: now })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const c = memCustomers.get(id);
    if (c) c.updatedAt = now;
  }
}

async function attachAppointmentCounts(customers: CustomerRecord[]) {
  const allBookings = await listBookings();
  return customers.map((c) => ({
    ...c,
    upcomingAppointments: allBookings.filter(
      (b) => bookingMatchesCustomer(b, c) && isUpcomingBooking(b)
    ).length,
  }));
}

export async function listCustomers() {
  return fetchAllCustomers();
}

export async function listCustomersWithAppointmentCounts() {
  return attachAppointmentCounts(await fetchAllCustomers());
}

export async function getCustomer(id: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("customers")
      .select("*, cats(*)")
      .eq("id", id)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();
    return data ? mapCustomer(data as CustomerRow) : undefined;
  }
  return memCustomers.get(id);
}

export async function findCustomerByLine(lineUserId: string) {
  const uid = (lineUserId || "").trim();
  if (!uid) return undefined;
  const sb = getSupabase();
  if (sb) {
    const tenantId = requireTenantId();
    // ค้นตรงจาก line_user_id (รวมที่ถูกลบนุ่ม) — ป้องกันกรณีหาไม่เจอแล้วไป insert ซ้ำ
    // จนชน unique constraint (customers_line_user_id_tenant_key)
    //
    // จับคู่ทั้ง line_user_id หลัก และรายการ line_user_ids ที่ผูกไว้ (คนละอุปกรณ์/Provider)
    // uid เป็น LINE User ID (ตัวอักษร+ตัวเลข) ปลอดภัยพอจะใส่ใน .or filter
    const safe = /^[A-Za-z0-9_-]+$/.test(uid);
    if (safe) {
      try {
        const { data, error } = await sb
          .from("customers")
          .select("*, cats(*)")
          .eq("tenant_id", tenantId)
          .or(`line_user_id.eq.${uid},line_user_ids.cs.{${uid}}`)
          .order("updated_at", { ascending: false })
          .limit(1);
        if (!error) {
          const row = (data as CustomerRow[] | null)?.[0];
          return row ? mapCustomer(row) : undefined;
        }
      } catch {
        /* ยังไม่มีคอลัมน์ line_user_ids — ตกไปใช้แบบเดิม */
      }
    }
    // สำรอง: จับคู่เฉพาะ line_user_id หลัก (เผื่อยังไม่รัน migration)
    const { data } = await sb
      .from("customers")
      .select("*, cats(*)")
      .eq("line_user_id", uid)
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const row = (data as CustomerRow[] | null)?.[0];
    return row ? mapCustomer(row) : undefined;
  }
  return [...memCustomers.values()].find(
    (c) => c.lineUserId === uid || (c.lineUserIds || []).includes(uid)
  );
}

/** รหัสชวนเพื่อนของลูกค้า — คิดจาก id แบบเสถียร (ไม่ต้องเก็บ DB) */
export function referralCodeFor(customerId: string): string {
  const s = customerId || "";
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return "CAT" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

/** หาลูกค้าจากรหัสชวนเพื่อน (สแกนเทียบรหัสที่คิดจาก id) */
export async function findCustomerByReferralCode(code: string) {
  const target = (code || "").trim().toUpperCase();
  if (!target) return undefined;
  const all = await fetchAllCustomers();
  return all.find((c) => referralCodeFor(c.id) === target);
}

/** บันทึกว่าลูกค้าถูกชวนมาโดยใคร (กันออกคูปองซ้ำ) — graceful */
export async function setReferredBy(customerId: string, referrerId: string) {
  const c = await getCustomer(customerId);
  if (!c) return;
  c.referredBy = referrerId;
  const sb = getSupabase();
  if (sb) {
    try {
      await sb
        .from("customers")
        .update({ referred_by: referrerId })
        .eq("id", customerId)
        .eq("tenant_id", requireTenantId());
    } catch {
      /* ยังไม่ได้ migrate — ข้าม */
    }
  } else {
    memCustomers.set(customerId, c);
  }
}

export async function searchCustomers(query: string) {
  const q = query.trim().toLowerCase();
  const all = await fetchAllCustomers();
  if (!q) return attachAppointmentCounts(all);
  const filtered = all.filter((c) => {
    const hay = [
      c.name,
      c.phone,
      c.lineUserId,
      c.lineDisplayName || "",
      ...c.cats.map((cat) => cat.name),
      ...c.cats.map((cat) => cat.staffNote || ""),
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
  return attachAppointmentCounts(filtered);
}

function normName(s: string) {
  return s.trim().toLowerCase();
}

/**
 * ตัดบรรทัด "ของแถมฟรี" (และบรรทัดเฉพาะการจอง) ออกจากโน้ตนิสัยแมว
 * โน้ตนิสัยเป็นข้อมูลถาวรของแมว ไม่ควรมีของแถมของบิลนั้นๆ ปนเข้ามา
 */
function cleanCatPersonalityNote(note?: string): string | undefined {
  if (!note) return note;
  const cleaned = note
    .split("\n")
    .filter((line) => !line.trim().startsWith("🎁"))
    .join("\n")
    .trim();
  return cleaned || undefined;
}

/** ลูกค้าเปิดแอปจาก LINE → สร้าง/ผูกบัญชีอัตโนมัติ */
export async function upsertCustomerFromLine(data: {
  lineUserId: string;
  displayName: string;
}) {
  const lineUserId = data.lineUserId.trim();
  const displayName = data.displayName.trim() || "ลูกค้า LINE";
  if (!lineUserId) return null;

  const sb = getSupabase();
  let existing = await findCustomerByLine(lineUserId);

  if (!existing) {
    const all = await fetchAllCustomers();
    // 1) ลูกค้าที่ร้านสร้างเองไว้ (ยังไม่ผูก LINE) แล้วชื่อตรงกับชื่อ LINE
    existing = all.find(
      (c) => !c.lineUserId && normName(c.name) === normName(displayName)
    );
    // 2) ลูกค้าที่ผูก LINE แล้วและ "ชื่อโปรไฟล์ LINE" ตรงกันเป๊ะ + มีคนเดียว —
    //    คือคนเดียวกันแต่ LINE ให้ User ID คนละตัว (คอม/มือถือคนละ Provider)
    //    → ผูก ID ใหม่เข้า record เดิม ไม่สร้างซ้ำ ไม่ให้แต้ม/คูปองแตก
    if (!existing) {
      const sameLine = all.filter(
        (c) =>
          c.lineDisplayName &&
          normName(c.lineDisplayName) === normName(displayName) &&
          !(c.lineUserIds || [c.lineUserId]).includes(lineUserId)
      );
      if (sameLine.length === 1) existing = sameLine[0];
    }
  }

  const now = new Date().toISOString();

  if (existing) {
    // รวม LINE ID ทุกตัวของลูกค้าคนนี้ (union) — ไม่ทิ้งตัวเก่า เพื่อให้ค้นเจอทุกอุปกรณ์
    const ids = new Set(
      [...(existing.lineUserIds || []), existing.lineUserId, lineUserId].filter(Boolean) as string[]
    );
    existing.lineUserIds = [...ids];
    existing.lineUserId = lineUserId;
    existing.lineDisplayName = displayName;
    // ไม่ทับชื่อที่ร้านตั้งเอง — อัปเดตแค่ชื่อ LINE
    existing.updatedAt = now;
    existing.deletedAt = undefined;
    if (sb) {
      await sb
        .from("customers")
        .update({
          line_user_id: lineUserId,
          line_display_name: displayName,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("tenant_id", requireTenantId());
      // เก็บ ID ทุกตัวแยก (คอลัมน์ใหม่) — ถ้ายังไม่รัน migration ก็ไม่พัง
      try {
        await sb
          .from("customers")
          .update({ line_user_ids: existing.lineUserIds })
          .eq("id", existing.id)
          .eq("tenant_id", requireTenantId());
      } catch {
        /* ยังไม่มีคอลัมน์ line_user_ids */
      }
      // ถ้าเคยถูกลบนุ่มไว้ — กู้คืน (best-effort, ถ้ายังไม่มีคอลัมน์ deleted_at ก็ไม่พัง)
      try {
        await sb
          .from("customers")
          .update({ deleted_at: null })
          .eq("id", existing.id)
          .eq("tenant_id", requireTenantId());
      } catch {
        /* ไม่มีคอลัมน์ deleted_at — ข้าม */
      }
    } else {
      memCustomers.set(existing.id, existing);
    }
    await linkBookingsToLineCustomer(existing);
    return existing;
  }

  // สุ่มท้าย id — id นี้ทำหน้าที่เป็น "โทเคนเชิญ" ในลิงก์ผูก LINE ถ้าเดาได้ = คนอื่นยึดบัญชีลูกค้าที่ยังไม่ผูกได้
  const id = `C${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
  const customer: CustomerRecord = {
    id,
    name: displayName,
    lineUserId,
    lineUserIds: [lineUserId],
    lineDisplayName: displayName,
    marketingConsent: true,
    cats: [],
    isMember: false,
    memberCredit: 0,
    depositCredit: 0,
    tier: "new",
    createdAt: now,
    updatedAt: now,
  };

  if (sb) {
    const { error } = await sb.from("customers").insert({
      id,
      tenant_id: requireTenantId(),
      name: displayName,
      line_user_id: lineUserId,
      line_display_name: displayName,
      is_member: false,
      member_credit: 0,
      tier: "new",
      created_at: now,
      updated_at: now,
    });
    if (error) {
      // เผยข้อผิดพลาดจริงแทนที่จะเงียบ (เดิมทำให้ลงทะเบียน "ไม่สำเร็จ" โดยไม่บอกสาเหตุ)
      throw new Error(`สร้างบัญชีลูกค้าไม่สำเร็จ: ${error.message}`);
    }
    try {
      await sb
        .from("customers")
        .update({ line_user_ids: [lineUserId] })
        .eq("id", id)
        .eq("tenant_id", requireTenantId());
    } catch {
      /* ยังไม่มีคอลัมน์ line_user_ids */
    }
  } else {
    memCustomers.set(id, customer);
  }

  await linkBookingsToLineCustomer(customer);
  return customer;
}

/** ผูก LINE กับลูกค้าที่ร้านสร้างไว้แล้ว (ลิงก์เชิญจากหลังบ้าน) */
export async function linkCustomerToLine(data: {
  customerId: string;
  lineUserId: string;
  displayName: string;
}) {
  const customerId = data.customerId.trim();
  const lineUserId = data.lineUserId.trim();
  const displayName = data.displayName.trim() || "ลูกค้า LINE";
  if (!customerId || !lineUserId) return null;

  const customer = await getCustomer(customerId);
  if (!customer) return { ok: false as const, error: "not_found" };

  if (customer.lineUserId && customer.lineUserId !== lineUserId) {
    return { ok: false as const, error: "already_linked" };
  }

  const other = await findCustomerByLine(lineUserId);
  if (other && other.id !== customerId) {
    return { ok: false as const, error: "line_in_use" };
  }

  customer.lineUserId = lineUserId;
  customer.lineDisplayName = displayName;
  customer.updatedAt = new Date().toISOString();

  const sb = getSupabase();
  if (sb) {
    await sb
      .from("customers")
      .update({
        line_user_id: lineUserId,
        line_display_name: displayName,
        updated_at: customer.updatedAt,
      })
      .eq("id", customerId)
      .eq("tenant_id", requireTenantId());
  } else {
    memCustomers.set(customerId, customer);
  }

  await linkBookingsToLineCustomer(customer);
  const refreshed = await getCustomer(customerId);
  if (refreshed) await recalculateCustomerTier(refreshed.id);
  return { ok: true as const, customer: refreshed || customer };
}

/** ข้อมูลย่อสำหรับหน้าผูก LINE */
export async function getCustomerLinkPreview(customerId: string) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    cats: c.cats.map((cat) => ({ id: cat.id, name: cat.name })),
    hasLine: Boolean(c.lineUserId),
  };
}

/** ผูกนัดเก่าที่ชื่อตรงแต่ยังไม่มี LINE ID */
async function linkBookingsToLineCustomer(customer: CustomerRecord) {
  if (!customer.lineUserId) return;
  const { listBookings, updateBooking } = await import("./bookings-store");
  const { bookingMatchesCustomer } = await import("./booking-customer-match");
  const bookings = await listBookings();
  for (const b of bookings) {
    if (b.lineUserId) continue;
    if (bookingMatchesCustomer(b, customer)) {
      await updateBooking(b.id, { lineUserId: customer.lineUserId });
    }
  }
}

export async function findCustomerByCatName(catName: string) {
  const q = normName(catName);
  if (!q) return [];
  return (await fetchAllCustomers()).filter((c) =>
    c.cats.some((cat) => normName(cat.name) === q)
  );
}

/** หาลูกค้าตอนบันทึกนัด — รู้แค่ชื่อแมวหรือชื่อ LINE ก็ได้ */
export async function resolveCustomerForBooking(data: {
  customerName?: string;
  catName: string;
  lineUserId?: string;
  customerId?: string;
  phone?: string;
  staffNote?: string;
}) {
  const catName = data.catName.trim();
  if (!catName) return null;

  let existing: CustomerRecord | undefined;

  if (data.customerId) {
    existing = await getCustomer(data.customerId);
  }
  if (!existing && data.lineUserId) {
    existing = await findCustomerByLine(data.lineUserId);
  }
  if (!existing && data.customerName?.trim()) {
    const name = data.customerName.trim();
    existing = (await fetchAllCustomers()).find(
      (c) =>
        normName(c.name) === normName(name) &&
        (c.cats.length === 0 ||
          c.cats.some((cat) => normName(cat.name) === normName(catName)))
    );
  }
  if (!existing) {
    const byCat = await findCustomerByCatName(catName);
    if (byCat.length === 1) {
      existing = byCat[0];
    } else if (byCat.length > 1 && data.customerName?.trim()) {
      existing = byCat.find(
        (c) => normName(c.name) === normName(data.customerName!.trim())
      );
    }
  }

  const customerName =
    existing?.name ||
    data.customerName?.trim() ||
    `ลูกค้า (${catName})`;
  const lineUserId = data.lineUserId || existing?.lineUserId;

  return upsertCustomerFromBooking({
    customerName,
    catName,
    lineUserId,
    phone: data.phone,
    staffNote: data.staffNote,
  });
}

export async function upsertCustomerFromBooking(data: {
  customerName: string;
  catName: string;
  lineUserId?: string;
  phone?: string;
  staffNote?: string;
}) {
  const sb = getSupabase();
  // โน้ตนิสัยแมว = ข้อมูลถาวร; ตัดของแถมของบิลนั้นๆ ออก ไม่ให้ปนลงข้อมูลแมว
  const catNote = cleanCatPersonalityNote(data.staffNote);
  let existing =
    (data.lineUserId && (await findCustomerByLine(data.lineUserId))) ||
    (await fetchAllCustomers()).find(
      (c) =>
        normName(c.name) === normName(data.customerName) &&
        (c.cats.length === 0 ||
          c.cats.some((cat) => normName(cat.name) === normName(data.catName)))
    );

  const now = new Date().toISOString();

  if (!existing) {
    // สุ่มท้าย id — id นี้ทำหน้าที่เป็น "โทเคนเชิญ" ในลิงก์ผูก LINE ถ้าเดาได้ = คนอื่นยึดบัญชีลูกค้าที่ยังไม่ผูกได้
  const id = `C${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    const catId = `CAT${Date.now()}`;
    existing = {
      id,
      name: data.customerName,
      phone: data.phone,
      lineUserId: data.lineUserId,
      marketingConsent: true,
      cats: [{ id: catId, name: data.catName, staffNote: catNote }],
      isMember: false,
      memberCredit: 0,
      depositCredit: 0,
      tier: "new",
      createdAt: now,
      updatedAt: now,
    };

    if (sb) {
      await sb.from("customers").insert({
        id,
        tenant_id: requireTenantId(),
        name: data.customerName,
        phone: data.phone || null,
        line_user_id: data.lineUserId || null,
        is_member: false,
        member_credit: 0,
        tier: "new",
        created_at: now,
        updated_at: now,
      });
      await sb.from("cats").insert({
        id: catId,
        tenant_id: requireTenantId(),
        customer_id: id,
        name: data.catName,
        staff_note: catNote || null,
      });
    } else {
      memCustomers.set(id, existing);
    }
    return existing;
  }

  if (data.lineUserId) existing.lineUserId = data.lineUserId;
  if (data.phone) existing.phone = data.phone;

  if (!existing.cats.some((cat) => cat.name === data.catName)) {
    const catId = `CAT${Date.now()}`;
    existing.cats.push({ id: catId, name: data.catName, staffNote: catNote });
    if (sb) {
      await sb.from("cats").insert({
        id: catId,
        tenant_id: requireTenantId(),
        customer_id: existing.id,
        name: data.catName,
        staff_note: catNote || null,
      });
    }
  } else if (catNote && !existing.cats.find((x) => x.name === data.catName)?.staffNote) {
    // เติมโน้ตนิสัยให้เฉพาะตอนแมวยังไม่มีโน้ตเท่านั้น
    // ห้ามให้การจองครั้งใหม่ไปทับโน้ตนิสัยเดิมที่ร้านตั้งไว้
    const cat = existing.cats.find((x) => x.name === data.catName);
    if (cat) {
      cat.staffNote = catNote;
      if (sb) {
        await sb
          .from("cats")
          .update({ staff_note: catNote })
          .eq("id", cat.id)
          .eq("tenant_id", requireTenantId());
      }
    }
  }

  existing.updatedAt = now;
  if (sb) {
    await sb
      .from("customers")
      .update({
        line_user_id: existing.lineUserId || null,
        phone: existing.phone || null,
        updated_at: now,
      })
      .eq("id", existing.id)
      .eq("tenant_id", requireTenantId());
  } else {
    memCustomers.set(existing.id, existing);
  }
  return existing;
}

export async function findCustomerForBooking(
  booking: Pick<Booking, "customerName" | "catName"> & { lineUserId?: string }
) {
  const all = await fetchAllCustomers();
  return all.find((c) => bookingMatchesCustomer(booking, c));
}

export async function updateCustomer(
  id: string,
  patch: Partial<
    Pick<
      CustomerRecord,
      | "name"
      | "phone"
      | "email"
      | "birthday"
      | "lineUserId"
      | "marketingConsent"
      | "referralSource"
      | "address"
      | "addressMapUrl"
      | "postalCode"
      | "isMember"
      | "memberCredit"
      | "memberSince"
      | "tier"
      | "lastFollowUpAt"
    >
  >
) {
  const c = await getCustomer(id);
  if (!c) return null;

  Object.assign(c, patch);
  if (patch.isMember && !c.memberSince) {
    c.memberSince = new Date().toISOString().slice(0, 10);
  }
  c.updatedAt = new Date().toISOString();

  const sb = getSupabase();
  if (sb) {
    await sb
      .from("customers")
      .update({
        name: c.name,
        phone: c.phone || null,
        email: c.email || null,
        birthday: c.birthday || null,
        line_user_id: c.lineUserId || null,
        line_display_name: c.lineDisplayName || null,
        marketing_consent: c.marketingConsent,
        referral_source: c.referralSource || null,
        is_member: c.isMember,
        member_credit: c.memberCredit,
        member_since: c.memberSince || null,
        tier: c.tier,
        last_follow_up_at: c.lastFollowUpAt || null,
        updated_at: c.updatedAt,
      })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
    if (
      patch.address !== undefined ||
      patch.addressMapUrl !== undefined ||
      patch.postalCode !== undefined
    ) {
      // คอลัมน์ใหม่ — best-effort เผื่อยังไม่ได้รัน migration
      await sb
        .from("customers")
        .update({
          address: c.address || null,
          address_map_url: c.addressMapUrl || null,
          postal_code: c.postalCode || null,
        })
        .eq("id", id)
        .eq("tenant_id", requireTenantId())
        .then(
          () => {},
          () => {}
        );
    }
  } else {
    memCustomers.set(id, c);
  }
  return c;
}

/**
 * ปรับยอดมัดจำล่วงหน้าของลูกค้า (+รับมัดจำ / −หักออกจากบิล).
 * เขียนเฉพาะคอลัมน์ deposit_credit + ครอบ try/catch — ถ้ายังไม่รัน OVERNIGHT_SQL.md
 * จะได้ need_sql โดยไม่ทำให้การบันทึกอื่นพัง.
 */
export async function adjustDepositCredit(customerId: string, delta: number) {
  const c = await getCustomer(customerId);
  if (!c) return { ok: false as const, error: "not_found" as const, balance: 0 };
  const next = Math.max(0, Math.round((c.depositCredit || 0) + delta));
  c.depositCredit = next;
  c.updatedAt = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("customers")
        .update({ deposit_credit: next })
        .eq("id", customerId)
        .eq("tenant_id", requireTenantId());
      if (error) {
        return { ok: false as const, error: "need_sql" as const, balance: next };
      }
    } catch {
      return { ok: false as const, error: "need_sql" as const, balance: next };
    }
  } else {
    memCustomers.set(customerId, c);
  }
  return { ok: true as const, balance: next };
}

export async function updateCat(
  customerId: string,
  catId: string,
  patch: Partial<
    Pick<
      CatRecord,
      | "name"
      | "photoDataUrl"
      | "staffNote"
      | "gender"
      | "breed"
      | "ageValue"
      | "ageUnit"
      | "birthday"
      | "medical"
      | "furLength"
      | "color"
    >
  >
) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  const cat = c.cats.find((x) => x.id === catId);
  if (!cat) return null;

  // เก็บรูปเป็นไฟล์ใน Supabase Storage แทนยัด base64 ลงฐานข้อมูลตรงๆ (ประหยัดพื้นที่ + bandwidth)
  if (patch.photoDataUrl?.startsWith("data:")) {
    patch = {
      ...patch,
      photoDataUrl: await uploadDataUrlToStorage(
        `cats/${catId}/profile-${Date.now()}`,
        patch.photoDataUrl
      ),
    };
  }

  Object.assign(cat, patch);
  // ถ้าแก้อายุ → อัปเดตวันที่อ้างอิงอายุเป็นวันนี้ (ไว้คำนวณอายุปัจจุบัน)
  if (patch.ageValue != null) {
    cat.ageAsOf = new Date().toISOString().slice(0, 10);
  }
  await touchCustomer(customerId);

  const sb = getSupabase();
  if (sb) {
    // เขียนคอลัมน์พื้นฐานเสมอ (ต้องสำเร็จ) แล้วค่อยเขียนรายละเอียดเพิ่ม (best-effort เผื่อยังไม่ migrate)
    await sb
      .from("cats")
      .update({
        name: cat.name,
        photo_data_url: cat.photoDataUrl || null,
        staff_note: cat.staffNote || null,
      })
      .eq("id", catId)
      .eq("tenant_id", requireTenantId());
    try {
      await sb
        .from("cats")
        .update({
          gender: cat.gender || null,
          breed: cat.breed || null,
          age_value: cat.ageValue ?? null,
          age_unit: cat.ageUnit || null,
          age_as_of: cat.ageAsOf || null,
          birthday: cat.birthday || null,
          medical: cat.medical || null,
          fur_length: cat.furLength || null,
          color: cat.color || null,
        })
        .eq("id", catId)
        .eq("tenant_id", requireTenantId());
    } catch {
      /* ยังไม่ได้ migrate คอลัมน์เพิ่ม — ข้าม (ชื่อ/โน้ตยังบันทึกได้) */
    }
  } else {
    memCustomers.set(customerId, c);
  }
  return c;
}

/** หาแมวของลูกค้าจาก LINE + ชื่อน้อง (ถ้าไม่เจอชื่อตรง ใช้ตัวแรก) */
async function resolveCatByLine(lineUserId: string, catName?: string) {
  const c = await findCustomerByLine(lineUserId);
  if (!c || c.cats.length === 0) return null;
  const cat =
    (catName && c.cats.find((x) => x.name === catName)) || c.cats[0];
  return { customerId: c.id, cat };
}

/** อ่านประวัติน้องก่อนอาบน้ำ ที่เก็บไว้ที่แมว (คืน undefined ถ้ายังไม่เคยกรอก) */
export async function getCatGroomInfo(lineUserId: string, catName?: string) {
  const r = await resolveCatByLine(lineUserId, catName);
  return r?.cat.groomHealthInfo;
}

/** บันทึกประวัติน้องก่อนอาบน้ำ ไว้ที่แมว (ถามครั้งแรกครั้งเดียว) — graceful */
export async function setCatGroomInfo(
  lineUserId: string,
  catName: string | undefined,
  infoJson: string
) {
  const r = await resolveCatByLine(lineUserId, catName);
  if (!r) return { ok: false as const, error: "not_found" };
  r.cat.groomHealthInfo = infoJson;
  await touchCustomer(r.customerId);
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("cats")
        .update({ groom_health_info: infoJson })
        .eq("id", r.cat.id)
        .eq("tenant_id", requireTenantId());
      if (error) return { ok: false as const, error: "need_sql", catName: r.cat.name };
    } catch {
      return { ok: false as const, error: "need_sql", catName: r.cat.name };
    }
  }
  return { ok: true as const, catName: r.cat.name };
}

export async function addCat(
  customerId: string,
  data: {
    name: string;
    gender?: CatGender;
    breed?: string;
    ageValue?: number;
    ageUnit?: "year" | "month";
    birthday?: string;
    medical?: string;
    furLength?: "short" | "long";
    color?: string;
    staffNote?: string;
  }
) {
  const name = data.name.trim();
  if (!name) return null;

  const c = await getCustomer(customerId);
  if (!c) return null;

  const hasAge = data.ageValue != null && !isNaN(data.ageValue);
  const today = new Date().toISOString().slice(0, 10);

  const catId = `CAT${Date.now()}`;
  const cat: CatRecord = {
    id: catId,
    name,
    gender: data.gender,
    breed: data.breed?.trim() || undefined,
    ageValue: hasAge ? data.ageValue : undefined,
    ageUnit: hasAge ? data.ageUnit || "year" : undefined,
    ageAsOf: hasAge ? today : undefined,
    birthday: data.birthday?.trim() || undefined,
    medical: data.medical?.trim() || undefined,
    furLength: data.furLength,
    color: data.color?.trim() || undefined,
    staffNote: data.staffNote?.trim() || undefined,
  };

  c.cats.push(cat);
  await touchCustomer(customerId);

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("cats").insert({
      id: catId,
      tenant_id: requireTenantId(),
      customer_id: customerId,
      name,
      gender: cat.gender || null,
      breed: cat.breed || null,
      age_value: cat.ageValue ?? null,
      age_unit: cat.ageUnit || null,
      age_as_of: cat.ageAsOf || null,
      birthday: cat.birthday || null,
      medical: cat.medical || null,
      staff_note: cat.staffNote || null,
    });
    if (error) throw new Error(error.message);
    if (cat.furLength || cat.color) {
      // คอลัมน์ใหม่ — best-effort เผื่อยังไม่ได้รัน migration
      await sb
        .from("cats")
        .update({ fur_length: cat.furLength || null, color: cat.color || null })
        .eq("id", catId)
        .eq("tenant_id", requireTenantId())
        .then(
          () => {},
          () => {}
        );
    }
  } else {
    memCustomers.set(customerId, c);
  }
  return c;
}

export async function deleteCat(customerId: string, catId: string) {
  const c = await getCustomer(customerId);
  if (!c) return null;

  const idx = c.cats.findIndex((x) => x.id === catId);
  if (idx < 0) return null;

  c.cats.splice(idx, 1);
  await touchCustomer(customerId);

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("cats")
      .delete()
      .eq("id", catId)
      .eq("tenant_id", requireTenantId());
    if (error) throw new Error(error.message);
  } else {
    memCustomers.set(customerId, c);
  }
  return c;
}

/** ลบลูกค้า (ย้ายลงถังขยะ กู้คืนได้) */
export async function deleteCustomer(customerId: string) {
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("customers")
        .update({ deleted_at: now })
        .eq("id", customerId)
        .eq("tenant_id", requireTenantId());
      if (error) throw new Error(error.message);
    } catch {
      // ยังไม่ได้รัน migration deleted_at → ลบจริง (cascade)
      await sb
        .from("customers")
        .delete()
        .eq("id", customerId)
        .eq("tenant_id", requireTenantId());
    }
  } else {
    const c = memCustomers.get(customerId);
    if (c) c.deletedAt = now;
  }
  return { ok: true as const };
}

/**
 * รวมลูกค้าซ้ำ 2 record เป็นอันเดียว — ย้ายทุกอย่างจาก source → target แล้วลบ source
 *
 * ใช้ตอนคนเดียวโดนแยกเป็น 2 บัญชี (LINE ให้ User ID คนละตัวคอม/มือถือ)
 * ย้าย: แต้ม · คูปอง · คอร์ส · บิล · เติมเครดิต · ประวัติบริการ · รายรับ · แมว · LINE ID
 */
export async function mergeCustomers(sourceId: string, targetId: string) {
  if (!sourceId || !targetId || sourceId === targetId) {
    return { ok: false as const, error: "bad_ids" };
  }
  const [source, target] = await Promise.all([getCustomer(sourceId), getCustomer(targetId)]);
  if (!source || !target) return { ok: false as const, error: "not_found" };

  const sb = getSupabase();
  if (sb) {
    const tenantId = requireTenantId();
    // ย้าย customer_id ทุกตารางที่อ้างถึง (best-effort — ตารางไหนไม่มีก็ข้าม)
    const tables = [
      "cats",
      "coupons",
      "customer_packages",
      "invoices",
      "member_topups",
      "service_records",
      "finance_records",
    ];
    for (const tbl of tables) {
      try {
        await sb
          .from(tbl)
          .update({ customer_id: targetId })
          .eq("customer_id", sourceId)
          .eq("tenant_id", tenantId);
      } catch {
        /* ตารางนี้ไม่มี customer_id หรือยังไม่มีตาราง — ข้าม */
      }
    }
    // รวมเครดิต Member + มัดจำล่วงหน้า เข้าปลายทาง
    const mergedCredit = (target.memberCredit || 0) + (source.memberCredit || 0);
    const mergedDeposit = (target.depositCredit || 0) + (source.depositCredit || 0);
    // รวม LINE ID ทุกตัวของทั้งคู่เข้าปลายทาง
    const ids = new Set(
      [
        ...(target.lineUserIds || []),
        target.lineUserId,
        ...(source.lineUserIds || []),
        source.lineUserId,
      ].filter(Boolean) as string[]
    );
    await sb
      .from("customers")
      .update({
        member_credit: mergedCredit,
        is_member: target.isMember || source.isMember,
      })
      .eq("id", targetId)
      .eq("tenant_id", tenantId);
    try {
      await sb
        .from("customers")
        .update({ deposit_credit: mergedDeposit })
        .eq("id", targetId)
        .eq("tenant_id", tenantId);
    } catch {
      /* ยังไม่มีคอลัมน์ deposit_credit */
    }
    try {
      await sb
        .from("customers")
        .update({ line_user_ids: [...ids] })
        .eq("id", targetId)
        .eq("tenant_id", tenantId);
    } catch {
      /* ยังไม่มีคอลัมน์ line_user_ids */
    }
  } else {
    // mem — ย้ายเท่าที่เก็บใน map นี้ได้ (dev)
    const t = memCustomers.get(targetId);
    const s = memCustomers.get(sourceId);
    if (t && s) {
      t.memberCredit = (t.memberCredit || 0) + (s.memberCredit || 0);
      t.depositCredit = (t.depositCredit || 0) + (s.depositCredit || 0);
      t.cats = [...t.cats, ...s.cats];
      const ids = new Set(
        [
          ...(t.lineUserIds || []),
          t.lineUserId,
          ...(s.lineUserIds || []),
          s.lineUserId,
        ].filter(Boolean) as string[]
      );
      t.lineUserIds = [...ids];
    }
  }

  // รวมแต้ม (คีย์ C:<id>) + คูปองในกระเป๋าเข้าปลายทาง
  try {
    const { mergePointsAccount } = await import("./points-store");
    await mergePointsAccount(sourceId, targetId);
  } catch {
    /* รวมแต้มไม่สำเร็จ — ส่วนอื่นย้ายแล้ว */
  }

  // ลบ record ต้นทางทิ้ง (soft delete)
  await deleteCustomer(sourceId);
  return { ok: true as const, targetId };
}

/** กู้ลูกค้าจากถังขยะ */
export async function restoreCustomer(customerId: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("customers")
      .update({ deleted_at: null })
      .eq("id", customerId)
      .eq("tenant_id", requireTenantId());
  } else {
    const c = memCustomers.get(customerId);
    if (c) c.deletedAt = undefined;
  }
  return { ok: true as const };
}

/**
 * บันทึกโน้ตลับของร้านต่อแมว (ซ่อนจากลูกค้า).
 * ต้องรัน OVERNIGHT_SQL.md (staff_private_note) ก่อนถึงจะบันทึกลง DB ได้ —
 * ถ้ายังไม่มีคอลัมน์ จะ return need_sql โดยไม่ทำให้หน้าแอดมินพัง.
 */
export async function updateCatPrivateNote(
  customerId: string,
  catId: string,
  note: string
) {
  const c = await getCustomer(customerId);
  if (!c) return { ok: false as const, error: "not_found" };
  const cat = c.cats.find((x) => x.id === catId);
  if (!cat) return { ok: false as const, error: "not_found" };
  const trimmed = note.trim();
  cat.staffPrivateNote = trimmed || undefined;
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("cats")
        .update({ staff_private_note: trimmed || null })
        .eq("id", catId)
        .eq("tenant_id", requireTenantId());
      if (error) {
        return { ok: false as const, error: "need_sql", message: error.message };
      }
    } catch (e) {
      return { ok: false as const, error: "need_sql", message: String(e) };
    }
  } else {
    memCustomers.set(customerId, c);
  }
  return { ok: true as const };
}

/**
 * บันทึกอัลบั้มรูป/วิดีโออ้างอิงของแมว (แทนที่ทั้งชุด — ฝั่งแอดมินส่ง array ที่แก้แล้วมา).
 * ต้องรัน migration "cats.media" ก่อนถึงจะบันทึกลง DB ได้ —
 * ถ้ายังไม่มีคอลัมน์ จะ return need_sql โดยไม่ทำให้หน้าแอดมินพัง.
 */
export async function updateCatMedia(
  customerId: string,
  catId: string,
  media: CatMediaItem[]
) {
  const c = await getCustomer(customerId);
  if (!c) return { ok: false as const, error: "not_found" };
  const cat = c.cats.find((x) => x.id === catId);
  if (!cat) return { ok: false as const, error: "not_found" };

  // เก็บรูป/วิดีโอในอัลบั้มเป็นไฟล์ใน Storage แทน base64 — วิดีโอเคยยัดลง jsonb ตรงๆ ได้ถึง 15MB/คลิป
  media = await Promise.all(
    media.map(async (m) =>
      m.dataUrl.startsWith("data:")
        ? { ...m, dataUrl: await uploadDataUrlToStorage(`cats/${catId}/media-${m.id}`, m.dataUrl) }
        : m
    )
  );

  cat.media = media;
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("cats")
        .update({ media })
        .eq("id", catId)
        .eq("tenant_id", requireTenantId());
      if (error) {
        return { ok: false as const, error: "need_sql", message: error.message };
      }
    } catch (e) {
      return { ok: false as const, error: "need_sql", message: String(e) };
    }
  } else {
    memCustomers.set(customerId, c);
  }
  return { ok: true as const };
}

export async function addMemberCredit(customerId: string, amount: number) {
  return topupMemberCredit(customerId, { paidAmount: amount, bonusAmount: 0 });
}

/**
 * ยกเลิกรายการเติมเครดิต — คืนยอดที่เติมออกจากเครดิตลูกค้า + ลบรายรับที่ลงไว้
 *
 * บล็อกไว้ถ้าลูกค้าใช้เครดิตไปบางส่วนแล้ว (ยอดคงเหลือน้อยกว่าที่จะถอน)
 * เพราะถ้าฝืนถอน เครดิตจะติดลบและตัวเลขจะเพี้ยนทั้งสาย —
 * เคสนั้นให้ยกเลิกบิลที่ใช้เครดิตก่อน (ซึ่งคืนเครดิตให้อยู่แล้ว) ค่อยมายกเลิกรายการเติม
 */
export async function cancelMemberTopup(topupId: string) {
  const sb = getSupabase();
  let topup: MemberTopupRecord | undefined;
  if (sb) {
    const { data } = await sb
      .from("member_topups")
      .select("*")
      .eq("id", topupId)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();
    if (data) {
      const r = data as MemberTopupRow;
      topup = {
        id: r.id,
        customerId: r.customer_id,
        paidAmount: Number(r.paid_amount),
        bonusAmount: Number(r.bonus_amount),
        creditAdded: Number(r.credit_added),
        balanceAfter: Number(r.balance_after),
        note: r.note ?? undefined,
        createdAt: r.created_at,
        isLegacy: r.is_legacy ?? false,
      };
    }
  } else {
    topup = memMemberTopups.find((t) => t.id === topupId);
  }
  if (!topup) return { ok: false as const, error: "not_found" };

  const c = await getCustomer(topup.customerId);
  if (!c) return { ok: false as const, error: "not_found" };
  if (c.memberCredit < topup.creditAdded) {
    return {
      ok: false as const,
      error: "credit_spent",
      balance: c.memberCredit,
      creditAdded: topup.creditAdded,
    };
  }

  const nextCredit = c.memberCredit - topup.creditAdded;
  await updateCustomer(topup.customerId, { memberCredit: nextCredit });

  // ลบรายรับที่ลงคู่กับการเติมครั้งนี้ — ยอดยกมาไม่เคยลงรายรับ จึงไม่ต้องหา
  if (!topup.isLegacy && topup.paidAmount > 0) {
    const { listFinance, deleteFinanceEntry } = await import("./finance-store");
    const all = await listFinance();
    const match = all.find(
      (r) =>
        r.type === "income" &&
        r.category === "member" &&
        r.customerId === topup!.customerId &&
        r.amount === topup!.paidAmount &&
        r.date === topup!.createdAt.slice(0, 10)
    );
    if (match) await deleteFinanceEntry(match.id);
  }

  if (sb) {
    await sb
      .from("member_topups")
      .delete()
      .eq("id", topupId)
      .eq("tenant_id", requireTenantId());
  } else {
    const i = memMemberTopups.findIndex((t) => t.id === topupId);
    if (i >= 0) memMemberTopups.splice(i, 1);
  }

  await recalculateCustomerTier(topup.customerId);
  return { ok: true as const, balance: nextCredit, creditRemoved: topup.creditAdded };
}

export async function topupMemberCredit(
  customerId: string,
  data: { paidAmount: number; bonusAmount?: number; note?: string; isLegacy?: boolean }
) {
  const paid = Math.max(0, Number(data.paidAmount) || 0);
  const bonus = Math.max(0, Number(data.bonusAmount) || 0);
  const creditAdded = paid + bonus;
  if (creditAdded <= 0) return null;

  const c = await getCustomer(customerId);
  if (!c) return null;

  c.memberCredit += creditAdded;
  c.isMember = true;
  if (!c.memberSince) c.memberSince = new Date().toISOString().slice(0, 10);

  const updated = await updateCustomer(customerId, {
    isMember: c.isMember,
    memberCredit: c.memberCredit,
    memberSince: c.memberSince,
  });
  if (!updated) return null;

  const isLegacy = Boolean(data.isLegacy);
  const topup: MemberTopupRecord = {
    id: `MT${Date.now()}`,
    customerId,
    paidAmount: paid,
    bonusAmount: bonus,
    creditAdded,
    balanceAfter: c.memberCredit,
    note: data.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
    isLegacy,
  };

  const sb = getSupabase();
  if (sb) {
    const row = {
      id: topup.id,
      tenant_id: requireTenantId(),
      customer_id: topup.customerId,
      paid_amount: topup.paidAmount,
      bonus_amount: topup.bonusAmount,
      credit_added: topup.creditAdded,
      balance_after: topup.balanceAfter,
      note: topup.note || null,
      created_at: topup.createdAt,
    };
    // is_legacy เพิ่งเพิ่มมาทีหลัง — ลองใส่ก่อน ถ้าเครื่องยังไม่อัปเดตฐานข้อมูล
    // (คอลัมน์ไม่มี) ให้ตกไปเขียนแบบเดิม กันบันทึกไม่สำเร็จทั้งก้อน
    const { error } = await sb
      .from("member_topups")
      .insert({ ...row, is_legacy: isLegacy });
    if (error) {
      await sb.from("member_topups").insert(row);
    }
  } else {
    memMemberTopups.unshift(topup);
  }

  // ยอดยกมาจากระบบเก่า: เครดิตลูกค้าต้องได้เพิ่มจริง แต่ไม่ใช่เงินที่รับเข้าร้านเดือนนี้
  // ไม่บันทึกรายรับ กันยอดขายบวมจากเงินที่ไม่ได้รับจริงในเดือนนี้
  if (paid > 0 && !isLegacy) {
    const { addFinanceEntry } = await import("./finance-store");
    const bonusLabel =
      bonus > 0 ? ` (แถม ${bonus.toLocaleString()} บาท)` : "";
    await addFinanceEntry({
      type: "income",
      amount: paid,
      category: "member",
      description: `เติม Member ${c.name} +${creditAdded.toLocaleString()} บาท${bonusLabel}`,
      date: topup.createdAt.slice(0, 10),
      customerId,
    });
  }

  await recalculateCustomerTier(customerId);
  return { customer: updated, topup };
}

export async function deductMemberCredit(customerId: string, amount: number) {
  const c = await getCustomer(customerId);
  if (!c || c.memberCredit < amount) return null;
  c.memberCredit -= amount;
  return updateCustomer(customerId, { memberCredit: c.memberCredit });
}

export async function addServiceRecord(
  data: Omit<ServiceRecord, "id" | "at"> & { at?: string }
) {
  const rec: ServiceRecord = {
    ...data,
    id: `S${Date.now()}`,
    at: data.at || new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("service_records").insert({
      id: rec.id,
      tenant_id: requireTenantId(),
      customer_id: rec.customerId,
      cat_name: rec.catName,
      service: rec.service,
      date: rec.date,
      time: rec.time || null,
      amount: rec.amount ?? null,
      invoice_id: rec.invoiceId || null,
      booking_id: rec.bookingId || null,
      created_at: rec.at,
    });
    await touchCustomer(rec.customerId);
    await recalculateCustomerTier(rec.customerId);
    return rec;
  }

  memServices.unshift(rec);
  await recalculateCustomerTier(rec.customerId);
  return rec;
}

/** ลบประวัติบริการที่ผูกกับบิล (ใช้ตอนยกเลิกการชำระ เพื่อไม่ให้จำนวนครั้งเกินจริง) */
export async function deleteServiceRecordByInvoice(invoiceId: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("service_records")
      .delete()
      .eq("invoice_id", invoiceId)
      .eq("tenant_id", requireTenantId());
  } else {
    for (let i = memServices.length - 1; i >= 0; i--) {
      if (memServices[i].invoiceId === invoiceId) memServices.splice(i, 1);
    }
  }
}

/**
 * ลบประวัติใช้บริการทีละรายการจากหลังบ้าน — เผื่อร้านลงข้อมูลผิด
 * ลบแล้วหายจากประวัติที่ลูกค้าเห็นในแอปด้วย (คนละเรื่องกับ deleteServiceRecordByInvoice
 * ที่ลบอัตโนมัติตอนยกเลิกการชำระ)
 */
export async function deleteServiceRecord(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("service_records")
      .delete()
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  } else {
    const i = memServices.findIndex((r) => r.id === id);
    if (i >= 0) memServices.splice(i, 1);
  }
  return { ok: true as const };
}

/** ทุกรายการ ทุกลูกค้า — ใช้สำหรับสำรองข้อมูลทั้งร้าน */
export async function listAllServiceRecords(): Promise<ServiceRecord[]> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("service_records")
      .select("*")
      .order("created_at", { ascending: false });
    return ((data as ServiceRow[] | null) || []).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      catName: r.cat_name,
      service: r.service,
      date: r.date,
      time: r.time || undefined,
      amount: r.amount != null ? Number(r.amount) : undefined,
      invoiceId: r.invoice_id || undefined,
      bookingId: r.booking_id || undefined,
      at: r.created_at,
    }));
  }
  return [...memServices];
}

async function listServiceRecords(customerId: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("service_records")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", requireTenantId())
      .order("created_at", { ascending: false });
    return ((data as ServiceRow[] | null) || []).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      catName: r.cat_name,
      service: r.service,
      date: r.date,
      time: r.time || undefined,
      amount: r.amount != null ? Number(r.amount) : undefined,
      invoiceId: r.invoice_id || undefined,
      bookingId: r.booking_id || undefined,
      at: r.created_at,
    }));
  }
  return memServices.filter((s) => s.customerId === customerId);
}

/** ทุกรายการเติมเครดิต ทุกลูกค้า — ใช้สำหรับสำรองข้อมูลทั้งร้าน */
export async function listAllMemberTopups(): Promise<MemberTopupRecord[]> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("member_topups")
      .select("*")
      .order("created_at", { ascending: false });
    return ((data as MemberTopupRow[] | null) || []).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      paidAmount: Number(r.paid_amount),
      bonusAmount: Number(r.bonus_amount),
      creditAdded: Number(r.credit_added),
      balanceAfter: Number(r.balance_after),
      note: r.note ?? undefined,
      createdAt: r.created_at,
      isLegacy: r.is_legacy ?? false,
    }));
  }
  return [...memMemberTopups];
}

async function listMemberTopups(customerId: string): Promise<MemberTopupRecord[]> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("member_topups")
      .select("*")
      .eq("customer_id", customerId)
      .eq("tenant_id", requireTenantId())
      .order("created_at", { ascending: false });
    return ((data as MemberTopupRow[] | null) || []).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      paidAmount: Number(r.paid_amount),
      bonusAmount: Number(r.bonus_amount),
      creditAdded: Number(r.credit_added),
      balanceAfter: Number(r.balance_after),
      note: r.note ?? undefined,
      createdAt: r.created_at,
      isLegacy: r.is_legacy ?? false,
    }));
  }
  return memMemberTopups.filter((t) => t.customerId === customerId);
}

async function listMemberCreditUsage(customerId: string): Promise<MemberCreditUsageRecord[]> {
  const { listInvoices } = await import("./invoices-store");
  const { summarizeInvoiceItems } = await import("./invoice-item-label");
  const invoices = await listInvoices(customerId);
  return invoices
    .filter((i) => i.status === "paid" && i.paymentMethod === "member_credit" && i.paidAt)
    .map((i) => {
      // ย่อรายการให้เหลือแค่ชื่อสั้นๆ ไม่ซ้ำ — บิลที่มีหลายตัว/หลายรายการจะได้ไม่ยาวจนอ่านไม่ไหว
      const summary = summarizeInvoiceItems(i.items);
      return {
        id: i.id,
        customerId: i.customerId,
        amount: i.total,
        description: `${i.catName} · ${summary}`,
        date: i.paidAt!.slice(0, 10),
        at: i.paidAt!,
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** ครั้งที่ลูกค้าใช้คอร์สไป — อ่านจากบิลที่จ่ายแล้วและผูกคอร์สไว้ */
export type PackageUsageRecord = {
  invoiceId: string;
  packageId: string;
  description: string;
  date: string;
  at: string;
};

async function listPackageUsage(customerId: string): Promise<PackageUsageRecord[]> {
  const { listInvoices } = await import("./invoices-store");
  const { summarizeInvoiceItems } = await import("./invoice-item-label");
  const invoices = await listInvoices(customerId);
  return invoices
    .filter((i) => i.packageId && i.status === "paid" && i.paidAt)
    .map((i) => ({
      invoiceId: i.id,
      packageId: i.packageId!,
      description: `${i.catName} · ${summarizeInvoiceItems(i.items)}`,
      date: i.paidAt!.slice(0, 10),
      at: i.paidAt!,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function getCustomerHistory(customerId: string) {
  const c = await getCustomer(customerId);
  const allBookings = await listBookings();
  const bookings = c
    ? allBookings.filter((b) => bookingMatchesCustomer(b, c))
    : [];
  const upcomingBookings = bookings.filter((b) => isUpcomingBooking(b));
  const pastBookings = bookings.filter((b) => !isUpcomingBooking(b));
  const services = await listServiceRecords(customerId);
  const points = c?.lineUserId ? await getPointsHistory(c.lineUserId) : [];
  const memberTopups = await listMemberTopups(customerId);
  const memberCreditUsage = await listMemberCreditUsage(customerId);
  const packageUsage = await listPackageUsage(customerId);
  return {
    bookings,
    upcomingBookings,
    pastBookings,
    services,
    points,
    memberTopups,
    memberCreditUsage,
    packageUsage,
  };
}

export async function customerSummary(customerId: string) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  const history = await getCustomerHistory(customerId);
  const points = c.lineUserId ? (await getAccount(c.lineUserId, c.name)).points : 0;
  const visits =
    history.services.length +
    history.bookings.filter((b) => b.status === "confirmed").length;
  return { customer: c, history, points, visits };
}

export async function countCustomerVisits(customerId: string) {
  const history = await getCustomerHistory(customerId);
  return (
    history.services.length +
    history.bookings.filter((b) => b.status === "confirmed").length
  );
}

/** ยอดสะสมรวม (บิลที่ชำระแล้ว) — ใช้เป็นเงื่อนไขเลื่อนระดับ VIP */
export async function customerTotalSpend(customerId: string) {
  const { listInvoices } = await import("./invoices-store");
  const invs = await listInvoices(customerId);
  return invs
    .filter((i) => i.status === "paid" && !i.deletedAt)
    .reduce((s, i) => s + (i.total || 0), 0);
}

/** อัปเกรดระดับลูกค้าตามเงื่อนไขที่ตั้งไว้ (จำนวนครั้ง / ยอดสะสม) */
export async function recalculateCustomerTier(customerId: string) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  const visits = await countCustomerVisits(customerId);
  const spend = await customerTotalSpend(customerId);
  let rules = DEFAULT_TIER_RULES;
  try {
    const cfg = await getSiteConfig();
    rules = cfg.crm?.tierRules || DEFAULT_TIER_RULES;
  } catch {
    /* ใช้ค่า default ถ้าโหลด config ไม่ได้ */
  }
  const tier = computeTier(visits, spend, c.isMember, rules);
  if (tier === c.tier) return c;
  return updateCustomer(customerId, { tier });
}

/** คำนวณระดับลูกค้าใหม่ทั้งหมด (ใช้ตอนเปลี่ยนเงื่อนไข tier) */
export async function recalcAllTiers() {
  const all = await listCustomers();
  let updated = 0;
  for (const c of all) {
    const before = c.tier;
    const res = await recalculateCustomerTier(c.id);
    if (res && res.tier !== before) updated++;
  }
  return { total: all.length, updated };
}

export async function listCustomersByTier(
  tier: CustomerTier | "all",
  opts?: { breed?: string }
) {
  const { recipients } = await getBroadcastAudience(tier, opts);
  return recipients;
}

/** รายชื่อผู้รับ broadcast + คนที่ข้าม (ยังไม่ผูก LINE) */
export async function getBroadcastAudience(
  tier: CustomerTier | "all",
  opts?: { breed?: string }
) {
  const all = await fetchAllCustomers();
  let inTier = tier === "all" ? all : all.filter((c) => c.tier === tier);
  if (opts?.breed) {
    inTier = inTier.filter((c) =>
      c.cats.some((cat) => (cat.breed || "").trim() === opts.breed)
    );
  }
  const withLine = inTier.filter((c) => Boolean(c.lineUserId));
  // ส่งโปร/ข่าวสารเฉพาะคนที่ยินยอม — ยืนยันนัด/จ่ายเงินใช้คนละช่องทาง ไม่ผ่านฟังก์ชันนี้
  const recipients = withLine.filter((c) => c.marketingConsent !== false);
  const skippedNoConsent = withLine.filter((c) => c.marketingConsent === false);
  const skippedNoLine = inTier.filter((c) => !c.lineUserId);
  return { recipients, skippedNoLine, skippedNoConsent };
}

/** ลูกค้ากรอกฟอร์มลงทะเบียนจาก LIFF */
export async function registerCustomerFromLine(data: {
  lineUserId: string;
  name: string;
  phone: string;
  email?: string;
  birthday?: string;
  referralSource?: string;
  address?: string;
  addressMapUrl?: string;
  postalCode?: string;
  marketingConsent?: boolean;
  cats: {
    name: string;
    gender?: CatGender;
    breed?: string;
    ageValue?: number;
    ageUnit?: "year" | "month";
    birthday?: string;
    medical?: string;
    furLength?: "short" | "long";
    color?: string;
    staffNote?: string;
  }[];
}) {
  const lineUserId = data.lineUserId.trim();
  const name = data.name.trim();
  const phone = data.phone.trim();
  const cats = data.cats
    .map((c) => ({
      name: c.name.trim(),
      gender: c.gender,
      breed: c.breed?.trim(),
      ageValue: c.ageValue,
      ageUnit: c.ageUnit,
      birthday: c.birthday?.trim(),
      medical: c.medical?.trim(),
      furLength: c.furLength,
      color: c.color?.trim(),
      staffNote: c.staffNote?.trim(),
    }))
    .filter((c) => c.name);

  if (!lineUserId || !name || !phone || cats.length === 0) return null;

  // ผ่าน upsert เสมอ — หาบัญชีเดิม/สร้างใหม่/กู้คืนถ้าเคยลบ (กัน insert ซ้ำจน unique ชน)
  const customer =
    (await upsertCustomerFromLine({ lineUserId, displayName: name })) ?? undefined;
  if (!customer) return null;

  await updateCustomer(customer.id, {
    name,
    phone,
    email: data.email?.trim() || undefined,
    birthday: data.birthday?.trim() || undefined,
    referralSource: data.referralSource?.trim() || undefined,
    address: data.address?.trim() || undefined,
    addressMapUrl: data.addressMapUrl?.trim() || undefined,
    postalCode: data.postalCode?.trim() || undefined,
    marketingConsent: data.marketingConsent ?? true,
  });

  for (const cat of cats) {
    const exists = customer.cats.some(
      (x) => x.name.toLowerCase() === cat.name.toLowerCase()
    );
    if (exists) continue;
    await addCat(customer.id, cat);
  }

  const refreshed = await getCustomer(customer.id);
  if (!refreshed) return null;
  await recalculateCustomerTier(refreshed.id);
  return getCustomer(refreshed.id);
}
