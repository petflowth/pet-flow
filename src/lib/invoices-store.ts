import { BUSINESS } from "./business";
import {
  deductMemberCredit,
  addServiceRecord,
  getCustomer,
} from "./customers-store";
import { addFinanceEntry } from "./finance-store";
import { calcPromoDiscount } from "./promos-store";
import { addPoints } from "./points-store";
import { getSupabase } from "./supabase/server";

export type InvoiceItem = { label: string; amount: number };

export type InvoiceRecord = {
  id: string;
  customerId: string;
  lineUserId?: string;
  customerName: string;
  catName: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  promoId?: string;
  promoLabel?: string;
  total: number;
  status: "pending" | "paid";
  paymentMethod?: "transfer" | "member_credit" | "cash";
  paidAt?: string;
  pointsEarned?: number;
  bookingId?: string;
  sentAt?: string;
  createdAt: string;
};

type InvoiceRow = {
  id: string;
  customer_id: string;
  line_user_id: string | null;
  customer_name: string;
  cat_name: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  promo_id: string | null;
  promo_label: string | null;
  total: number;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  points_earned: number | null;
  booking_id: string | null;
  sent_at: string | null;
  created_at: string;
};

const mem: InvoiceRecord[] = [];

function rowToInvoice(r: InvoiceRow): InvoiceRecord {
  return {
    id: r.id,
    customerId: r.customer_id,
    lineUserId: r.line_user_id || undefined,
    customerName: r.customer_name,
    catName: r.cat_name,
    items: r.items,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    promoId: r.promo_id || undefined,
    promoLabel: r.promo_label || undefined,
    total: Number(r.total),
    status: r.status as "pending" | "paid",
    paymentMethod: (r.payment_method as InvoiceRecord["paymentMethod"]) || undefined,
    paidAt: r.paid_at || undefined,
    pointsEarned: r.points_earned ?? undefined,
    bookingId: r.booking_id || undefined,
    sentAt: r.sent_at || undefined,
    createdAt: r.created_at,
  };
}

function invoiceToRow(inv: InvoiceRecord) {
  return {
    id: inv.id,
    customer_id: inv.customerId,
    line_user_id: inv.lineUserId || null,
    customer_name: inv.customerName,
    cat_name: inv.catName,
    items: inv.items,
    subtotal: inv.subtotal,
    discount: inv.discount,
    promo_id: inv.promoId || null,
    promo_label: inv.promoLabel || null,
    total: inv.total,
    status: inv.status,
    payment_method: inv.paymentMethod || null,
    paid_at: inv.paidAt || null,
    points_earned: inv.pointsEarned ?? null,
    booking_id: inv.bookingId || null,
    sent_at: inv.sentAt || null,
    created_at: inv.createdAt,
  };
}

export async function listInvoices(customerId?: string) {
  const sb = getSupabase();
  let list: InvoiceRecord[];
  if (sb) {
    let q = sb.from("invoices").select("*").order("created_at", { ascending: false });
    if (customerId) q = q.eq("customer_id", customerId);
    const { data } = await q;
    list = ((data as InvoiceRow[] | null) || []).map(rowToInvoice);
  } else {
    list = customerId ? mem.filter((i) => i.customerId === customerId) : [...mem];
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return list;
}

export async function getInvoice(id: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("invoices").select("*").eq("id", id).maybeSingle();
    return data ? rowToInvoice(data as InvoiceRow) : undefined;
  }
  return mem.find((i) => i.id === id);
}

export async function createInvoice(data: {
  customerId: string;
  lineUserId?: string;
  customerName: string;
  catName: string;
  items: InvoiceItem[];
  promoId?: string;
  bookingId?: string;
}) {
  const subtotal = data.items.reduce((s, i) => s + i.amount, 0);
  const { discount, label } = await calcPromoDiscount(data.promoId, subtotal);
  const invoice: InvoiceRecord = {
    id: `INV${Date.now()}`,
    customerId: data.customerId,
    lineUserId: data.lineUserId,
    customerName: data.customerName,
    catName: data.catName,
    items: data.items,
    subtotal,
    discount,
    promoId: data.promoId,
    promoLabel: label,
    total: subtotal - discount,
    status: "pending",
    bookingId: data.bookingId,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("invoices").insert(invoiceToRow(invoice));
  } else {
    mem.unshift(invoice);
  }
  return invoice;
}

export async function markInvoiceSent(id: string) {
  const inv = await getInvoice(id);
  if (!inv) return null;
  inv.sentAt = new Date().toISOString();

  const sb = getSupabase();
  if (sb) {
    await sb.from("invoices").update({ sent_at: inv.sentAt }).eq("id", id);
  }
  return inv;
}

export async function markInvoicePaid(
  id: string,
  paymentMethod: "transfer" | "member_credit" | "cash" = "transfer"
) {
  const inv = await getInvoice(id);
  if (!inv || inv.status === "paid") return { ok: false as const, error: "invalid" };

  const customer = await getCustomer(inv.customerId);
  if (paymentMethod === "member_credit") {
    if (!customer || customer.memberCredit < inv.total) {
      return { ok: false as const, error: "insufficient_credit" };
    }
    await deductMemberCredit(inv.customerId, inv.total);
  }

  inv.status = "paid";
  inv.paymentMethod = paymentMethod;
  inv.paidAt = new Date().toISOString();
  inv.pointsEarned = Math.floor(inv.total / BUSINESS.pointsRate);

  const sb = getSupabase();
  if (sb) {
    await sb
      .from("invoices")
      .update({
        status: inv.status,
        payment_method: inv.paymentMethod,
        paid_at: inv.paidAt,
        points_earned: inv.pointsEarned,
      })
      .eq("id", id);
  }

  if (inv.lineUserId && inv.pointsEarned > 0) {
    await addPoints(
      inv.lineUserId,
      inv.pointsEarned,
      `ใช้บริการ ${inv.total} บาท`,
      `Service payment ${inv.total} THB`,
      inv.customerName
    );
  }

  await addFinanceEntry({
    type: "income",
    amount: inv.total,
    category: paymentMethod === "member_credit" ? "member" : "service",
    description: `${inv.catName} · ${inv.customerName}`,
    date: inv.paidAt.slice(0, 10),
    customerId: inv.customerId,
    invoiceId: inv.id,
  });

  await addServiceRecord({
    customerId: inv.customerId,
    catName: inv.catName,
    service: inv.items.map((i) => i.label).join(", "),
    date: inv.paidAt.slice(0, 10),
    amount: inv.total,
    invoiceId: inv.id,
    bookingId: inv.bookingId,
  });

  const updatedCustomer = await getCustomer(inv.customerId);
  return { ok: true as const, invoice: inv, customer: updatedCustomer };
}

export async function salesSummary(from?: string, to?: string) {
  const all = await listInvoices();
  const paid = all.filter((i) => {
    if (i.status !== "paid" || !i.paidAt) return false;
    const d = i.paidAt.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  return {
    total: paid.reduce((s, i) => s + i.total, 0),
    count: paid.length,
    pending: all.filter((i) => i.status === "pending").length,
  };
}
