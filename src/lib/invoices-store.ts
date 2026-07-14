import { getSiteConfig } from "./config-store";
import {
  deductMemberCredit,
  addMemberCredit,
  addServiceRecord,
  deleteServiceRecordByInvoice,
  getCustomer,
  adjustDepositCredit,
  recalculateCustomerTier,
} from "./customers-store";
import {
  addFinanceEntry,
  incomeForInvoice,
  deleteFinanceByInvoice,
  deleteInvoicePaymentIncome,
  listFinance,
} from "./finance-store";
import { calcPromoDiscount } from "./promos-store";
import { addPoints } from "./points-store";
import { getSupabase } from "./supabase/server";

export type InvoiceItem = {
  label: string;
  amount: number;
  /** ประเภทรายการ — ใช้เช็คว่าบิลนี้มีอาบน้ำ/กรูมรวมอยู่ไหม (แม่นกว่าเดารูปแบบข้อความ) */
  kind?: "grooming" | "room" | "service" | "custom" | "freebie";
};

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
  /** เวลาที่กด "รับมัดจำแล้ว" (ต้องรัน migration ก่อน) */
  depositReceivedAt?: string;
  /** ลบแบบกู้คืนได้ (soft delete) — ต้องรัน migration ก่อน */
  deletedAt?: string;
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
  deposit_received_at?: string | null;
  deleted_at?: string | null;
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
    depositReceivedAt: r.deposit_received_at ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
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
  return list.filter((i) => !i.deletedAt);
}

/** บิลที่ถูกลบ (อยู่ในถังขยะ) — กู้คืนได้ */
export async function listTrashedInvoices() {
  const sb = getSupabase();
  let list: InvoiceRecord[];
  if (sb) {
    const { data } = await sb
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });
    list = ((data as InvoiceRow[] | null) || []).map(rowToInvoice);
  } else {
    list = [...mem];
  }
  return list.filter((i) => i.deletedAt);
}

export async function getInvoice(id: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("invoices").select("*").eq("id", id).maybeSingle();
    return data ? rowToInvoice(data as InvoiceRow) : undefined;
  }
  return mem.find((i) => i.id === id);
}

/**
 * รับ "มัดจำล่วงหน้า" ของลูกค้า (ยังไม่ต้องมีบิล เช่น มัดจำคิวอาบน้ำ).
 * บันทึกเป็นรายรับทันที (cash basis) + เพิ่มเครดิตมัดจำให้ลูกค้า เพื่อหักบิลถัดไป.
 */
export async function receiveDepositCredit(
  customerId: string,
  amount: number,
  note?: string,
  method: "transfer" | "cash" = "transfer"
) {
  const amt = Math.max(0, Math.round(amount || 0));
  if (amt <= 0) return { ok: false as const, error: "bad_amount", balance: 0 };
  const c = await getCustomer(customerId);
  if (!c) return { ok: false as const, error: "not_found", balance: 0 };

  const now = new Date().toISOString();
  await addFinanceEntry({
    type: "income",
    amount: amt,
    category: "มัดจำ",
    description: `${c.name} — รับมัดจำล่วงหน้า${note ? ` (${note})` : ""}`,
    date: now.slice(0, 10),
    customerId,
  });

  const res = await adjustDepositCredit(customerId, amt);
  return {
    ok: true as const,
    balance: res.balance,
    needSql: !res.ok && res.error === "need_sql",
    method,
    amount: amt,
  };
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
  let deposit = Math.min(total, Math.max(0, Math.round(data.deposit || 0)));

  // มัดจำที่เคยเรียกเก็บไว้ล่วงหน้า (ยังไม่ผูกบิลไหน — เช่น เรียกเก็บจากหน้าปฏิทินก่อนออกบิล)
  // หักเข้าบิลนี้ให้อัตโนมัติ กันลืมว่าเคยรับมัดจำไปแล้ว
  let autoAppliedCredit = 0;
  if (data.customerId && deposit < total) {
    const customer = await getCustomer(data.customerId);
    const available = customer?.depositCredit || 0;
    if (available > 0) {
      autoAppliedCredit = Math.min(available, total - deposit);
      if (autoAppliedCredit > 0) {
        deposit += autoAppliedCredit;
        await adjustDepositCredit(data.customerId, -autoAppliedCredit);
      }
    }
  }

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

  return { ...invoice, autoAppliedCredit };
}

/**
 * รับ "มัดจำ" ของบิลนี้ → บันทึกเป็นรายรับก้อนแรก (ไม่ปิดบิล).
 * ใช้ยอดรายรับที่ลงบัญชีแล้วของบิลเป็นตัวกันบันทึกซ้ำ (ledger-based).
 */
export async function receiveInvoiceDeposit(id: string) {
  const inv = await getInvoice(id);
  if (!inv || inv.status === "paid") return { ok: false as const, error: "invalid" };
  const deposit = inv.deposit || 0;
  if (deposit <= 0) return { ok: false as const, error: "no_deposit" };

  const already = await incomeForInvoice(id);
  const toRecord = Math.max(0, deposit - already);
  if (toRecord <= 0) return { ok: false as const, error: "already_received" };

  await addFinanceEntry({
    type: "income",
    amount: toRecord,
    category: "มัดจำ",
    description: `${inv.catName} · ${inv.customerName} — มัดจำ (บิล ${inv.id})`,
    date: new Date().toISOString().slice(0, 10),
    customerId: inv.customerId,
    invoiceId: inv.id,
  });

  // บันทึกสถานะ "รับมัดจำแล้ว" ไว้ที่บิล (ถ้ายังไม่มีคอลัมน์ ก็ไม่พัง)
  const receivedAt = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("invoices").update({ deposit_received_at: receivedAt }).eq("id", id);
    } catch {
      /* ยังไม่ได้รัน migration — ข้าม */
    }
  } else {
    const m = mem.find((x) => x.id === id);
    if (m) m.depositReceivedAt = receivedAt;
  }

  return {
    ok: true as const,
    deposit,
    remaining: Math.max(0, inv.total - deposit),
    receivedAt,
  };
}

/** แก้ไขบิล (รายการ/มัดจำ/ส่วนลด) — ได้เฉพาะบิลที่ยังไม่ปิด */
export async function updateInvoice(
  id: string,
  patch: {
    items?: InvoiceItem[];
    deposit?: number;
    extraDiscount?: number;
    promoId?: string;
  }
) {
  const inv = await getInvoice(id);
  if (!inv) return { ok: false as const, error: "not_found" };
  if (inv.status === "paid") return { ok: false as const, error: "already_paid" };

  const items = patch.items ?? inv.items;
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const promoId = patch.promoId !== undefined ? patch.promoId : inv.promoId;
  const { discount: promoDiscount, label } = await calcPromoDiscount(promoId, subtotal);
  const extra = Math.max(0, Math.round(patch.extraDiscount ?? 0));
  const discount = Math.min(subtotal, promoDiscount + extra);
  const total = subtotal - discount;
  const deposit = Math.min(
    total,
    Math.max(0, Math.round(patch.deposit ?? inv.deposit ?? 0))
  );

  inv.items = items;
  inv.subtotal = subtotal;
  inv.discount = discount;
  inv.total = total;
  inv.deposit = deposit;
  inv.promoId = promoId;
  inv.promoLabel = label;

  const sb = getSupabase();
  if (sb) {
    await sb.from("invoices").update(invoiceToRow(inv)).eq("id", id);
  }
  return { ok: true as const, invoice: inv };
}

/** ลบบิล + รายการบัญชีที่ผูกกับบิลนั้น (ไม่ให้ยอดค้าง) */
/** ลบบิล (ย้ายลงถังขยะ กู้คืนได้) + ลบรายการบัญชีที่ผูก (กู้คืนตอน restore) */
export async function deleteInvoice(id: string) {
  const inv = await getInvoice(id);
  if (!inv) return { ok: false as const, error: "not_found" };
  await deleteFinanceByInvoice(id);
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("invoices")
        .update({ deleted_at: now })
        .eq("id", id);
      if (error) throw new Error(error.message);
    } catch {
      // ยังไม่ได้รัน migration deleted_at → ลบจริงไปเลย (กู้ไม่ได้)
      await sb.from("invoices").delete().eq("id", id);
    }
  } else {
    const i = mem.findIndex((x) => x.id === id);
    if (i >= 0) mem[i].deletedAt = now;
  }
  return { ok: true as const };
}

/** กู้บิลจากถังขยะ */
export async function restoreInvoice(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb.from("invoices").update({ deleted_at: null }).eq("id", id);
  } else {
    const i = mem.findIndex((x) => x.id === id);
    if (i >= 0) mem[i].deletedAt = undefined;
  }
  return { ok: true as const };
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

  // ยอดที่ลงบัญชีไปแล้วของบิลนี้ (เช่น มัดจำที่กดรับไปก่อน) → รอบนี้เก็บแค่ "ที่เหลือจริง"
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

/**
 * ยกเลิกการชำระ (กดผิด) — คืนบิลกลับเป็น "รอชำระ" + ย้อนผลทั้งหมด:
 * ลบรายรับยอดชำระ (คงมัดจำ), คืนแต้ม, คืนเครดิต Member, ลบประวัติบริการ
 */
export async function revertInvoicePaid(id: string) {
  const inv = await getInvoice(id);
  if (!inv || inv.status !== "paid") {
    return { ok: false as const, error: "not_paid" };
  }

  // คืนเครดิต Member ที่หักไป (รายรับหมวด "member" ของบิลนี้)
  if (inv.paymentMethod === "member_credit") {
    const all = await listFinance();
    const memberDeducted = all
      .filter((r) => r.invoiceId === id && r.category === "member" && r.type === "income")
      .reduce((s, r) => s + r.amount, 0);
    if (memberDeducted > 0) await addMemberCredit(inv.customerId, memberDeducted);
  }

  // ลบรายรับ "ยอดชำระ" (คงรายการมัดจำไว้)
  await deleteInvoicePaymentIncome(id);

  // คืนแต้มที่ได้จากบิลนี้
  if (inv.lineUserId && (inv.pointsEarned || 0) > 0) {
    await addPoints(
      inv.lineUserId,
      -(inv.pointsEarned || 0),
      "ยกเลิกการชำระ (แก้ไข)",
      "Reverse payment",
      inv.customerName
    );
  }

  // ลบประวัติบริการ (กันจำนวนครั้งเกินจริง)
  await deleteServiceRecordByInvoice(id);

  inv.status = "pending";
  inv.paymentMethod = undefined;
  inv.paidAt = undefined;
  inv.pointsEarned = undefined;
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("invoices")
      .update({ status: "pending", payment_method: null, paid_at: null, points_earned: null })
      .eq("id", id);
  }

  await recalculateCustomerTier(inv.customerId);
  return { ok: true as const, invoice: inv };
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
