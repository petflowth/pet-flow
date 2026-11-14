import { calcBill, cardFee, round2, type BillLineInput } from "@/lib/salon/shared";
import { body, check, getVisit, loadSettings, num, salonRoute, sdb, str, SalonError } from "@/lib/salon/server";

/**
 * เก็บเงินปิดบิล { visit_id, discount, points_used, payments: [{method, amount, reference, card_last4}], idem_key }
 * เซิร์ฟเวอร์คำนวณยอดเองจากรายการในคิว ไม่เชื่อยอดที่หน้าจอส่งมา
 * idem_key เดิมซ้ำ (กดซ้ำ/เน็ตหลุด) = ได้บิลเดิมกลับ ไม่เก็บเงินซ้ำ
 */
export const POST = salonRoute(async (req, { shop, by }) => {
  const b = await body(req);
  const idem = str(b.idem_key, 80);
  if (!idem) throw new SalonError(400, "ข้อมูลไม่ครบ ลองใหม่");
  const visit = await getVisit(shop, str(b.visit_id, 40));
  if (visit.bill) return { ok: true, bill_id: visit.bill.id, bill_no: visit.bill.bill_no, duplicate: true };
  if (["cancelled", "no_show"].includes(visit.status)) throw new SalonError(409, "คิวนี้ถูกยกเลิกแล้ว");

  const settings = await loadSettings(shop);
  const lines: BillLineInput[] = visit.services.map((s) => ({
    kind: "service",
    ref_id: s.service_id,
    name: s.name,
    qty: 1,
    unit_price: s.final_price ?? s.quoted_price,
    stylist_id: s.stylist_id || visit.stylist_id,
    assistant_id: null,
  }));
  if (!lines.length) throw new SalonError(400, "ยังไม่มีรายการบริการ");

  const calc = calcBill({
    lines,
    discount: num(b.discount),
    points_used: num(b.points_used),
    customer_points: visit.customer?.points || 0,
    has_customer: !!visit.customer_id,
    deposit_paid: visit.deposit_paid,
    settings,
  });

  const raw = Array.isArray(b.payments) ? (b.payments as Record<string, unknown>[]) : [];
  const payments = raw
    .map((p, seq) => {
      const method = ["cash", "transfer", "card"].includes(String(p.method)) ? String(p.method) : "";
      const amount = round2(num(p.amount));
      return {
        method,
        amount,
        fee_amount: method === "card" ? cardFee(settings, amount) : 0,
        reference: str(p.reference, 80),
        card_last4: str(p.card_last4, 4).replace(/\D/g, ""),
        seq,
      };
    })
    .filter((p) => p.method && p.amount > 0);
  const paid = round2(payments.reduce((a, p) => a + p.amount, 0));
  if (Math.abs(paid - calc.due) > 0.009) {
    throw new SalonError(400, `ยอดรับเงิน ${paid.toLocaleString()} ไม่ตรงกับยอดที่ต้องจ่าย ${calc.due.toLocaleString()} บาท`);
  }
  // มัดจำเกินยอดบิล — บันทึกว่าคืนเงินสดส่วนต่างให้ลูกค้า
  if (calc.refund_deposit > 0) {
    payments.push({ method: "cash", amount: -calc.refund_deposit, fee_amount: 0, reference: "คืนมัดจำส่วนเกิน", card_last4: "", seq: payments.length });
  }

  const res = check(
    await sdb().rpc("checkout", {
      p: {
        shop_id: shop,
        visit_id: visit.id,
        customer_id: visit.customer_id,
        subtotal: calc.subtotal,
        discount: calc.discount,
        points_used: calc.points_used,
        points_value: calc.points_value,
        total: calc.total,
        deposit_applied: calc.deposit_applied,
        paid: round2(calc.deposit_applied + paid),
        points_earned: calc.points_earned,
        points_expire_months: settings.points.expire_months,
        status: "paid",
        idem_key: idem,
        by,
        lines: calc.lines,
        payments,
        commissions: [],
      },
    })
  ) as { bill_id: string; bill_no?: number; duplicate: boolean };

  return {
    ok: true,
    ...res,
    total: calc.total,
    points_earned: calc.points_earned,
    refund_deposit: calc.refund_deposit,
  };
});
