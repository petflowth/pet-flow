import { NextResponse } from "next/server";
import { cleanupOldBroadcastImages } from "@/lib/broadcast-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ปุ่มในหลังบ้าน — ล้างรูปโปร broadcast เก่าออกจากฐานข้อมูลทันที (กดซ้ำได้ปลอดภัย) */
export async function POST() {
  const result = await cleanupOldBroadcastImages();
  if (!result.ok) {
    const status = result.error === "no-supabase" ? 400 : 500;
    const message =
      result.error === "no-supabase"
        ? "ไม่มีการเชื่อม Supabase (โหมด dev/mem)"
        : result.error || "ทำไม่สำเร็จ";
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json(result);
}
