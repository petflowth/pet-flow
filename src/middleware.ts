import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/**
 * ด่านตรวจสิทธิ์ก่อนเข้าถึงหลังบ้าน
 *
 * ก่อนหน้านี้หน้า /admin เช็ครหัสในเบราว์เซอร์อย่างเดียว ส่วน /api เปิดโล่งหมด
 * ใครก็ยิง /api/customers ดึงชื่อ-เบอร์-ที่อยู่ลูกค้าทั้งร้าน หรือ /api/finance ลบบัญชีได้
 * ตอนนี้ทุกอย่างต้องมีคุกกี้ที่เซ็นชื่อ ยกเว้นรายการสาธารณะด้านล่าง
 */

/** เปิดสาธารณะจริง ๆ — แอปลูกค้าใน LINE, webhook ของ LINE/Telegram, cron, ไฟล์ที่ LINE มาดึง */
const PUBLIC_API = [
  "/api/auth/login",
  // แอปลูกค้า (LIFF) — ลูกค้ายังไม่ได้ล็อกอินหลังบ้าน
  "/api/customers/register",
  "/api/customers/link",
  "/api/customers/self",
  "/api/customers/line",
  "/api/customers/cat-photo",
  "/api/bookings/consent",
  "/api/bookings/groom-info",
  "/api/bookings/time",
  "/api/coupons/claim",
  "/api/promos/claim",
  "/api/line/liff",
  // ระบบภายนอกเรียกเข้ามา
  "/api/line/webhook",
  "/api/telegram/webhook",
  "/api/line/broadcast-image",
  "/api/calendar",
  "/api/cron",
];

/** เปิดเฉพาะตอนอ่าน (GET) — เขียนต้องเป็นหลังบ้าน */
const PUBLIC_GET = ["/api/config", "/api/articles", "/api/promos"];

/**
 * ใช้ร่วมกันทั้งลูกค้าและหลังบ้าน — ปล่อยผ่านด่านนี้ แล้วให้ตัว route
 * ตรวจเองว่าคนที่ไม่ได้ล็อกอินทำอะไรได้บ้าง (ดู requireAdmin ใน route)
 */
const SHARED_API = ["/api/bookings"];

function matches(path: string, list: string[]) {
  return list.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (matches(pathname, PUBLIC_API)) return NextResponse.next();
    if (req.method === "GET" && matches(pathname, PUBLIC_GET)) {
      return NextResponse.next();
    }
    if (matches(pathname, SHARED_API)) return NextResponse.next();

    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "ต้องเข้าสู่ระบบหลังบ้านก่อน" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // หน้าหลังบ้าน — ไม่มีคุกกี้ก็เด้งไปหน้าล็อกอิน
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
