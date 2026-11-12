import { toast } from "@/components/Toast";

/**
 * หลังกดรับชำระเงินสำเร็จ — ร้านเปิด "ถามว่าจะส่งใบเสร็จไหม" + ลูกค้าผูก LINE แล้ว
 * → ถาม แล้วส่งการ์ดใบเสร็จถ้ากดตกลง (ยกเลิก = ไม่ส่ง ส่งเองทีหลังได้ที่ปุ่ม ส่ง LINE)
 */
export async function askSendReceipt(
  invoiceId: string,
  d: { receiptAsk?: boolean; receiptSentBefore?: boolean }
) {
  if (!d.receiptAsk) return;
  const ok = window.confirm(
    "ส่งใบเสร็จให้ลูกค้าทาง LINE เลยไหม?" +
      (d.receiptSentBefore ? "\n(บิลนี้เคยส่งใบเสร็จไปแล้ว — ตกลง = ส่งซ้ำ)" : "")
  );
  if (!ok) return;
  try {
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: invoiceId, action: "send_receipt" }),
    });
    if (res.ok) toast("ส่งใบเสร็จทาง LINE แล้ว 🧾", "success");
    else toast("ส่งใบเสร็จไม่สำเร็จ — กดส่งเองที่ปุ่ม ส่ง LINE", "error");
  } catch {
    toast("ส่งใบเสร็จไม่สำเร็จ — กดส่งเองที่ปุ่ม ส่ง LINE", "error");
  }
}
