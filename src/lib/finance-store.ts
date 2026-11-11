import { getSupabase, selectAllRows } from "./supabase/server";
import { healWrite } from "./heal-write";
import { requireTenantId } from "./tenant-context";

export type FinanceRecord = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
  customerId?: string;
  invoiceId?: string;
  /** รูปบิล/ใบเสร็จที่แนบไว้ (URL ใน storage) — ไว้เป็นหลักฐานตอนยื่นภาษี */
  receiptUrl?: string;
  /**
   * ไม่นับเป็นรายรับ/รายจ่ายของกิจการ — เก็บแถวไว้ดูได้ แต่ไม่เข้ายอดสรุปและเอกสารภาษี
   * ใช้กับยอดยกมาจากระบบเก่า หรือรายการที่ไม่ใช่เงินเข้า-ออกจริง
   * (ต้องรัน "อัปเดตฐานข้อมูล" ก่อนถึงจะบันทึกได้)
   */
  excluded?: boolean;
  /** สาขา (ร้านหลายสาขา) — ว่าง = ตามบิลที่ผูก หรือสาขาแรก ดู branches.ts */
  branchId?: string;
  createdAt: string;
};

type FinanceRow = {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  customer_id: string | null;
  invoice_id: string | null;
  receipt_url?: string | null;
  excluded?: boolean | null;
  branch_id?: string | null;
  created_at: string;
};

const mem: FinanceRecord[] = [];

function rowToFinance(r: FinanceRow): FinanceRecord {
  return {
    id: r.id,
    type: r.type as "income" | "expense",
    amount: Number(r.amount),
    category: r.category,
    description: r.description,
    date: r.date,
    customerId: r.customer_id || undefined,
    invoiceId: r.invoice_id || undefined,
    receiptUrl: r.receipt_url || undefined,
    excluded: r.excluded === true,
    branchId: r.branch_id || undefined,
    createdAt: r.created_at,
  };
}

export async function listFinance(from?: string, to?: string) {
  const sb = getSupabase();
  let list: FinanceRecord[];
  if (sb) {
    const tenantId = requireTenantId();
    const data = await selectAllRows<FinanceRow>((a, b) => {
      let q = sb.from("finance_records").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false })
        .order("id");
      if (from) q = q.gte("date", from);
      if (to) q = q.lte("date", to);
      return q.range(a, b);
    });
    list = data.map(rowToFinance);
  } else {
    list = mem.filter((r) => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }
  return list;
}

/** รวมรายรับที่บันทึกแล้วของบิลนี้ (เช่น มัดจำที่รับไปก่อน) — ใช้คิดยอดคงเหลือจริง */
export async function incomeForInvoice(invoiceId: string): Promise<number> {
  const all = await listFinance();
  return all
    .filter((r) => r.invoiceId === invoiceId && r.type === "income")
    .reduce((s, r) => s + r.amount, 0);
}

/**
 * ผูก "มัดจำล่วงหน้า" ที่เคยรับไว้ก่อนมีบิล (ยังไม่ผูก invoiceId) เข้ากับบิลนี้ ตามยอดที่หักไปจริง
 *
 * เงินไม่ได้เข้าซ้ำ — แค่ติดป้าย invoiceId ให้รายรับก้อนเดิมที่เคยลงบัญชีไปแล้วตอนรับมัดจำ
 * (FIFO: ก้อนเก่าก่อน, ถ้าก้อนใหญ่กว่าที่ต้องผูกก็แยกเป็น 2 ก้อน) ไม่งั้นตอนปิดบิล
 * incomeForInvoice(id) จะหาไม่เจอว่าเคยรับเงินส่วนนี้มาก่อน แล้วบันทึกยอดเต็มซ้ำอีกรอบตอนปิดบิล
 */
export async function attachAdvanceIncomeToInvoice(
  customerId: string,
  invoiceId: string,
  amount: number
) {
  const target = Math.round(amount);
  if (target <= 0 || !customerId) return;

  const rows = (await listFinance())
    .filter(
      (r) =>
        r.type === "income" &&
        r.customerId === customerId &&
        !r.invoiceId &&
        r.category === "มัดจำ"
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  const sb = getSupabase();
  let remaining = target;
  for (const r of rows) {
    if (remaining <= 0) break;
    const take = Math.min(r.amount, remaining);
    if (take >= r.amount) {
      // ผูกทั้งก้อน
      if (sb) {
        await sb
          .from("finance_records")
          .update({ invoice_id: invoiceId })
          .eq("id", r.id)
          .eq("tenant_id", requireTenantId());
      } else {
        const m = mem.find((x) => x.id === r.id);
        if (m) m.invoiceId = invoiceId;
      }
    } else {
      // ก้อนนี้ใหญ่กว่าที่ต้องผูก — แยกเป็น 2: ก้อนที่ผูกกับบิลนี้ + ก้อนที่เหลือ (ยังไม่ผูก)
      if (sb) {
        await sb
          .from("finance_records")
          .update({ amount: r.amount - take })
          .eq("id", r.id)
          .eq("tenant_id", requireTenantId());
      } else {
        const m = mem.find((x) => x.id === r.id);
        if (m) m.amount -= take;
      }
      await addFinanceEntry({
        type: "income",
        amount: take,
        category: r.category,
        description: r.description,
        date: r.date,
        customerId: r.customerId,
        invoiceId,
      });
    }
    remaining -= take;
  }
}

export type FinanceRecordEnriched = FinanceRecord & {
  customerName?: string;
  catName?: string;
  displayTitle: string;
};

export async function listFinanceEnriched(
  from?: string,
  to?: string
): Promise<FinanceRecordEnriched[]> {
  const list = await listFinance(from, to);
  const { getCustomer } = await import("./customers-store");
  const { getInvoice } = await import("./invoices-store");

  // บิล/ลูกค้าเดียวกันมีหลายรายการ (มัดจำ + ยอดคงเหลือ) — ดึงครั้งเดียวต่อ id ไม่ยิงซ้ำทุกแถว
  const invoiceCache = new Map<string, ReturnType<typeof getInvoice>>();
  const customerCache = new Map<string, ReturnType<typeof getCustomer>>();
  const invoiceOf = (id: string) => {
    if (!invoiceCache.has(id)) invoiceCache.set(id, getInvoice(id).catch(() => undefined));
    return invoiceCache.get(id)!;
  };
  const customerOf = (id: string) => {
    if (!customerCache.has(id)) customerCache.set(id, getCustomer(id).catch(() => undefined));
    return customerCache.get(id)!;
  };
  /** รายรับของบิลที่ปิดแล้วแต่ลงคนละวันกับวันที่บิล — ซ่อมให้ตรง (ดู paidInvoiceIncomeDay) */
  const misdated: { id: string; day: string }[] = [];

  const enriched = await Promise.all(
    list.map(async (r) => {
      let customerName: string | undefined;
      let catName: string | undefined;

      if (r.invoiceId) {
        const inv = await invoiceOf(r.invoiceId);
        if (inv) {
          customerName = inv.customerName;
          catName = inv.catName;
          const day = paidInvoiceIncomeDay(inv, r);
          if (day && day !== r.date) {
            misdated.push({ id: r.id, day });
            r = { ...r, date: day };
          }
        }
      }
      if (r.customerId) {
        const c = await customerOf(r.customerId);
        if (c) {
          customerName = customerName || c.name;
          if (!catName && c.cats.length === 1) catName = c.cats[0].name;
        }
      }

      const desc = (r.description || "").trim();
      const hasCustomerInDesc =
        customerName && desc.includes(customerName);
      const genericDesc =
        !desc || desc === r.category || desc === "อาบน้ำ" || desc === "service";

      let displayTitle = desc;
      if (customerName && (!desc || genericDesc || !hasCustomerInDesc)) {
        displayTitle = catName
          ? `🐾 ${catName} · ${customerName}`
          : `👤 ${customerName}`;
        if (desc && genericDesc && desc !== r.category) {
          displayTitle += ` — ${desc}`;
        } else if (r.category && r.category !== "member" && r.category !== "service") {
          displayTitle += ` — ${r.category}`;
        }
      } else if (!displayTitle) {
        displayTitle = r.category || "รายการ";
      }

      return { ...r, customerName, catName, displayTitle };
    })
  );

  if (misdated.length) await moveFinanceDates(misdated);
  return enriched;
}

/** หมวดรายรับ "รับเงินบางส่วน" (ผ่อนเป็นงวด) — ลงตามวันที่รับเงินจริงแต่ละงวด ไม่ย้ายไปวันที่บิล */
const PARTIAL_CATEGORY = "รับเงินบางส่วน";

/**
 * บิลที่ปิดแล้ว: รายรับทุกก้อนของบิล (มัดจำ + ยอดคงเหลือ) นับในวันที่บิล ให้ตรงกับหน้าบิล
 * เดิมมัดจำลงตามวันที่กดรับมัดจำ — บิลที่มัดจำครบยอด/รับมัดจำไว้คนละเดือน เลยไม่โผล่ในยอดเดือนของบิล
 * คืน undefined = แถวนี้ไม่ต้องย้าย (บิลยังไม่ปิด / รายจ่าย / งวดผ่อน / ติ๊กไม่นับไว้)
 */
export function paidInvoiceIncomeDay(
  inv: { status?: string; paidAt?: string },
  r: Pick<FinanceRecord, "type" | "category" | "excluded">
): string | undefined {
  if (inv.status !== "paid" || !inv.paidAt) return undefined;
  if (r.type !== "income" || r.excluded || r.category === PARTIAL_CATEGORY) return undefined;
  const day = inv.paidAt.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}

/** ย้ายวันที่ของรายการเงินหลายแถว (จัดกลุ่มตามวันปลายทาง ยิงทีละวัน) */
async function moveFinanceDates(rows: { id: string; day: string }[]) {
  const byDay = new Map<string, string[]>();
  for (const r of rows) byDay.set(r.day, [...(byDay.get(r.day) || []), r.id]);
  const sb = getSupabase();
  for (const [day, ids] of byDay) {
    if (sb) {
      try {
        await sb.from("finance_records").update({ date: day }).eq("tenant_id", requireTenantId()).in("id", ids);
      } catch {
        /* ซ่อมไม่ได้ตอนนี้ — หน้าการเงินยังโชว์วันที่ถูกให้อยู่แล้ว รอบหน้าซ่อมใหม่ */
      }
    } else {
      for (const m of mem) if (ids.includes(m.id)) m.date = day;
    }
  }
}

/** ย้ายรายรับทุกก้อนของบิลที่ปิดแล้วไปวันที่บิล (ตอนปิดบิล / เปลี่ยนวันที่บิล) */
export async function alignInvoiceIncomeDates(inv: { id: string; status?: string; paidAt?: string }) {
  const rows = (await listFinance()).filter((r) => r.invoiceId === inv.id);
  const fix = rows
    .map((r) => ({ id: r.id, day: paidInvoiceIncomeDay(inv, r), date: r.date }))
    .filter((r): r is { id: string; day: string; date: string } => !!r.day && r.day !== r.date);
  if (fix.length) await moveFinanceDates(fix);
}

export async function addFinanceEntry(
  data: Omit<FinanceRecord, "id" | "createdAt">
) {
  // ยอดติดลบทำให้รายงานเพี้ยน (รายรับติดลบ = ยอดขายหายไปเฉยๆ) — บันทึกเป็นค่าสัมบูรณ์
  // ถ้าตั้งใจจะลงรายจ่าย ให้เลือกประเภท "รายจ่าย" ไม่ใช่ใส่เลขติดลบในรายรับ
  data = { ...data, amount: Math.abs(Math.round(Number(data.amount) || 0)) };

  const rec: FinanceRecord = {
    ...data,
    id: `F${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("finance_records").insert({
      id: rec.id,
      tenant_id: requireTenantId(),
      type: rec.type,
      amount: rec.amount,
      category: rec.category,
      description: rec.description,
      date: rec.date,
      customer_id: rec.customerId || null,
      invoice_id: rec.invoiceId || null,
      created_at: rec.createdAt,
    });
    // แนบรูปบิลแยก เพราะร้านที่ยังไม่รัน migration จะ insert ไม่ผ่านทั้งแถว
    if (rec.receiptUrl) {
      await healWrite("finance_records", ["receipt_url"], () => sb.from("finance_records").update({ receipt_url: rec.receiptUrl }).eq("id", rec.id).eq("tenant_id", requireTenantId()));
    }
    if (rec.branchId) {
      await healWrite("finance_records", ["branch_id"], () => sb.from("finance_records").update({ branch_id: rec.branchId }).eq("id", rec.id).eq("tenant_id", requireTenantId()));
    }
    return rec;
  }

  mem.unshift(rec);
  return rec;
}

/** แก้ไขรายการการเงินทีละอัน */
export async function updateFinanceEntry(
  id: string,
  patch: Partial<
    Pick<FinanceRecord, "type" | "amount" | "category" | "description" | "date" | "receiptUrl">
  >
) {
  const sb = getSupabase();
  if (sb) {
    const row: Record<string, unknown> = {};
    if (patch.type !== undefined) row.type = patch.type;
    if (patch.amount !== undefined) row.amount = patch.amount;
    if (patch.category !== undefined) row.category = patch.category;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.date !== undefined) row.date = patch.date;
    if (Object.keys(row).length)
      await sb
        .from("finance_records")
        .update(row)
        .eq("id", id)
        .eq("tenant_id", requireTenantId());
    // รูปบิล — เขียนแยกและกลืน error (คอลัมน์ receipt_url อาจยังไม่มี)
    if (patch.receiptUrl !== undefined) {
      await healWrite("finance_records", ["receipt_url"], () => sb.from("finance_records").update({ receipt_url: patch.receiptUrl || null }).eq("id", id).eq("tenant_id", requireTenantId()));
    }
    return { ok: true as const };
  }
  const r = mem.find((x) => x.id === id);
  if (r) Object.assign(r, patch);
  return { ok: true as const };
}

/** เปลี่ยนชื่อน้องในคำอธิบายรายการการเงินของลูกค้า (ดู cat-rename.ts) — คืนจำนวนที่แก้ */
export async function renameCatInFinance(customerId: string, oldName: string, newName: string) {
  const { replaceCatInDescription } = await import("./cat-name-replace");
  const sb = getSupabase();
  const tenantId = sb ? requireTenantId() : "";
  const rows: FinanceRecord[] = sb
    ? (
        ((
          await sb
            .from("finance_records")
            .select("*")
            .eq("customer_id", customerId)
            .eq("tenant_id", tenantId)
        ).data as FinanceRow[] | null) || []
      ).map(rowToFinance)
    : mem.filter((r) => r.customerId === customerId);
  let n = 0;
  for (const r of rows) {
    const description = replaceCatInDescription(r.description || "", oldName, newName);
    if (description === r.description) continue;
    if (sb)
      await sb
        .from("finance_records")
        .update({ description })
        .eq("id", r.id)
        .eq("tenant_id", tenantId);
    else r.description = description;
    n++;
  }
  return n;
}

/** ลบรายการการเงินทีละอัน (เอารายการทดสอบออก ก่อนใช้จริง) */
export async function deleteFinanceEntry(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("finance_records")
      .delete()
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
    return { ok: true as const };
  }
  const idx = mem.findIndex((r) => r.id === id);
  if (idx >= 0) mem.splice(idx, 1);
  return { ok: true as const };
}

/** ลบรายการรายรับ-รายจ่ายทั้งหมดของบิลนี้ (ใช้ตอนลบบิล เพื่อไม่ให้ยอดค้างในบัญชี) */
export async function deleteFinanceByInvoice(invoiceId: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("finance_records")
      .delete()
      .eq("invoice_id", invoiceId)
      .eq("tenant_id", requireTenantId());
    return;
  }
  for (let i = mem.length - 1; i >= 0; i--) {
    if (mem[i].invoiceId === invoiceId) mem.splice(i, 1);
  }
}

/** ลบเฉพาะรายรับ "ยอดชำระ" ของบิล (คงรายการมัดจำไว้) — ใช้ตอนยกเลิกการชำระ (แก้ไข) */
/** ลบรายรับ "ยอดปิดบิล" ของบิลนี้ — คงมัดจำและเงินที่รับบางส่วนไว้ (เป็นเงินที่รับมาจริงก่อนปิดบิล) */
export async function deleteInvoicePaymentIncome(invoiceId: string) {
  const sb = getSupabase();
  if (sb) {
    await sb
      .from("finance_records")
      .delete()
      .eq("invoice_id", invoiceId)
      .eq("tenant_id", requireTenantId())
      .not("category", "in", '("มัดจำ","รับเงินบางส่วน")');
    return;
  }
  for (let i = mem.length - 1; i >= 0; i--) {
    if (
      mem[i].invoiceId === invoiceId &&
      mem[i].category !== "มัดจำ" &&
      mem[i].category !== "รับเงินบางส่วน"
    )
      mem.splice(i, 1);
  }
}

export async function financeSummary(from?: string, to?: string) {
  // รายการที่ติ๊ก "ไม่นับเป็นรายได้" ไม่เข้ายอดสรุป (เช่นยอดยกมาจากระบบเก่า)
  const list = (await listFinance(from, to)).filter((r) => !r.excluded);
  const income = list.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = list.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  return { income, expense, net: income - expense, count: list.length };
}

/** ติ๊ก/ปลดติ๊ก "ไม่นับเป็นรายได้" — graceful ถ้ายังไม่ได้อัปเดตฐานข้อมูล */
export async function setFinanceExcluded(id: string, excluded: boolean) {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("finance_records")
      .update({ excluded })
      .eq("id", id)
      .eq("tenant_id", requireTenantId());
    if (error) return { ok: false as const, error: "need_sql" };
    return { ok: true as const };
  }
  const m = mem.find((r) => r.id === id);
  if (!m) return { ok: false as const, error: "not_found" };
  m.excluded = excluded;
  return { ok: true as const };
}

export async function todayFinance() {
  const today = new Date().toISOString().slice(0, 10);
  return financeSummary(today, today);
}

export async function monthFinance(yearMonth?: string) {
  const ym = yearMonth || new Date().toISOString().slice(0, 7);
  return financeSummary(`${ym}-01`, `${ym}-31`);
}
