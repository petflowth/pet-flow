import { NextRequest, NextResponse } from "next/server";
import {
  listPromos,
  getActivePromos,
  addPromo,
  updatePromo,
  deletePromo,
} from "@/lib/promos-store";

export async function GET(req: NextRequest) {
  const active = req.nextUrl.searchParams.get("active") === "1";
  if (active) {
    return NextResponse.json({ promos: await getActivePromos() });
  }
  return NextResponse.json({ promos: await listPromos() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const promo = await addPromo({
    title: body.title,
    body: body.body,
    discountPercent: body.discountPercent,
    discountAmount: body.discountAmount,
    imageUrl: body.imageUrl,
    startDate: body.startDate || new Date().toISOString().slice(0, 10),
    until: body.until,
    active: body.active !== false,
  });
  return NextResponse.json({ ok: true, promo });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const promo = await updatePromo(body.id, body.patch || body);
  if (!promo) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, promo });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deletePromo(id);
  return NextResponse.json({ ok: true });
}
