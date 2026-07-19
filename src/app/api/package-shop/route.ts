import { NextRequest, NextResponse } from "next/server";
import {
  listPackageOffers,
  createPackageOffer,
  setPackageOfferActive,
  deletePackageOffer,
  listPackageOrders,
  createPackageOrder,
  attachOrderSlip,
  confirmPackageOrder,
  cancelPackageOrder,
} from "@/lib/package-shop-store";
import { findCustomerByLine, getCustomer } from "@/lib/customers-store";
import { getPaymentConfig } from "@/lib/payment-config";
import { getSiteConfig } from "@/lib/config-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { pushLineMessage, buildPackageFlex } from "@/lib/line";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** ล็อกอินหลังบ้านอยู่ไหม — route นี้ใช้ร่วมกันทั้งแอปลูกค้าและหลังบ้าน */
async function isAdmin(req: NextRequest) {
  return !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
}

/**
 * GET — แอปลูกค้า: ?lineUserId=... ได้รายการที่เปิดขาย + บัญชีโอน + ออร์เดอร์ของตัวเอง
 *       หลังบ้าน: ไม่ต้องส่ง lineUserId ได้ทุกออร์เดอร์ + รายการขายทั้งหมด (รวมที่ปิดอยู่)
 */
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")?.trim();
  const admin = await isAdmin(req);

  if (!lineUserId && !admin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (lineUserId) {
    // ลูกค้า — เห็นเฉพาะที่เปิดขาย และเห็นเฉพาะออร์เดอร์ของตัวเอง
    const customer = await findCustomerByLine(lineUserId);
    const [offers, payment] = await Promise.all([
      listPackageOffers(true),
      getPaymentConfig(),
    ]);
    const orders = customer
      ? await listPackageOrders({ customerId: customer.id })
      : [];
    return NextResponse.json({ offers, orders, payment });
  }

  const [offers, orders] = await Promise.all([
    listPackageOffers(),
    listPackageOrders(),
  ]);
  return NextResponse.json({ offers, orders });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  /* ── ลูกค้ากดซื้อ ── */
  if (action === "order") {
    const lineUserId = String(body.lineUserId || "").trim();
    if (!lineUserId) {
      return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
    }
    const customer = await findCustomerByLine(lineUserId);
    if (!customer) {
      return NextResponse.json({ error: "not_registered" }, { status: 400 });
    }
    const offers = await listPackageOffers(true);
    const offer = offers.find((o) => o.id === String(body.offerId || ""));
    if (!offer) {
      return NextResponse.json({ error: "offer_not_found" }, { status: 404 });
    }

    const order = await createPackageOrder({
      customerId: customer.id,
      customerName: customer.name,
      lineUserId,
      offer,
    });

    await sendTelegram(
      formatBookingTelegram("🛒 ลูกค้าสั่งซื้อคอร์ส (รอโอน)", {
        ลูกค้า: customer.name,
        คอร์ส: `${offer.name} (${offer.totalUses} ครั้ง)`,
        ยอดที่ต้องโอน: `${offer.price.toLocaleString()} บาท`,
        หมายเหตุ: "รอลูกค้าโอน + ร้านกดยืนยันรับเงิน",
      })
    );

    return NextResponse.json({ ok: true, order, payment: await getPaymentConfig() });
  }

  /* ── ลูกค้าแนบสลิป ── */
  if (action === "slip") {
    const lineUserId = String(body.lineUserId || "").trim();
    const orderId = String(body.orderId || "").trim();
    const slip = String(body.slip || "");
    if (!lineUserId || !orderId || !slip) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }
    // ต้องเป็นออร์เดอร์ของตัวเองเท่านั้น กันแนบสลิปทับออร์เดอร์คนอื่น
    const customer = await findCustomerByLine(lineUserId);
    const orders = customer ? await listPackageOrders({ customerId: customer.id }) : [];
    if (!orders.some((o) => o.id === orderId)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const res = await attachOrderSlip(orderId, slip);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    const order = orders.find((o) => o.id === orderId)!;
    await sendTelegram(
      formatBookingTelegram("🧾 ลูกค้าแจ้งสลิปคอร์สแล้ว", {
        ลูกค้า: order.customerName,
        คอร์ส: `${order.name} (${order.totalUses} ครั้ง)`,
        ยอด: `${order.price.toLocaleString()} บาท`,
        ต่อไป: "เช็คสลิปแล้วกดยืนยันรับเงินในหลังบ้าน",
      })
    );
    return NextResponse.json({ ok: true });
  }

  /* ── หลังบ้าน: เพิ่มแพ็กเกจที่จะขาย ── */
  if (action === "create_offer") {
    if (!(await isAdmin(req))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const offer = await createPackageOffer({
      name: String(body.name || ""),
      totalUses: Number(body.totalUses) || 0,
      price: Number(body.price) || 0,
      description: body.description ? String(body.description) : undefined,
    });
    if (!offer) {
      return NextResponse.json({ error: "name + totalUses required" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, offer });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

/** หลังบ้านทั้งหมด — ยืนยันรับเงิน / ยกเลิกออร์เดอร์ / เปิด-ปิด-ลบรายการขาย */
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "confirm_order") {
    const res = await confirmPackageOrder(String(body.orderId || ""), {
      isLegacy: Boolean(body.isLegacy),
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    const customer = await getCustomer(res.order.customerId);
    await sendTelegram(
      formatBookingTelegram("✅ ยืนยันรับเงินค่าคอร์สแล้ว", {
        ลูกค้า: res.order.customerName,
        คอร์ส: `${res.order.name} (${res.order.totalUses} ครั้ง)`,
        ยอด: `${res.order.price.toLocaleString()} บาท`,
        ...(body.isLegacy ? { หมายเหตุ: "ยอดยกมา — ไม่นับรายรับเดือนนี้" } : {}),
      })
    );

    // แจ้งลูกค้าว่าคอร์สพร้อมใช้แล้ว — ส่งเสมอ เพราะลูกค้าเป็นคนจ่ายเงินและกำลังรออยู่
    let notifyError: string | undefined;
    if (customer?.lineUserId) {
      const cfg = await getSiteConfig();
      try {
        await pushLineMessage(customer.lineUserId, [
          buildPackageFlex({
            customerName: res.order.customerName,
            packageName: res.pkg.name,
            totalUses: res.pkg.totalUses,
            usedUses: res.pkg.usedUses,
            price: res.pkg.price,
            shopName: cfg.business?.name,
          }, cfg.cards?.packageCard),
        ]);
      } catch (e) {
        notifyError = e instanceof Error ? e.message : String(e);
      }
    }
    return NextResponse.json({ ok: true, package: res.pkg, notifyError });
  }

  if (action === "cancel_order") {
    const res = await cancelPackageOrder(String(body.orderId || ""));
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "set_offer_active") {
    await setPackageOfferActive(String(body.offerId || ""), body.active !== false);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_offer") {
    await deletePackageOffer(String(body.offerId || ""));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
