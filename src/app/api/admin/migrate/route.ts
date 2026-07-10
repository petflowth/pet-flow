import { NextResponse } from "next/server";
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
export async function POST() {
  const res = await runMigrations();
  return NextResponse.json({ ...res, bootstrapSql: res.bootstrapNeeded ? EXEC_SQL_BOOTSTRAP : undefined });
}
