import { NextRequest, NextResponse } from "next/server";

/**
 * ตรวจสิทธิ์ก่อนรัน cron job ใดๆ — fail-closed เสมอ
 *
 * เดิมถ้ายังไม่ได้ตั้งค่า CRON_SECRET ในเซิร์ฟเวอร์ ทุก route จะข้ามการตรวจไปเลย (fail-open)
 * ใครก็ยิง endpoint พวกนี้เองได้โดยไม่ต้องรู้อะไรเลย เช่น สั่งสแปมข้อความ LINE หาลูกค้าทั้งร้าน
 * ผ่าน /api/cron/reminders ซ้ำๆ หรือสั่งรันสำรอง/ล้างข้อมูลตามใจ — ตอนนี้ถ้ายังไม่ตั้งค่า
 * จะปฏิเสธเสมอ (ต้องตั้ง CRON_SECRET ใน Vercel env ก่อน cron ถึงจะทำงานได้จริง)
 *
 * คืน NextResponse ถ้าต้องปฏิเสธ, คืน null ถ้าผ่าน — ใช้แบบ:
 *   const denied = verifyCronSecret(req);
 *   if (denied) return denied;
 */
export function verifyCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET ยังไม่ได้ตั้งค่าในเซิร์ฟเวอร์ — ตั้งใน Vercel env ก่อน" },
      { status: 401 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
