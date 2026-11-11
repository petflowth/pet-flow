import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * รุ่นของโค้ดที่เซิร์ฟเวอร์กำลังรันอยู่ — หน้าเว็บที่เปิดค้างไว้ (AppHealth) เอาไปเทียบกับรุ่นของตัวเอง
 * ถ้าไม่ตรง = มีการอัปเดตระบบหลังจากเปิดหน้านั้น หน้าจะโหลดตัวเองใหม่ในจังหวะที่ไม่ทำให้ข้อมูลที่พิมพ์ค้างหาย
 */
export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION || "dev" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
