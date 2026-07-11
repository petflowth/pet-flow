import { getSupabase } from "./supabase/server";

export type FinanceRecord = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  date: string;
  customerId?: string;
  invoiceId?: string;
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
    createdAt: r.created_at,
  };
}

export async function listFinance(from?: string, to?: string) {
  const sb = getSupabase();
  let list: FinanceRecord[];
  if (sb) {
    let q = sb.from("finance_records").select("*").order("created_at", { ascending: false });
    if (from) q = q.gte("date", from);
    if (to) q = q.lte("date", to);
    const { data } = await q;
    list = ((data as FinanceRow[] | null) || []).map(rowToFinance);
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

  return Promise.all(
    list.map(async (r) => {
      let customerName: string | undefined;
      let catName: string | undefined;

      if (r.invoiceId) {
        const inv = await getInvoice(r.invoiceId);
        if (inv) {
          customerName = inv.customerName;
          catName = inv.catName;
        }
      }
      if (r.customerId) {
        const c = await getCustomer(r.customerId);
        if (c) {
          customerName = customerName || c.name;
          if (!catName && c.cats.length === 1) catName = c.cats[0].name;
        }
      }

      const desc = r.description.trim();
      const hasCustomerInDesc =
        customerName && desc.includes(customerName);
      const genericDesc =
        !desc || desc === r.category || desc === "อาบน้ำ" || desc === "service";

      let displayTitle = desc;
      if (customerName && (!desc || genericDesc || !hasCustomerInDesc)) {
        displayTitle = catName
          ? `🐱 ${catName} · ${customerName}`
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
}

export async function addFinanceEntry(
  data: Omit<FinanceRecord, "id" | "createdAt">
) {
  const rec: FinanceRecord = {
    ...data,
    id: `F${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    await sb.from("finance_records").insert({
      id: rec.id,
      type: rec.type,
      amount: rec.amount,
      category: rec.category,
      description: rec.description,
      date: rec.date,
      customer_id: rec.customerId || null,
      invoice_id: rec.invoiceId || null,
      created_at: rec.createdAt,
    });
    return rec;
  }

  mem.unshift(rec);
  return rec;
}

/** ลบรายการรายรับ-รายจ่ายทั้งหมดของบิลนี้ (ใช้ตอนลบบิล เพื่อไม่ให้ยอดค้างในบัญชี) */
export async function deleteFinanceByInvoice(invoiceId: string) {
  const sb = getSupabase();
  if (sb) {
    await sb.from("finance_records").delete().eq("invoice_id", invoiceId);
    return;
  }
  for (let i = mem.length - 1; i >= 0; i--) {
    if (mem[i].invoiceId === invoiceId) mem.splice(i, 1);
  }
}

export async function financeSummary(from?: string, to?: string) {
  const list = await listFinance(from, to);
  const income = list.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = list.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  return { income, expense, net: income - expense, count: list.length };
}

export async function todayFinance() {
  const today = new Date().toISOString().slice(0, 10);
  return financeSummary(today, today);
}

export async function monthFinance(yearMonth?: string) {
  const ym = yearMonth || new Date().toISOString().slice(0, 7);
  return financeSummary(`${ym}-01`, `${ym}-31`);
}
