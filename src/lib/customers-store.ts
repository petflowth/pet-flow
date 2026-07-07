import { listBookings } from "./bookings-store";
import { getAccount } from "./points-store";

export type CatRecord = {
  id: string;
  name: string;
  /** รูปน้องแมว — เห็นเฉพาะหลังบ้าน */
  photoDataUrl?: string;
  /** โน้ตพนักงาน เช่น แมวดุ อาบยาก */
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

const customers = new Map<string, CustomerRecord>();
const services: ServiceRecord[] = [];

function seed() {
  const c: CustomerRecord = {
    id: "C001",
    name: "คุณมาย",
    lineUserId: "dev-user",
    cats: [
      {
        id: "CAT001",
        name: "น้องส้ม",
        staffNote: "อาบง่าย ไม่ดุ",
      },
    ],
    isMember: false,
    memberCredit: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  customers.set(c.id, c);
}
seed();

export function listCustomers() {
  return [...customers.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function getCustomer(id: string) {
  return customers.get(id);
}

export function findCustomerByLine(lineUserId: string) {
  return [...customers.values()].find((c) => c.lineUserId === lineUserId);
}

export function searchCustomers(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return listCustomers();
  return listCustomers().filter((c) => {
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

export function upsertCustomerFromBooking(data: {
  customerName: string;
  catName: string;
  lineUserId?: string;
  phone?: string;
  staffNote?: string;
}) {
  let existing =
    (data.lineUserId && findCustomerByLine(data.lineUserId)) ||
    [...customers.values()].find(
      (c) =>
        c.name === data.customerName &&
        c.cats.some((cat) => cat.name === data.catName)
    );

  if (!existing) {
    const id = `C${Date.now()}`;
    existing = {
      id,
      name: data.customerName,
      phone: data.phone,
      lineUserId: data.lineUserId,
      cats: [
        {
          id: `CAT${Date.now()}`,
          name: data.catName,
          staffNote: data.staffNote,
        },
      ],
      isMember: false,
      memberCredit: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    customers.set(id, existing);
    return existing;
  }

  if (data.lineUserId) existing.lineUserId = data.lineUserId;
  if (data.phone) existing.phone = data.phone;
  if (!existing.cats.some((cat) => cat.name === data.catName)) {
    existing.cats.push({
      id: `CAT${Date.now()}`,
      name: data.catName,
      staffNote: data.staffNote,
    });
  } else if (data.staffNote) {
    const cat = existing.cats.find((x) => x.name === data.catName);
    if (cat) cat.staffNote = data.staffNote;
  }
  existing.updatedAt = new Date().toISOString();
  return existing;
}

export function updateCustomer(
  id: string,
  patch: Partial<
    Pick<
      CustomerRecord,
      "name" | "phone" | "lineUserId" | "isMember" | "memberCredit" | "memberSince"
    >
  >
) {
  const c = customers.get(id);
  if (!c) return null;
  Object.assign(c, patch);
  if (patch.isMember && !c.memberSince) {
    c.memberSince = new Date().toISOString().slice(0, 10);
  }
  c.updatedAt = new Date().toISOString();
  return c;
}

export function updateCat(
  customerId: string,
  catId: string,
  patch: Partial<Pick<CatRecord, "name" | "photoDataUrl" | "staffNote">>
) {
  const c = customers.get(customerId);
  if (!c) return null;
  const cat = c.cats.find((x) => x.id === catId);
  if (!cat) return null;
  Object.assign(cat, patch);
  c.updatedAt = new Date().toISOString();
  return c;
}

export function addMemberCredit(customerId: string, amount: number) {
  const c = customers.get(customerId);
  if (!c) return null;
  c.memberCredit += amount;
  c.isMember = true;
  if (!c.memberSince) c.memberSince = new Date().toISOString().slice(0, 10);
  c.updatedAt = new Date().toISOString();
  return c;
}

export function deductMemberCredit(customerId: string, amount: number) {
  const c = customers.get(customerId);
  if (!c || c.memberCredit < amount) return null;
  c.memberCredit -= amount;
  c.updatedAt = new Date().toISOString();
  return c;
}

export function addServiceRecord(
  data: Omit<ServiceRecord, "id" | "at"> & { at?: string }
) {
  const rec: ServiceRecord = {
    ...data,
    id: `S${Date.now()}`,
    at: data.at || new Date().toISOString(),
  };
  services.unshift(rec);
  return rec;
}

export function getCustomerHistory(customerId: string) {
  const bookings = listBookings().filter(
    (b) =>
      customers.get(customerId)?.lineUserId &&
      b.lineUserId === customers.get(customerId)?.lineUserId
  );
  const svc = services.filter((s) => s.customerId === customerId);
  const c = customers.get(customerId);
  const points = c?.lineUserId
    ? getAccount(c.lineUserId, c.name).history
    : [];

  return { bookings, services: svc, points };
}

export function customerSummary(customerId: string) {
  const c = customers.get(customerId);
  if (!c) return null;
  const history = getCustomerHistory(customerId);
  const points = c.lineUserId ? getAccount(c.lineUserId, c.name).points : 0;
  const visits =
    history.services.length +
    history.bookings.filter((b) => b.status === "confirmed").length;
  return { customer: c, history, points, visits };
}
