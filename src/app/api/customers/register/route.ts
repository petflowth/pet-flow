import { NextRequest, NextResponse } from "next/server";
import { registerCustomerFromLine } from "@/lib/customers-store";

type CatBody = {
  name?: string;
  gender?: string;
  breed?: string;
  ageValue?: number | string;
  ageUnit?: string;
  birthday?: string;
  medical?: string;
  staffNote?: string;
};

/** ลูกค้ากรอกฟอร์มลงทะเบียน (ผู้ปกครอง + น้องแมว + ยินยอมรับข่าวสาร) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const lineUserId = String(body.lineUserId || "").trim();
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim();
  const email = String(body.email || "").trim();
  const birthday = String(body.birthday || "").trim();
  const referralSource = String(body.referralSource || "").trim();
  const marketingConsent = body.marketingConsent !== false;
  const cats = Array.isArray(body.cats)
    ? body.cats.map((c: CatBody) => ({
        name: String(c.name || ""),
        gender:
          c.gender === "male" || c.gender === "female" ? c.gender : undefined,
        breed: c.breed ? String(c.breed) : undefined,
        ageValue:
          c.ageValue != null && c.ageValue !== "" && !isNaN(Number(c.ageValue))
            ? Number(c.ageValue)
            : undefined,
        ageUnit: c.ageUnit === "month" ? "month" : c.ageUnit === "year" ? "year" : undefined,
        birthday: c.birthday ? String(c.birthday) : undefined,
        medical: c.medical ? String(c.medical) : undefined,
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

  let customer;
  try {
    customer = await registerCustomerFromLine({
      lineUserId,
      name,
      phone,
      email: email || undefined,
      birthday: birthday || undefined,
      referralSource: referralSource || undefined,
      marketingConsent,
      cats,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("register failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!customer) {
    return NextResponse.json({ error: "ลงทะเบียนไม่สำเร็จ" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      cats: customer.cats.map((cat) => {
        const rest = { ...cat };
        delete rest.staffPrivateNote;
        return rest;
      }),
      tier: customer.tier,
    },
  });
}
