import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withTenantEvenIfClosed } from "@/lib/tenant-context";
import { uploadPrivateDataUrl } from "@/lib/supabase/storage";
import { isOverdue } from "@/lib/tenant-billing";
import {
  createPayment,
  getBillingSettings,
  getTenantBilling,
  listPayments,
  planPrice,
  type Plan,
  type PlanBranches,
} from "@/lib/subscription-store";

export const dynamic = "force-dynamic";

/** สลิปรูปเดียว ไม่ควรเกินนี้ (data URL base64) */
const MAX_SLIP = 8_000_000;

/**
 * ค่าบริการ PetFlow ของร้านตัวเอง — วันครบกำหนด ราคาแพ็กเกจ บัญชีรับเงิน และสลิปที่เคยส่ง
 * ร้านที่เลยกำหนดจ่ายต้องเข้าหน้านี้ได้ (ไว้อัปสลิป) จึงไม่ใช้ withTenant ที่ปิดร้านค้างจ่าย
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [t, settings, payments] = await Promise.all([
    getTenantBilling(session.tenantId),
    getBillingSettings(),
    listPayments({ tenantId: session.tenantId, limit: 20 }).catch(() => []),
  ]);
  return NextResponse.json({
    status: t?.status || "active",
    dueDate: t?.dueDate || null,
    branchLimit: t?.branchLimit || 1,
    overdue: isOverdue(t?.dueDate),
    settings,
    payments,
  });
}

/** เจ้าของร้านส่งสลิป → รอผู้ดูแลระบบอนุมัติ */
export async function POST(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.role !== "owner" && !(session.menus || []).includes("/admin/subscription")) {
    return NextResponse.json({ error: "เฉพาะเจ้าของร้าน หรือพนักงานที่ได้สิทธิ์เมนูค่าบริการ" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const plan: Plan = body.plan === "year" ? "year" : "month";
  const slip = typeof body.slip === "string" ? body.slip : "";
  if (!slip.startsWith("data:image/") || slip.length > MAX_SLIP) {
    return NextResponse.json({ error: "แนบรูปสลิปก่อนนะคะ (ไม่เกิน 5MB)" }, { status: 400 });
  }
  const pending = (await listPayments({ tenantId: session.tenantId, limit: 20 })).filter((p) => p.status === "pending");
  if (pending.length >= 3) {
    return NextResponse.json({ error: "มีสลิปรออนุมัติอยู่แล้ว รอสักครู่นะคะ" }, { status: 429 });
  }

  const settings = await getBillingSettings();
  const branches: PlanBranches = Number(body.branches) === 2 ? 2 : 1;
  const amount = planPrice(settings, plan, branches);
  if (branches === 2 && !amount) {
    return NextResponse.json({ error: "แพ็กเกจ 2 สาขายังไม่เปิดให้เลือก ติดต่อ PetFlow นะคะ" }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const slipUrl = await withTenantEvenIfClosed(session.tenantId, () =>
    uploadPrivateDataUrl(`subscription-slips/${id}`, slip)
  );
  if (slipUrl.startsWith("data:")) {
    return NextResponse.json({ error: "อัปโหลดสลิปไม่สำเร็จ ลองใหม่อีกครั้งนะคะ" }, { status: 500 });
  }
  await createPayment({
    id,
    tenantId: session.tenantId,
    plan,
    branches,
    amount,
    slipUrl,
    note: String(body.note || "").slice(0, 300),
  });
  return NextResponse.json({ ok: true });
}
