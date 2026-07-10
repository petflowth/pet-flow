import { getSiteConfig } from "./config-store";
import {
  deductMemberCredit,
  addServiceRecord,
  getCustomer,
} from "./customers-store";
import { addFinanceEntry, incomeForInvoice, listFinance } from "./finance-store";
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
  /** มัดจำที่รับแล้ว (ยอดคงเหลือ = total - deposit) */
  deposit: number;
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
  deposit: number | null;
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
    deposit: Number(r.deposit) || 0,
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
    deposit: inv.deposit || 0,
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

/** บิล + ยอดรายรับที่บันทึกแล้วต่อบิล (received) — ให้หน้าคิดเงินรู้ว่ารับมัดจำไปหรือยัง */
export async function listInvoicesWithReceived(customerId?: string) {
  const [list, fin] = await Promise.all([listInvoices(customerId), listFinance()]);
  const map = new Map<string, number>();
  for (const r of fin) {
    if (r.type === "income" && r.invoiceId) {
      map.set(r.invoiceId, (map.get(r.invoiceId) || 0) + r.amount);
    }
  }
  return list.map((i) => ({ ...i, received: map.get(i.id) || 0 }));
}

export async function createInvoice(data: {
  customerId: string;
  lineUserId?: string;
  customerName: string;
  catName: string;
  items: InvoiceItem[];
  promoId?: string;
  extraDiscount?: number;
  deposit?: number;
  bookingId?: string;
}) {
  const subtotal = data.items.reduce((s, i) => s + i.amount, 0);
  const { discount: promoDiscount, label } = await calcPromoDiscount(
    data.promoId,
    subtotal
  );
  const extra = Math.max(0, Math.round(data.extraDiscount || 0));
  const discount = Math.min(subtotal, promoDiscount + extra);
  const total = subtotal - discount;
  const deposit = Math.min(total, Math.max(0, Math.round(data.deposit || 0)));
  const invoice: InvoiceRecord = {
    id: `INV${Date.now()}`,
    customerId: data.customerId,
    lineUserId: data.lineUserId,
    customerName: data.customerName,
    catName: data.catName,
    items: data.items,
    subtotal,
    discount,
    deposit,
    promoId: data.promoId,
    promoLabel: label,
    total,
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

/**
 * รับ "มัดจำ" ตามจริง — บันทึกเป็นรายรับก้อนแรก (ไม่ปิดบิล).
 * ยอดคงเหลือจะไปเก็บตอนกด "รับยอดคงเหลือครบแล้ว" (markInvoicePaid).
 * ใช้ยอดรายรับที่บันทึกแล้วของบิลเป็นตัวกันบันทึกซ้ำ — ไม่ต้องเพิ่มคอลัมน์ใน DB.
 */
export async function receiveInvoiceDeposit(
  id: string,
  paymentMethod: "transfer" | "cash" = "transfer"
) {
  const inv = await getInvoice(id);
  if (!inv || inv.status === "paid") return { ok: false as const, error: "invalid" };
  const deposit = inv.deposit || 0;
  if (deposit <= 0) return { ok: false as const, error: "no_deposit" };

  const already = await incomeForInvoice(id);
  if (already > 0) return { ok: false as const, error: "already_received" };

  const now = new Date().toISOString();
  await addFinanceEntry({
    type: "income",
    amount: deposit,
    category: "มัดจำ",
    description: `${inv.catName} · ${inv.customerName} — มัดจำ (บิล ${inv.id})`,
    date: now.slice(0, 10),
    customerId: inv.customerId,
    invoiceId: inv.id,
  });

  const remaining = Math.max(0, inv.total - deposit);
  return {
    ok: true as const,
    invoice: inv,
    deposit,
    remaining,
    paymentMethod,
  };
}

export async function markInvoicePaid(
  id: string,
  paymentMethod: "transfer" | "member_credit" | "cash" = "transfer"
) {
  const inv = await getInvoice(id);
  if (!inv || inv.status === "paid") return { ok: false as const, error: "invalid" };

  // รายรับที่บันทึกแล้ว (เช่น มัดจำ) → รอบนี้เก็บแค่ "ยอดคงเหลือจริง"
  const alreadyReceived = await incomeForInvoice(id);
  const settleAmount = Math.max(0, inv.total - alreadyReceived);

  const customer = await getCustomer(inv.customerId);
  if (paymentMethod === "member_credit") {
    if (!customer || customer.memberCredit < settleAmount) {
      return { ok: false as const, error: "insufficient_credit" };
    }
    if (settleAmount > 0) await deductMemberCredit(inv.customerId, settleAmount);
  }

  inv.status = "paid";
  inv.paymentMethod = paymentMethod;
  inv.paidAt = new Date().toISOString();
  inv.pointsEarned = Math.floor(inv.total / (await getSiteConfig()).business.pointsRate);

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

  const serviceLabel = inv.items.map((i) => i.label).join(", ") || "บริการ";

  // บันทึกรายรับเฉพาะ "ยอดคงเหลือจริง" ที่เก็บรอบนี้ (มัดจำถูกบันทึกไปก่อนแล้ว)
  if (settleAmount > 0) {
    const isRemainder = alreadyReceived > 0;
    await addFinanceEntry({
      type: "income",
      amount: settleAmount,
      category: paymentMethod === "member_credit" ? "member" : serviceLabel,
      description: `${inv.catName} · ${inv.customerName} — ${serviceLabel}${
        isRemainder ? " (ยอดคงเหลือ)" : ""
      }`,
      date: inv.paidAt.slice(0, 10),
      customerId: inv.customerId,
      invoiceId: inv.id,
    });
  }

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
  return {
    ok: true as const,
    invoice: inv,
    customer: updatedCustomer,
    settleAmount,
    alreadyReceived,
  };
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
