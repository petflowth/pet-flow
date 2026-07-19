import { NextRequest, NextResponse } from "next/server";
import {
  listCustomersWithAppointmentCounts,
  searchCustomers,
  getCustomer,
  updateCustomer,
  updateCat,
  updateCatPrivateNote,
  updateCatMedia,
  type CatMediaItem,
  addCat,
  deleteCat,
  deleteCustomer,
  restoreCustomer,
  listTrashedCustomers,
  topupMemberCredit,
  upsertCustomerFromBooking,
  recalculateCustomerTier,
  recalcAllTiers,
} from "@/lib/customers-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { getAllPointsMap } from "@/lib/points-store";
import {
  customerActivityInfo,
  listInactiveCustomers,
  sendCustomerFollowUp,
  sendInactiveFollowUps,
} from "@/lib/customer-crm";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

async function requireTenant(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return session.tenantId;
}

export async function GET(req: NextRequest) {
  const tenantId = await requireTenant(req);
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withTenant(tenantId, () => handleGet(req));
}

async function handleGet(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const q = req.nextUrl.searchParams.get("q");
  const inactive = req.nextUrl.searchParams.get("inactive");

  if (inactive === "1") {
    const days = Number(req.nextUrl.searchParams.get("days")) || undefined;
    const rows = await listInactiveCustomers(days);
    return NextResponse.json({ inactive: rows });
  }

  if (req.nextUrl.searchParams.get("trash") === "1") {
    return NextResponse.json({ customers: await listTrashedCustomers() });
  }

  if (id) {
    const activity = await customerActivityInfo(id);
    if (!activity) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(activity);
  }

  if (q) {
    const [customers, pointsMap] = await Promise.all([
      searchCustomers(q),
      getAllPointsMap(),
    ]);
    return NextResponse.json({
      customers: customers.map((c) => ({
        ...c,
        points: c.lineUserId ? pointsMap[c.lineUserId] ?? 0 : 0,
      })),
    });
  }
  const [customers, pointsMap] = await Promise.all([
    listCustomersWithAppointmentCounts(),
    getAllPointsMap(),
  ]);
  return NextResponse.json({
    customers: customers.map((c) => ({
      ...c,
      points: c.lineUserId ? pointsMap[c.lineUserId] ?? 0 : 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const tenantId = await requireTenant(req);
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withTenant(tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const catName = String(body.catName || "").trim();
  const customerName = String(body.customerName || "").trim();
  if (!customerName || !catName) {
    return NextResponse.json(
      { error: "กรอกชื่อลูกค้าและชื่อน้องแมว" },
      { status: 400 }
    );
  }
  const customer = await upsertCustomerFromBooking({
    customerName,
    catName,
    lineUserId: body.lineUserId,
    phone: body.phone,
    staffNote: body.staffNote,
  });
  return NextResponse.json({ ok: true, customer });
}

export async function PATCH(req: NextRequest) {
  const tenantId = await requireTenant(req);
  if (!tenantId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return withTenant(tenantId, () => handlePatch(req));
}

async function handlePatch(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { id, action } = body;

  if (action === "recalc_all_tiers") {
    const res = await recalcAllTiers();
    return NextResponse.json({ ok: true, ...res });
  }

  if (action === "update_customer") {
    const c = await updateCustomer(id, body.patch);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "update_cat") {
    const c = await updateCat(id, body.catId, body.patch);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "update_cat_private_note") {
    const res = await updateCatPrivateNote(id, body.catId, String(body.note ?? ""));
    if (!res.ok && res.error === "not_found") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    // ถ้ายังไม่ได้รัน SQL (ไม่มีคอลัมน์) จะได้ need_sql — ไม่ถือว่า error ร้ายแรง
    return NextResponse.json({
      ok: res.ok,
      needSql: !res.ok && res.error === "need_sql",
    });
  }

  if (action === "update_cat_media") {
    const media = Array.isArray(body.media) ? (body.media as CatMediaItem[]) : [];
    const res = await updateCatMedia(id, body.catId, media);
    if (!res.ok && res.error === "not_found") {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: res.ok,
      needSql: !res.ok && res.error === "need_sql",
    });
  }

  if (action === "add_cat") {
    try {
      const c = await addCat(id, {
        name: String(body.name || ""),
        staffNote: body.staffNote ? String(body.staffNote) : undefined,
      });
      if (!c) {
        return NextResponse.json({ error: "กรอกชื่อน้องแมว" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, customer: c });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "เพิ่มแมวไม่สำเร็จ" },
        { status: 500 }
      );
    }
  }

  if (action === "delete_cat") {
    try {
      const c = await deleteCat(id, String(body.catId || ""));
      if (!c) {
        return NextResponse.json({ error: "ไม่พบน้องแมว" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, customer: c });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" },
        { status: 500 }
      );
    }
  }

  if (action === "delete_customer") {
    try {
      await deleteCustomer(id);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "ลบไม่สำเร็จ" },
        { status: 500 }
      );
    }
  }

  if (action === "restore_customer") {
    await restoreCustomer(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "topup_member") {
    const paidAmount =
      body.paidAmount != null
        ? Number(body.paidAmount)
        : Number(body.amount) || 0;
    const bonusAmount = Number(body.bonusAmount) || 0;
    const result = await topupMemberCredit(id, {
      paidAmount,
      bonusAmount,
      note: body.note,
    });
    if (!result) {
      return NextResponse.json({ error: "invalid_topup" }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      customer: result.customer,
      topup: result.topup,
    });
  }

  if (action === "set_member") {
    const c = await updateCustomer(id, {
      isMember: Boolean(body.isMember),
      memberCredit: Number(body.memberCredit) || 0,
    });
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    await recalculateCustomerTier(id);
    const refreshed = await getCustomer(id);
    return NextResponse.json({ ok: true, customer: refreshed });
  }

  if (action === "set_tier") {
    const tier = body.tier as CustomerTier;
    const c = await updateCustomer(id, { tier });
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "recalculate_tier") {
    const c = await recalculateCustomerTier(id);
    if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, customer: c });
  }

  if (action === "set_staff_tiers") {
    return NextResponse.json({ error: "use set_tier instead" }, { status: 400 });
  }

  if (action === "send_follow_up") {
    const result = await sendCustomerFollowUp(id, {
      message: body.message ? String(body.message) : undefined,
      force: Boolean(body.force),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, customer: result.customer, message: result.message });
  }

  if (action === "send_inactive_follow_ups") {
    const result = await sendInactiveFollowUps({
      inactiveDays: body.inactiveDays != null ? Number(body.inactiveDays) : undefined,
      limit: body.limit != null ? Number(body.limit) : 20,
      force: Boolean(body.force),
    });
    return NextResponse.json({ ok: true, ...result });
  }

  const c = await getCustomer(id);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ customer: c });
}
