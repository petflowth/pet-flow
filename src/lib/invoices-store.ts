import { BUSINESS } from "./business";
import {
  deductMemberCredit,
  addServiceRecord,
  getCustomer,
} from "./customers-store";
import { addFinanceEntry } from "./finance-store";
import { calcPromoDiscount } from "./promos-store";
import { addPoints } from "./points-store";

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

const invoices: InvoiceRecord[] = [];

export function listInvoices(customerId?: string) {
  const list = customerId
    ? invoices.filter((i) => i.customerId === customerId)
    : [...invoices];
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getInvoice(id: string) {
  return invoices.find((i) => i.id === id);
}

export function createInvoice(data: {
  customerId: string;
  lineUserId?: string;
  customerName: string;
  catName: string;
  items: InvoiceItem[];
  promoId?: string;
  bookingId?: string;
}) {
  const subtotal = data.items.reduce((s, i) => s + i.amount, 0);
  const { discount, label } = calcPromoDiscount(data.promoId, subtotal);
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
  invoices.unshift(invoice);
  return invoice;
}

export function markInvoiceSent(id: string) {
  const inv = getInvoice(id);
  if (!inv) return null;
  inv.sentAt = new Date().toISOString();
  return inv;
}

export function markInvoicePaid(
  id: string,
  paymentMethod: "transfer" | "member_credit" | "cash" = "transfer"
) {
  const inv = getInvoice(id);
  if (!inv || inv.status === "paid") return { ok: false as const, error: "invalid" };

  const customer = getCustomer(inv.customerId);
  if (paymentMethod === "member_credit") {
    if (!customer || customer.memberCredit < inv.total) {
      return { ok: false as const, error: "insufficient_credit" };
    }
    deductMemberCredit(inv.customerId, inv.total);
  }

  inv.status = "paid";
  inv.paymentMethod = paymentMethod;
  inv.paidAt = new Date().toISOString();

  const pointsEarned = Math.floor(inv.total / BUSINESS.pointsRate);
  inv.pointsEarned = pointsEarned;

  if (inv.lineUserId && pointsEarned > 0) {
    addPoints(
      inv.lineUserId,
      pointsEarned,
      `ใช้บริการ ${inv.total} บาท`,
      `Service payment ${inv.total} THB`,
      inv.customerName
    );
  }

  addFinanceEntry({
    type: "income",
    amount: inv.total,
    category: paymentMethod === "member_credit" ? "member" : "service",
    description: `${inv.catName} · ${inv.customerName}`,
    date: inv.paidAt.slice(0, 10),
    customerId: inv.customerId,
    invoiceId: inv.id,
  });

  addServiceRecord({
    customerId: inv.customerId,
    catName: inv.catName,
    service: inv.items.map((i) => i.label).join(", "),
    date: inv.paidAt.slice(0, 10),
    amount: inv.total,
    invoiceId: inv.id,
    bookingId: inv.bookingId,
  });

  return { ok: true as const, invoice: inv, customer };
}

export function salesSummary(from?: string, to?: string) {
  const paid = invoices.filter((i) => {
    if (i.status !== "paid" || !i.paidAt) return false;
    const d = i.paidAt.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  return {
    total: paid.reduce((s, i) => s + i.total, 0),
    count: paid.length,
    pending: invoices.filter((i) => i.status === "pending").length,
  };
}
