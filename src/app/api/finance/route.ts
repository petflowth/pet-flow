import { NextRequest, NextResponse } from "next/server";
import { listFinance, listFinanceEnriched, addFinanceEntry, financeSummary } from "@/lib/finance-store";

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get("from") || undefined;
  const to = req.nextUrl.searchParams.get("to") || undefined;
  const summary = req.nextUrl.searchParams.get("summary") === "1";

  if (summary) {
    return NextResponse.json({ summary: await financeSummary(from, to) });
  }

  return NextResponse.json({ records: await listFinanceEnriched(from, to) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const rec = await addFinanceEntry({
    type: body.type,
    amount: Number(body.amount),
    category: body.category || "ทั่วไป",
    description: body.description || "",
    date: body.date || new Date().toISOString().slice(0, 10),
    customerId: body.customerId,
    invoiceId: body.invoiceId,
  });
  return NextResponse.json({ ok: true, record: rec });
}
