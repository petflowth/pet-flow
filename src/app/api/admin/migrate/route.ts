import { NextRequest, NextResponse } from "next/server";
import { getSessionFrom } from "@/lib/auth";
import {
  runMigrations,
  EXEC_SQL_BOOTSTRAP,
  MIGRATIONS,
} from "@/lib/migrations";

export const runtime = "nodejs";

/** ดูสถานะ + SQL ตั้งค่าครั้งแรก (ไม่แก้อะไร) */
export async function GET() {
  return NextResponse.json({
    migrations: MIGRATIONS.map((m) => m.name),
    bootstrapSql: EXEC_SQL_BOOTSTRAP,
  });
}

/**
 * รัน migration ทั้งหมด (idempotent).
 * ปลอดภัย: endpoint นี้รันเฉพาะ SQL ที่ hardcode ในโค้ด (ไม่รับ SQL จากภายนอก)
 * และ exec_sql เรียกได้เฉพาะ service role.
 */
export async function POST(req: NextRequest) {
  // เจ้าของร้านเท่านั้น — แก้โครงสร้าง DB ไม่ควรให้พนักงานที่จำกัดเมนูรันได้
  const session = await getSessionFrom(req);
  if (session?.role !== "owner") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await runMigrations();
  return NextResponse.json({ ...res, bootstrapSql: res.bootstrapNeeded ? EXEC_SQL_BOOTSTRAP : undefined });
}
