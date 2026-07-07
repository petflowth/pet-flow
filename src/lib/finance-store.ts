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

const records: FinanceRecord[] = [];

export function listFinance(from?: string, to?: string) {
  return records.filter((r) => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  });
}

export function addFinanceEntry(
  data: Omit<FinanceRecord, "id" | "createdAt">
) {
  const rec: FinanceRecord = {
    ...data,
    id: `F${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  records.unshift(rec);
  return rec;
}

export function financeSummary(from?: string, to?: string) {
  const list = listFinance(from, to);
  const income = list
    .filter((r) => r.type === "income")
    .reduce((s, r) => s + r.amount, 0);
  const expense = list
    .filter((r) => r.type === "expense")
    .reduce((s, r) => s + r.amount, 0);
  return { income, expense, net: income - expense, count: list.length };
}

export function todayFinance() {
  const today = new Date().toISOString().slice(0, 10);
  return financeSummary(today, today);
}

export function monthFinance(yearMonth?: string) {
  const ym = yearMonth || new Date().toISOString().slice(0, 7);
  return financeSummary(`${ym}-01`, `${ym}-31`);
}
