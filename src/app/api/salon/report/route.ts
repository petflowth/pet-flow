import { bangkokToday } from "@/lib/bangkok-date";
import { round2, toIso } from "@/lib/salon/shared";
import { check, isDay, salonRoute, sdb } from "@/lib/salon/server";

/** ยอดของวัน ?day= : เงินเข้าแยกวิธีจ่าย (รวมมัดจำ/เงินคืน) + รายการบิล */
export const GET = salonRoute(async (req, { shop }) => {
  const d = req.nextUrl.searchParams.get("day");
  const day = isDay(d) ? d : bangkokToday();
  const from = toIso(day, "00:00");
  const to = new Date(new Date(from).getTime() + 86400000).toISOString();
  const [pays, bills] = await Promise.all([
    sdb().from("payments").select("kind,method,amount,fee_amount").eq("shop_id", shop).gte("created_at", from).lt("created_at", to),
    sdb()
      .from("bills")
      .select("id,bill_no,visit_id,customer_id,total,status,void_reason,created_at,discount,points_value")
      .eq("shop_id", shop)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("bill_no", { ascending: false }),
  ]);
  const payments = (check(pays) || []) as { kind: string; method: string; amount: number; fee_amount: number }[];
  const billRows = (check(bills) || []) as { id: string; customer_id: string | null; visit_id: string | null; total: number; status: string }[];

  const byMethod: Record<string, number> = { cash: 0, transfer: 0, card: 0 };
  let fees = 0;
  for (const p of payments) {
    byMethod[p.method] = round2((byMethod[p.method] || 0) + Number(p.amount));
    fees = round2(fees + Number(p.fee_amount || 0));
  }
  const live = billRows.filter((b) => b.status !== "void");

  // ชื่อลูกค้าของแต่ละบิล
  const custIds = [...new Set(billRows.map((b) => b.customer_id).filter(Boolean))] as string[];
  const visitIds = [...new Set(billRows.map((b) => b.visit_id).filter(Boolean))] as string[];
  const [cust, vis] = await Promise.all([
    custIds.length ? sdb().from("customers").select("id,name").eq("shop_id", shop).in("id", custIds) : Promise.resolve({ data: [], error: null }),
    visitIds.length ? sdb().from("visits").select("id,guest_name").eq("shop_id", shop).in("id", visitIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const names = new Map<string, string>();
  for (const c of (check(cust) || []) as { id: string; name: string }[]) names.set(c.id, c.name);
  const guests = new Map<string, string>();
  for (const v of (check(vis) || []) as { id: string; guest_name: string | null }[]) guests.set(v.id, v.guest_name || "");

  return {
    day,
    income: round2(live.reduce((a, b) => a + Number(b.total), 0)),
    bill_count: live.length,
    money_in: byMethod,
    money_in_total: round2(byMethod.cash + byMethod.transfer + byMethod.card),
    card_fees: fees,
    bills: billRows.map((b) => ({
      ...b,
      customer_name: (b.customer_id && names.get(b.customer_id)) || (b.visit_id && guests.get(b.visit_id)) || "ลูกค้า",
    })),
  };
});
