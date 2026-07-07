import { listBookings } from "./bookings-store";
import { getAccount, getPointsHistory } from "./points-store";
import { getSupabase } from "./supabase/server";

export type CatRecord = {
  id: string;
  name: string;
  photoDataUrl?: string;
  staffNote?: string;
};

export type CustomerRecord = {
  id: string;
  name: string;
  phone?: string;
  lineUserId?: string;
  cats: CatRecord[];
  isMember: boolean;
  memberCredit: number;
  memberSince?: string;
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

type CatRow = {
  id: string;
  customer_id: string;
  name: string;
  photo_data_url: string | null;
  staff_note: string | null;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  line_user_id: string | null;
  is_member: boolean;
  member_credit: number;
  member_since: string | null;
  created_at: string;
  updated_at: string;
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

const memCustomers = new Map<string, CustomerRecord>();
const memServices: ServiceRecord[] = [];

function seedMem() {
  const c: CustomerRecord = {
    id: "C001",
    name: "คุณมาย",
    lineUserId: "dev-user",
    cats: [{ id: "CAT001", name: "น้องส้ม", staffNote: "อาบง่าย ไม่ดุ" }],
    isMember: false,
    memberCredit: 0,
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
    lineUserId: row.line_user_id ?? undefined,
    isMember: row.is_member,
    memberCredit: Number(row.member_credit),
    memberSince: row.member_since ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    cats: (row.cats || []).map((c) => ({
      id: c.id,
      name: c.name,
      photoDataUrl: c.photo_data_url ?? undefined,
      staffNote: c.staff_note ?? undefined,
    })),
  };
}

async function fetchAllCustomers(): Promise<CustomerRecord[]> {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb
      .from("customers")
      .select("*, cats(*)")
      .order("updated_at", { ascending: false });
    return ((data as CustomerRow[] | null) || []).map(mapCustomer);
  }
  return [...memCustomers.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
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

export async function listCustomers() {
  return fetchAllCustomers();
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
  if (!q) return all;
  return all.filter((c) => {
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
        c.name === data.customerName &&
        c.cats.some((cat) => cat.name === data.catName)
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
      cats: [{ id: catId, name: data.catName, staffNote: data.staffNote }],
      isMember: false,
      memberCredit: 0,
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

export async function updateCustomer(
  id: string,
  patch: Partial<
    Pick<
      CustomerRecord,
      "name" | "phone" | "lineUserId" | "isMember" | "memberCredit" | "memberSince"
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
        line_user_id: c.lineUserId || null,
        is_member: c.isMember,
        member_credit: c.memberCredit,
        member_since: c.memberSince || null,
        updated_at: c.updatedAt,
      })
      .eq("id", id);
  } else {
    memCustomers.set(id, c);
  }
  return c;
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

export async function addMemberCredit(customerId: string, amount: number) {
  const c = await getCustomer(customerId);
  if (!c) return null;
  c.memberCredit += amount;
  c.isMember = true;
  if (!c.memberSince) c.memberSince = new Date().toISOString().slice(0, 10);
  return updateCustomer(customerId, {
    isMember: c.isMember,
    memberCredit: c.memberCredit,
    memberSince: c.memberSince,
  });
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
    return rec;
  }

  memServices.unshift(rec);
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

export async function getCustomerHistory(customerId: string) {
  const c = await getCustomer(customerId);
  const allBookings = await listBookings();
  const bookings = allBookings.filter(
    (b) => c?.lineUserId && b.lineUserId === c.lineUserId
  );
  const services = await listServiceRecords(customerId);
  const points = c?.lineUserId ? await getPointsHistory(c.lineUserId) : [];
  return { bookings, services, points };
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
