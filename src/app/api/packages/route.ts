import { NextRequest, NextResponse } from "next/server";
import { getCustomer, findCustomerByLine } from "@/lib/customers-store";
import {
  sellPackage,
  listCustomerPackages,
  activeCustomerPackages,
  cancelPackage,
} from "@/lib/packages-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** คอร์สของลูกค้า (หลังบ้าน: customerId · แอป: lineUserId) */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId")?.trim();
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")?.trim();
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";

  const cust = customerId
    ? await getCustomer(customerId)
    : lineUserId
      ? await findCustomerByLine(lineUserId)
      : undefined;
  if (!cust) return NextResponse.json({ found: false, packages: [] });

  const packages = activeOnly
    ? await activeCustomerPackages(cust.id)
    : await listCustomerPackages(cust.id);
  return NextResponse.json({ found: true, customerId: cust.id, packages });
}

/** ขายคอร์สให้ลูกค้า */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const customerId = String(body.customerId || "").trim();
  const name = String(body.name || "").trim();
  const totalUses = Math.round(Number(body.totalUses) || 0);
  const price = Math.round(Number(body.price) || 0);
  if (!customerId || !name || totalUses <= 0) {
    return NextResponse.json({ error: "customerId + name + totalUses required" }, { status: 400 });
  }
  const cust = await getCustomer(customerId);
  if (!cust) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const pkg = await sellPackage({ customerId, customerName: cust.name, name, totalUses, price });
  await sendTelegram(
    formatBookingTelegram("🎫 ขายคอร์สให้ลูกค้า", {
      ลูกค้า: cust.name,
      คอร์ส: name,
      จำนวน: `${totalUses} ครั้ง`,
      ราคา: `${price} บาท`,
    })
  );
  return NextResponse.json({ ok: true, package: pkg });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "cancel") {
    await cancelPackage(String(body.packageId || ""));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
