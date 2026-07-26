import { NextRequest, NextResponse } from "next/server";
import {
  listProducts,
  createProduct,
  updateProduct,
  setProductImage,
  setProductActive,
  deleteProduct,
  adjustProductStock,
} from "@/lib/products-store";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";

/** สินค้าขายหน้าร้าน — หลังบ้านเท่านั้น (ยังไม่มีหน้าลูกค้าให้ดูแคตตาล็อกนี้) */
async function getAdminSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handleGet(req));
}

async function handleGet(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "1";
  const products = await listProducts(activeOnly);
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePost(req));
}

async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "create");

  if (action === "create") {
    const name = String(body.name || "").trim();
    const category = String(body.category || "").trim();
    const price = Number(body.price) || 0;
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    const product = await createProduct({
      name,
      category,
      price,
      stockCount: Number(body.stockCount) || 0,
      image: body.image ? String(body.image) : undefined,
    });
    if (!product) {
      return NextResponse.json({ error: "create_failed" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, product });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePatch(req));
}

async function handlePatch(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (action === "update") {
    const res = await updateProduct(id, {
      name: body.name !== undefined ? String(body.name) : undefined,
      category: body.category !== undefined ? String(body.category) : undefined,
      price: body.price !== undefined ? Number(body.price) : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
    });
    return NextResponse.json(res);
  }

  if (action === "set_image") {
    const res = await setProductImage(id, String(body.image || ""));
    return NextResponse.json(res);
  }

  if (action === "set_active") {
    const res = await setProductActive(id, Boolean(body.active));
    return NextResponse.json(res);
  }

  if (action === "restock") {
    const delta = Number(body.delta) || 0;
    if (!delta) return NextResponse.json({ error: "delta required" }, { status: 400 });
    const res = await adjustProductStock(id, delta);
    return NextResponse.json(res);
  }

  if (action === "delete") {
    const res = await deleteProduct(id);
    return NextResponse.json(res);
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
