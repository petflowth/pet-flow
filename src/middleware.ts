import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { PLATFORM_SESSION_COOKIE, verifyPlatformSession } from "@/lib/platform-auth";
import { TENANT_COOKIE, TENANT_SLUG_HEADER } from "@/lib/tenant-resolve";

/**
 * ด่านตรวจสิทธิ์ก่อนเข้าถึงหลังบ้าน + จับร้าน (multi-tenant, path-based)
 *
 * ก่อนหน้านี้หน้า /admin เช็ครหัสในเบราว์เซอร์อย่างเดียว ส่วน /api เปิดโล่งหมด
 * ใครก็ยิง /api/customers ดึงชื่อ-เบอร์-ที่อยู่ลูกค้าทั้งร้าน หรือ /api/finance ลบบัญชีได้
 * ตอนนี้ทุกอย่างต้องมีคุกกี้ที่เซ็นชื่อ ยกเว้นรายการสาธารณะด้านล่าง
 *
 * Multi-tenant (R3): ลูกค้าเข้าผ่าน /s/<slug>/... — ด่านนี้ตัด prefix ออก, ใส่ header
 * x-tenant-slug ให้ route อ่าน, ตั้ง cookie pf_tenant เพื่อให้ API call ต่อ ๆ มา
 * (ที่ไม่มี /s) ยังรู้ว่าเป็นร้านไหน แล้ว rewrite ไป path จริง
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
const SHARED_API = ["/api/bookings", "/api/packages", "/api/package-shop"];

function matches(path: string, list: string[]) {
  return list.some((p) => path === p || path.startsWith(`${p}/`));
}

export async function middleware(req: NextRequest) {
  // ── จับร้านจาก /s/<slug>/... (path-based tenant) ───────────────────────────
  // ตัด prefix ออกก่อน แล้วให้ด่านตรวจสิทธิ์ด้านล่างทำงานบน path จริง
  let pathname = req.nextUrl.pathname;
  let tenantSlug: string | null = null;
  const slugMatch = pathname.match(/^\/s\/([a-z0-9-]+)(\/.*|)$/i);
  if (slugMatch) {
    tenantSlug = slugMatch[1].toLowerCase();
    pathname = slugMatch[2] || "/";
  }

  const requestHeaders = new Headers(req.headers);
  if (tenantSlug) requestHeaders.set(TENANT_SLUG_HEADER, tenantSlug);

  /** ปล่อยผ่าน — ถ้ามาจาก /s/<slug> ต้อง rewrite ไป path จริง + แนบ header/cookie */
  function proceed(): NextResponse {
    if (tenantSlug) {
      const dest = req.nextUrl.clone();
      dest.pathname = pathname;
      const res = NextResponse.rewrite(dest, { request: { headers: requestHeaders } });
      setTenantCookie(res);
      return res;
    }
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  /** สำหรับ response ที่ปฏิเสธ (redirect/401) — ยังตั้ง cookie ร้านไว้ให้ครั้งถัดไป */
  function withCookie(res: NextResponse): NextResponse {
    if (tenantSlug) setTenantCookie(res);
    return res;
  }

  function setTenantCookie(res: NextResponse) {
    if (!tenantSlug) return;
    res.cookies.set(TENANT_COOKIE, tenantSlug, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 180, // 180 วัน
    });
  }

  // ผู้ดูแลระบบ — คนละชั้นสิทธิ์กับ /admin (เจ้าของร้าน/พนักงาน) เลยแยกด่านตรวจ
  if (pathname.startsWith("/api/platform/")) {
    if (pathname === "/api/platform/auth") {
      return proceed();
    }
    const session = await verifyPlatformSession(
      req.cookies.get(PLATFORM_SESSION_COOKIE)?.value
    );
    if (!session) {
      return withCookie(
        NextResponse.json({ error: "unauthorized" }, { status: 401 })
      );
    }
    return proceed();
  }

  if (pathname.startsWith("/platform") && pathname !== "/platform/login") {
    const session = await verifyPlatformSession(
      req.cookies.get(PLATFORM_SESSION_COOKIE)?.value
    );
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/platform/login";
      return withCookie(NextResponse.redirect(url));
    }
    return proceed();
  }

  if (pathname.startsWith("/api/")) {
    if (matches(pathname, PUBLIC_API)) return proceed();
    if (req.method === "GET" && matches(pathname, PUBLIC_GET)) {
      return proceed();
    }
    if (matches(pathname, SHARED_API)) return proceed();

    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return withCookie(
        NextResponse.json(
          { error: "unauthorized", message: "ต้องเข้าสู่ระบบหลังบ้านก่อน" },
          { status: 401 }
        )
      );
    }
    return proceed();
  }

  // หน้าหลังบ้าน — ไม่มีคุกกี้ก็เด้งไปหน้าล็อกอิน
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return withCookie(NextResponse.redirect(url));
    }
  }

  return proceed();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*", "/platform/:path*", "/s/:path*"],
};
