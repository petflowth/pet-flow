import { NextRequest, NextResponse } from "next/server";
import {
  listArticles,
  saveArticle,
  deleteArticle,
} from "@/lib/articles-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OWNER_CODE = process.env.NEXT_PUBLIC_ADMIN_CODE || "catcha2026";
const isAdmin = (req: NextRequest) =>
  (req.headers.get("x-admin-code") || "") === OWNER_CODE;

/** รายการบทความ — สาธารณะเห็นเฉพาะที่เผยแพร่ · แอดมิน (?all=1 + header) เห็นฉบับร่างด้วย */
export async function GET(req: NextRequest) {
  const wantAll = req.nextUrl.searchParams.get("all") === "1" && isAdmin(req);
  const articles = await listArticles(wantAll);
  return NextResponse.json({ articles });
}

/** เพิ่ม/แก้บทความ — เฉพาะแอดมิน */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const res = await saveArticle({
    id: body.id ? String(body.id) : undefined,
    slug: String(body.slug || ""),
    title: String(body.title || ""),
    description: String(body.description || ""),
    body: String(body.body || ""),
    coverDataUrl: body.coverDataUrl ? String(body.coverDataUrl) : undefined,
    emoji: body.emoji ? String(body.emoji) : undefined,
    published: typeof body.published === "boolean" ? body.published : undefined,
    datePublished: body.datePublished ? String(body.datePublished) : undefined,
  });
  if (!res.ok) {
    const messages: Record<string, string> = {
      missing_fields: "กรอกหัวข้อและ slug ให้ครบ",
      slug_in_use: "slug นี้ถูกใช้แล้ว — ตั้งชื่อลิงก์อื่น",
      need_sql: "ต้องอัปเดตฐานข้อมูลก่อน (ตั้งค่า → ขั้นสูง → อัปเดตฐานข้อมูล)",
    };
    return NextResponse.json(
      { error: messages[res.error] || res.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, article: res.article });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "admin_only" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteArticle(id);
  return NextResponse.json({ ok: true });
}
