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
import { calcPromoDiscount, recordAdminPromoClaim } from "./promos-store";
import { addPoints } from "./points-store";
import { getSupabase } from "./supabase/server";
import { requireTenantId } from "./tenant-context";
import { summarizeInvoiceItems } from "./invoice-item-label";

export type InvoiceItem = {
  label: string;
  /** ยอดรวมของรายการนี้แล้ว (คูณจำนวนแล้ว) */
  amount: number;
  /** ประเภทรายการ — ใช้เช็คว่าบิลนี้มีอาบน้ำ/กรูมรวมอยู่ไหม (แม่นกว่าเดารูปแบบข้อความ) */
  kind?: "grooming" | "room" | "service" | "custom" | "freebie";
  /** น้องแมวตัวไหน — บิลบ้านที่มีหลายตัวจะได้รู้ว่าตัวไหนอาบโปรแกรมอะไร */
  catName?: string;
  /** จำนวนชิ้น (ไม่ใส่ = 1) — ซื้อหลายชิ้นไม่ต้องเพิ่มทีละบรรทัด */
  qty?: number;
  /** ราคาต่อหน่วย (ไม่ใส่ = เท่ากับ amount) — เก็บไว้ให้บิลย้อนหลังอ่านออก */
  unitAmount?: number;
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
  /** คอร์สที่บิลนี้หักไป 1 ครั้ง — ไว้โชว์ประวัติการใช้ + คืนครั้งให้ตอนยกเลิกบิล */
  packageId?: string;
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
  package_id?: string | null;
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
    packageId: r.package_id || undefined,
    sentAt: r.sent_at || undefined,
    createdAt: r.created_at,
    depositReceivedAt: r.deposit_received_at ?? undefined,
    deletedAt: r.deleted_at ?? undefined,
  };
}

function invoiceToRow(inv: InvoiceRecord) {
  return {
    id: inv.id,
    tenant_id: requireTenantId(),
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
    let q = sb
      .from("invoices")
      .select("*")
      .eq("tenant_id", requireTenantId())
      .order("created_at", { ascending: false });
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
      .eq("tenant_id", requireTenantId())
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
    const { data } = await sb
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", requireTenantId())
      .maybeSingle();
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
  /** คอร์สที่บิลนี้หัก 1 ครั้ง — เก็บไว้เพื่อโชว์ประวัติการใช้ + คืนครั้งตอนยกเลิกบิล */
  packageId?: string;
}) {
  // บังคับให้ทุกยอดเป็นตัวเลขจำนวนเต็มก่อนคิด — กันค่าที่ไม่ใช่ตัวเลขทำบิลพัง
  // (เมื่อก่อน amount ที่เป็น string จะถูกต่อสตริง เช่น 0 + "abc" = "0abc" แล้ว total กลายเป็น null
  //  ส่วนทศนิยมก็โผล่เป็น 0.30000000000000004 บนบิลลูกค้า)
  const items = (data.items || []).map((i) => {
    const qty = Math.max(1, Math.round(Number(i.qty) || 1));
    // ราคาต่อหน่วย: ถ้าไม่ได้ส่งมา ให้ถอดจากยอดรวม เพื่อให้บิลเก่า (ที่ไม่มี qty) ยังถูกต้อง
    const unit = Math.round(
      Number(i.unitAmount ?? (Number(i.amount) || 0) / qty) || 0
    );
    return {
      ...i,
      qty,
      unitAmount: unit,
      amount: unit * qty,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
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
    // สุ่มต่อท้ายด้วย — ออกบิล 2 ใบในมิลลิวินาทีเดียวกันเคยได้ id ชนกัน
    id: `INV${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    customerId: data.customerId,
    lineUserId: data.lineUserId,
    customerName: data.customerName,
    catName: data.catName,
    items,
    subtotal,
    discount,
    deposit,
    promoId: data.promoId,
    promoLabel: label,
    total,
    status: "pending",
    bookingId: data.bookingId,
    packageId: data.packageId,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("invoices").insert(invoiceToRow(invoice));
    // package_id เพิ่งเพิ่มมาทีหลัง — เขียนแยกและกลืน error ไว้
    // เครื่องที่ยังไม่ได้อัปเดตฐานข้อมูลจะได้ไม่พังทั้งการออกบิล
    if (invoice.packageId) {
      try {
        await sb
          .from("invoices")
          .update({ package_id: invoice.packageId })
          .eq("id", invoice.id)
          .eq("tenant_id", requireTenantId());
      } catch {
        /* ยังไม่มีคอลัมน์ — ประวัติการใช้คอร์สจะยังไม่ขึ้นจนกว่าจะอัปเดตฐานข้อมูล */
      }
    }
  } else {
    mem.unshift(invoice);
  }

  // เลือกโปรจาก dropdown ตอนออกบิล → บันทึกว่าลูกค้าใช้สิทธิ์แล้ว กันเห็นเป็นใช้ได้อีกในแอป
  if (data.promoId && data.customerId) {
    await recordAdminPromoClaim(
      data.promoId,
      data.customerId,
      data.customerName,
      data.lineUserId
    );
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
      await sb
        .from("invoices")
        .update({ deposit_received_at: receivedAt })
        .eq("id", id)
        .eq("tenant_id", requireTenantId());
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
    await sb
      .from("invoices")
      .update(invoiceToRow(inv))
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
  }
  return { ok: true as const, invoice: inv };
}

/**
 * ผูกบิลเข้ากับนัดด้วยมือ — ใช้ตอนบิลไม่มีนัดผูกอยู่ (เช่นบิลเก่าก่อนมีระบบผูกอัตโนมัติ
 * หรือพิมพ์บิลเองไม่ได้ดึงจากนัด) ทำให้ปุ่มส่งการ์ดที่ต้องอิงนัด (แจ้งเตือนนัด/ส่งชุดการ์ด)
 * กลับมาใช้ได้ ไม่แตะยอดเงิน จึงทำได้แม้บิลจะปิดจ่ายแล้วก็ตาม
 */
export async function linkInvoiceToBooking(id: string, bookingId: string) {
  const inv = await getInvoice(id);
  if (!inv) return { ok: false as const, error: "not_found" };
  inv.bookingId = bookingId;
  const sb = getSupabase();
  if (sb) {
    await sb.from("invoices").update({ booking_id: bookingId }).eq("id", id);
  }
  return { ok: true as const, invoice: inv };
}

/** ลบบิล + รายการบัญชีที่ผูกกับบิลนั้น (ไม่ให้ยอดค้าง) */
/** ลบบิล (ย้ายลงถังขยะ กู้คืนได้) + ลบรายการบัญชีที่ผูก (กู้คืนตอน restore) */
export async function deleteInvoice(id: string) {
  const inv = await getInvoice(id);
  if (!inv) return { ok: false as const, error: "not_found" };
  await deleteFinanceByInvoice(id);
  // ลบบิลที่หักคอร์สไป → คืนครั้งให้ลูกค้าด้วย ไม่งั้นสิทธิ์หายไปเฉยๆ
  if (inv.packageId && inv.status === "paid") {
    const { refundPackageUse } = await import("./packages-store");
    await refundPackageUse(inv.packageId);
  }
  const now = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("invoices")
        .update({ deleted_at: now })
        .eq("id", id)
        .eq("tenant_id", requireTenantId());
      if (error) throw new Error(error.message);
    } catch {
      // ยังไม่ได้รัน migration deleted_at → ลบจริงไปเลย (กู้ไม่ได้)
      await sb
        .from("invoices")
        .delete()
        .eq("id", id)
        .eq("tenant_id", requireTenantId());
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
    await sb
      .from("invoices")
      .update({ deleted_at: null })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
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
    await sb
      .from("invoices")
      .update({ sent_at: inv.sentAt })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
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
    // ปิดบิลแบบมีเงื่อนไข: อัปเดตได้เฉพาะตอนที่ยัง "ไม่ paid" เท่านั้น
    // ถ้าอีกคลิกหนึ่ง (หรืออีกเครื่อง) ปิดไปก่อนแล้ว จะไม่มีแถวถูกแก้ → หยุดตรงนี้
    // ไม่งั้นจะลงรายรับซ้ำ / ให้แต้มซ้ำ / หักเครดิต Member ซ้ำ
    const { data: claimed } = await sb
      .from("invoices")
      .update({
        status: inv.status,
        payment_method: inv.paymentMethod,
        paid_at: inv.paidAt,
        points_earned: inv.pointsEarned,
      })
      .eq("id", id)
      .eq("tenant_id", requireTenantId())
      .neq("status", "paid")
      .select("id");
    if (!claimed || claimed.length === 0) {
      // แพ้การแข่ง — คืนเครดิต Member ที่เพิ่งหักไป แล้วรายงานว่าปิดไปแล้ว
      if (paymentMethod === "member_credit" && settleAmount > 0) {
        await addMemberCredit(inv.customerId, settleAmount);
      }
      return { ok: false as const, error: "already_paid" };
    }
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

  // สรุปรายการแบบสั้นๆ ไม่ซ้ำ — ของเดิมต่อ label ดิบทุกรายการเข้าด้วยกัน (มีชื่อน้อง/พันธุ์/ไซส์/ตัวคูณ
  // ห้อยท้ายทุกอัน) พอบิลมีหลายตัว/หลายรายการ ยอดในหน้ารายรับ-รายจ่ายเลยยาวจนอ่านไม่ไหว
  const serviceSummary = summarizeInvoiceItems(inv.items);

  // บันทึกรายรับเฉพาะ "ยอดคงเหลือจริง" ที่เก็บรอบนี้ (มัดจำถูกบันทึกไปก่อนแล้ว)
  if (settleAmount > 0) {
    const isRemainder = alreadyReceived > 0;
    await addFinanceEntry({
      type: "income",
      amount: settleAmount,
      category: paymentMethod === "member_credit" ? "member" : serviceSummary,
      description: `${inv.catName} · ${inv.customerName} — ${serviceSummary}${
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

  // คืนครั้งที่หักจากคอร์สไป — ไม่งั้นยกเลิกบิลแล้วลูกค้าเสียสิทธิ์ฟรีๆ
  if (inv.packageId) {
    const { refundPackageUse } = await import("./packages-store");
    await refundPackageUse(inv.packageId);
  }

  inv.status = "pending";
  inv.paymentMethod = undefined;
  inv.paidAt = undefined;
  inv.pointsEarned = undefined;
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("invoices")
      .update({ status: "pending", payment_method: null, paid_at: null, points_earned: null })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
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
