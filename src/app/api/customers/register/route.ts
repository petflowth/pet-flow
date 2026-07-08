import { NextRequest, NextResponse } from "next/server";
import { registerCustomerFromLine } from "@/lib/customers-store";

/** ลูกค้ากรอกฟอร์มลงทะเบียน (ชื่อ · เบอร์ · แมว) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const lineUserId = String(body.lineUserId || "").trim();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const cats = Array.isArray(body.cats)
    ? body.cats.map((c: { name?: string; staffNote?: string }) => ({
        name: String(c.name || ""),
        staffNote: c.staffNote ? String(c.staffNote) : undefined,
      }))
    : [];

  if (!lineUserId) {
    return NextResponse.json({ error: "lineUserId required" }, { status: 400 });
  }
  if (!name || !phone || cats.filter((c: { name: string }) => c.name.trim()).length === 0) {
    return NextResponse.json(
      { error: "กรอกชื่อ เบอร์โทร และชื่อน้องแมวอย่างน้อย 1 ตัว" },
      { status: 400 }
    );
  }

  const customer = await registerCustomerFromLine({
    lineUserId,
    name,
    phone,
    cats,
  });

  if (!customer) {
    return NextResponse.json({ error: "ลงทะเบียนไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      cats: customer.cats,
      tier: customer.tier,
    },
  });
}
