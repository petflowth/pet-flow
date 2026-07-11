import { NextRequest, NextResponse } from "next/server";
import {
  findCustomerByLine,
  updateCustomer,
  updateCat,
} from "@/lib/customers-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

/** ลูกค้าดึงข้อมูลตัวเอง (สำหรับหน้าแก้ไขโปรไฟล์ใน LINE) */
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")?.trim();
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }
  const c = await findCustomerByLine(lineUserId);
  if (!c) return NextResponse.json({ found: false });
  return NextResponse.json({
    found: true,
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      cats: c.cats.map((x) => ({ id: x.id, name: x.name })),
    },
  });
}

/** ลูกค้าแก้ไขข้อมูลตัวเอง — ชื่อ / เบอร์ / ชื่อน้องแมว (ยืนยันตัวจาก lineUserId ของ LIFF) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const lineUserId = String(body.lineUserId || "").trim();
  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }
  const c = await findCustomerByLine(lineUserId);
  if (!c) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const patch: { name?: string; phone?: string } = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body.phone === "string") patch.phone = body.phone.trim() || undefined;
  if (Object.keys(patch).length) await updateCustomer(c.id, patch);

  if (Array.isArray(body.cats)) {
    for (const cat of body.cats) {
      if (cat?.id && typeof cat.name === "string" && cat.name.trim()) {
        await updateCat(c.id, String(cat.id), { name: cat.name.trim() });
      }
    }
  }

  await sendTelegram(
    formatBookingTelegram("✏️ ลูกค้าแก้ไขข้อมูลตัวเอง", {
      ลูกค้า: patch.name || c.name,
      เบอร์: patch.phone ?? c.phone ?? "-",
    })
  );

  return NextResponse.json({ ok: true });
}
