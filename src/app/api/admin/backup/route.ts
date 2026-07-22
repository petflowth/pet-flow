import { NextRequest, NextResponse } from "next/server";
import {
  listCustomers,
  listAllServiceRecords,
  listAllMemberTopups,
} from "@/lib/customers-store";
import { listFinance } from "@/lib/finance-store";
import { listBookings } from "@/lib/bookings-store";
import { listInvoices } from "@/lib/invoices-store";
import { getAllPointsMap } from "@/lib/points-store";
import { listPromos, listPromoClaims } from "@/lib/promos-store";
import { listStaff } from "@/lib/staff-store";
import { listAllCoupons, listOffers } from "@/lib/coupons-store";
import { listAllPackages } from "@/lib/packages-store";
import { listArticles } from "@/lib/articles-store";
import { getSiteConfig } from "@/lib/config-store";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * สำรองข้อมูลทั้งร้านเป็นไฟล์ JSON ไฟล์เดียว (ดาวน์โหลดเก็บไว้เอง)
 *
 * ต่างจาก backup ลง Google Sheets: อันนั้นอ่านง่ายแต่ถูกยุบให้อยู่ในตาราง
 * (เช่น รายการในบิลกลายเป็นข้อความบรรทัดเดียว) เอากลับมาใส่ระบบต้องพิมพ์ใหม่
 * ไฟล์นี้เก็บข้อมูลครบทุกฟิลด์ตามโครงจริง — เอาไปกู้คืนได้
 *
 * ครอบคลุม staff_users / member_topups / service_records ด้วย — เดิมขาด 3 ตารางนี้:
 * รหัสพนักงานหายต้องออกใหม่ทุกคน, log การเติมเครดิตแต่ละครั้งหาย (เหลือแค่ยอดรวม),
 * และประวัติใช้บริการละเอียดหาย (แม้ยอดรวมยังอยู่ใน invoices ก็ตาม)
 *
 * middleware กันไว้แล้วว่าต้องล็อกอินหลังบ้านก่อน
 */
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, handleGet);
}

async function handleGet() {
  const [
    customers,
    finance,
    bookings,
    invoices,
    points,
    promos,
    promoClaims,
    staff,
    serviceRecords,
    memberTopups,
    coupons,
    couponOffers,
    packages,
    articles,
    config,
  ] = await Promise.all([
    listCustomers(),
    listFinance(),
    listBookings(),
    listInvoices(),
    getAllPointsMap(),
    listPromos(),
    listPromoClaims(),
    listStaff(),
    listAllServiceRecords(),
    listAllMemberTopups(),
    listAllCoupons(),
    listOffers(),
    listAllPackages(),
    listArticles(true),
    getSiteConfig(),
  ]);

  const snapshot = {
    _meta: {
      exportedAt: new Date().toISOString(),
      shop: config.business?.name || "",
      note: "สำรองข้อมูลทั้งระบบ — เก็บไฟล์นี้ไว้ในที่ปลอดภัย มีข้อมูลส่วนตัวของลูกค้าและรหัสพนักงาน",
      counts: {
        customers: customers.length,
        cats: customers.reduce((n, c) => n + (c.cats?.length || 0), 0),
        bookings: bookings.length,
        invoices: invoices.length,
        finance: finance.length,
        points: Object.keys(points).length,
        promos: promos.length,
        staff: staff.length,
        serviceRecords: serviceRecords.length,
        memberTopups: memberTopups.length,
        coupons: coupons.length,
        couponOffers: couponOffers.length,
        packages: packages.length,
        articles: articles.length,
      },
    },
    customers,
    bookings,
    invoices,
    finance,
    points,
    promos,
    promoClaims,
    staff,
    serviceRecords,
    memberTopups,
    coupons,
    couponOffers,
    packages,
    articles,
    config,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
