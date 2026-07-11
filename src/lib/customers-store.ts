import { bookingMatchesCustomer, datesForBooking, isUpcomingBooking } from "./booking-customer-match";
import type { Booking } from "./business";
import {
  computeTierFromVisits,
  type CustomerTier,
} from "./customer-tier";
import { listBookings } from "./bookings-store";
import { getAccount, getPointsHistory } from "./points-store";
import { getSupabase } from "./supabase/server";

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
  photoDataUrl?: string;
  staffNote?: string;
  /** โน้ตลับของร้าน — ซ่อนจากลูกค้า (ต้องรัน OVERNIGHT_SQL.md ก่อนถึงจะเซฟได้) */
  staffPrivateNote?: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  birthday?: string;
  lineUserId?: string;
  /** ชื่อจากโปรไฟล์ LINE — อัปเดตอัตโนมัติ ไม่ทับชื่อที่ร้านตั้ง */
  lineDisplayName?: string;
  /** ยินยอมรับข่าวสาร/โปรโมชั่น — ถ้า false จะไม่ส่งโปรหา (แต่ยืนยันนัด/จ่ายเงินยังส่งได้) */
  marketingConsent: boolean;
  /** รู้จักร้านจากทางไหน */
  referralSource?: string;
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
  photo_data_url: string | null;
  staff_note: string | null;
  staff_private_note?: string | null;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  marketing_consent: boolean | null;
  referral_source: string | null;
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
};

const memCustomers = new Map<string, CustomerRecord>();
const memServices: ServiceRecord[] = [];
const memMemberTopups: MemberTopupRecord[] = [];

function seedMem() {
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
    lineDisplayName: row.line_display_name ?? undefined,
    marketingConsent: row.marketing_consent !== false,
    referralSource: row.referral_source ?? undefined,
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
      photoDataUrl: c.photo_data_url ?? undefined,
      staffNote: c.staff_note ?? undefined,
      staffPrivateNote: c.staff_private_note ?? undefined,
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
    await sb.from("customers").update({ updated_at: now }).eq("id", id);
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
      .maybeSingle();
    return data ? mapCustomer(data as CustomerRow) : undefined;
  }
  return memCustomers.get(id);
}

export async function findCustomerByLine(lineUserId: string) {
  const all = await fetchAllCustomers();
  return all.find((c) => c.lineUserId === lineUserId);
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
    existing = (await fetchAllCustomers()).find(
      (c) => !c.lineUserId && normName(c.name) === normName(displayName)
    );
  }

  const now = new Date().toISOString();

  if (existing) {
    existing.lineUserId = lineUserId;
    existing.lineDisplayName = displayName;
    // ไม่ทับชื่อที่ร้านตั้งเอง — อัปเดตแค่ชื่อ LINE
    existing.updatedAt = now;
    if (sb) {
      await sb
        .from("customers")
        .update({
          line_user_id: lineUserId,
          line_display_name: displayName,
          updated_at: now,
        })
        .eq("id", existing.id);
    } else {
      memCustomers.set(existing.id, existing);
    }
    await linkBookingsToLineCustomer(existing);
    return existing;
  }

  const id = `C${Date.now()}`;
  const customer: CustomerRecord = {
    id,
    name: displayName,
    lineUserId,
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
    await sb.from("customers").insert({
      id,
      name: displayName,
      line_user_id: lineUserId,
      line_display_name: displayName,
      is_member: false,
      member_credit: 0,
      tier: "new",
      created_at: now,
      updated_at: now,
    });
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
      .eq("id", customerId);
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
    const id = `C${Date.now()}`;
    const catId = `CAT${Date.now()}`;
    existing = {
      id,
      name: data.customerName,
      phone: data.phone,
      lineUserId: data.lineUserId,
      marketingConsent: true,
      cats: [{ id: catId, name: data.catName, staffNote: data.staffNote }],
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
        customer_id: id,
        name: data.catName,
        staff_note: data.staffNote || null,
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
    existing.cats.push({ id: catId, name: data.catName, staffNote: data.staffNote });
    if (sb) {
      await sb.from("cats").insert({
        id: catId,
        customer_id: existing.id,
        name: data.catName,
        staff_note: data.staffNote || null,
      });
    }
  } else if (data.staffNote) {
    const cat = existing.cats.find((x) => x.name === data.catName);
    if (cat) {
      cat.staffNote = data.staffNote;
      if (sb) {
        await sb
          .from("cats")
          .update({ staff_note: data.staffNote })
          .eq("id", cat.id);
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
      .eq("id", existing.id);
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
      .eq("id", id);
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
        .eq("id", customerId);
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
  patch: Partial<Pick<CatRecord, "name" | "photoDataUrl" | "staffNote">>
) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  const cat = c.cats.find((x) => x.id === catId);
  if (!cat) return null;

  Object.assign(cat, patch);
  await touchCustomer(customerId);

  const sb = getSupabase();
  if (sb) {
    await sb
      .from("cats")
      .update({
        name: cat.name,
        photo_data_url: cat.photoDataUrl || null,
        staff_note: cat.staffNote || null,
      })
      .eq("id", catId);
  } else {
    memCustomers.set(customerId, c);
  }
  return c;
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
    staffNote: data.staffNote?.trim() || undefined,
  };

  c.cats.push(cat);
  await touchCustomer(customerId);

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("cats").insert({
      id: catId,
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
    const { error } = await sb.from("cats").delete().eq("id", catId);
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
        .eq("id", customerId);
      if (error) throw new Error(error.message);
    } catch {
      // ยังไม่ได้รัน migration deleted_at → ลบจริง (cascade)
      await sb.from("customers").delete().eq("id", customerId);
    }
  } else {
    const c = memCustomers.get(customerId);
    if (c) c.deletedAt = now;
  }
  return { ok: true as const };
}

/** กู้ลูกค้าจากถังขยะ */
export async function restoreCustomer(customerId: string) {
  const sb = getSupabase();
  if (sb) {
    await sb.from("customers").update({ deleted_at: null }).eq("id", customerId);
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
        .eq("id", catId);
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

export async function topupMemberCredit(
  customerId: string,
  data: { paidAmount: number; bonusAmount?: number; note?: string }
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

  const topup: MemberTopupRecord = {
    id: `MT${Date.now()}`,
    customerId,
    paidAmount: paid,
    bonusAmount: bonus,
    creditAdded,
    balanceAfter: c.memberCredit,
    note: data.note?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("member_topups").insert({
      id: topup.id,
      customer_id: topup.customerId,
      paid_amount: topup.paidAmount,
      bonus_amount: topup.bonusAmount,
      credit_added: topup.creditAdded,
      balance_after: topup.balanceAfter,
      note: topup.note || null,
      created_at: topup.createdAt,
    });
  } else {
    memMemberTopups.unshift(topup);
  }

  if (paid > 0) {
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

async function listServiceRecords(customerId: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("service_records")
      .select("*")
      .eq("customer_id", customerId)
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

async function listMemberTopups(customerId: string): Promise<MemberTopupRecord[]> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("member_topups")
      .select("*")
      .eq("customer_id", customerId)
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
    }));
  }
  return memMemberTopups.filter((t) => t.customerId === customerId);
}

async function listMemberCreditUsage(customerId: string): Promise<MemberCreditUsageRecord[]> {
  const { listInvoices } = await import("./invoices-store");
  const invoices = await listInvoices(customerId);
  return invoices
    .filter((i) => i.status === "paid" && i.paymentMethod === "member_credit" && i.paidAt)
    .map((i) => ({
      id: i.id,
      customerId: i.customerId,
      amount: i.total,
      description: `${i.catName} · ${i.items.map((x) => x.label).join(", ")}`,
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
  return {
    bookings,
    upcomingBookings,
    pastBookings,
    services,
    points,
    memberTopups,
    memberCreditUsage,
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

/** อัปเกรดระดับลูกค้าตามจำนวนครั้งที่มาใช้บริการ */
export async function recalculateCustomerTier(customerId: string) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  const visits = await countCustomerVisits(customerId);
  const tier = computeTierFromVisits(visits, c.isMember);
  if (tier === c.tier) return c;
  return updateCustomer(customerId, { tier });
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
  marketingConsent?: boolean;
  cats: {
    name: string;
    gender?: CatGender;
    breed?: string;
    ageValue?: number;
    ageUnit?: "year" | "month";
    birthday?: string;
    medical?: string;
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
      staffNote: c.staffNote?.trim(),
    }))
    .filter((c) => c.name);

  if (!lineUserId || !name || !phone || cats.length === 0) return null;

  let customer = await findCustomerByLine(lineUserId);
  if (!customer) {
    customer = (await upsertCustomerFromLine({
      lineUserId,
      displayName: name,
    })) ?? undefined;
  }
  if (!customer) return null;

  await updateCustomer(customer.id, {
    name,
    phone,
    email: data.email?.trim() || undefined,
    birthday: data.birthday?.trim() || undefined,
    referralSource: data.referralSource?.trim() || undefined,
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
