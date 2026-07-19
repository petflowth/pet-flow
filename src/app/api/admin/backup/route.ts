import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/customers-store";
import { listFinance } from "@/lib/finance-store";
import { listBookings } from "@/lib/bookings-store";
import { listInvoices } from "@/lib/invoices-store";
import { getAllPointsMap } from "@/lib/points-store";
import { listPromos, listPromoClaims } from "@/lib/promos-store";
import { getSiteConfig } from "@/lib/config-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * สำรองข้อมูลทั้งร้านเป็นไฟล์ JSON ไฟล์เดียว (ดาวน์โหลดเก็บไว้เอง)
 *
 * ต่างจาก backup ลง Google Sheets: อันนั้นอ่านง่ายแต่ถูกยุบให้อยู่ในตาราง
 * (เช่น รายการในบิลกลายเป็นข้อความบรรทัดเดียว) เอากลับมาใส่ระบบต้องพิมพ์ใหม่
 * ไฟล์นี้เก็บข้อมูลครบทุกฟิลด์ตามโครงจริง — เอาไปกู้คืนได้
 *
 * middleware กันไว้แล้วว่าต้องล็อกอินหลังบ้านก่อน
 */
export async function GET() {
  const [customers, finance, bookings, invoices, points, promos, promoClaims, config] =
    await Promise.all([
      listCustomers(),
      listFinance(),
      listBookings(),
      listInvoices(),
      getAllPointsMap(),
      listPromos(),
      listPromoClaims(),
      getSiteConfig(),
    ]);

  const snapshot = {
    _meta: {
      exportedAt: new Date().toISOString(),
      shop: config.business?.name || "",
      note: "สำรองข้อมูลทั้งระบบ — เก็บไฟล์นี้ไว้ในที่ปลอดภัย มีข้อมูลส่วนตัวของลูกค้า",
      counts: {
        customers: customers.length,
        cats: customers.reduce((n, c) => n + (c.cats?.length || 0), 0),
        bookings: bookings.length,
        invoices: invoices.length,
        finance: finance.length,
        points: Object.keys(points).length,
        promos: promos.length,
      },
    },
    customers,
    bookings,
    invoices,
    finance,
    points,
    promos,
    promoClaims,
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
