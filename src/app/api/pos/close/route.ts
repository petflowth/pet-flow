import { NextRequest, NextResponse } from "next/server";
import { bangkokToday } from "@/lib/bangkok-date";
import { closeDay, dayTotals, getClosing, listClosings } from "@/lib/pos-store";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { getSiteConfig } from "@/lib/config-store";
import { adminBranchScope } from "@/lib/branch-scope";
import { isMultiBranch, mainBranchId, recordBranchId, shopBranches } from "@/lib/branches";

/**
 * ยอดของวัน + การปิดยอดที่บันทึกไว้ + ประวัติปิดยอด
 * ร้านหลายสาขา: เลือกสาขาอยู่ = ลิ้นชักของสาขานั้น · ดูทุกสาขา = ยอดรวม + ยอดและผลปิดยอดของแต่ละสาขา (ดูอย่างเดียว)
 */
async function handleGet(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || bangkokToday();
  const config = await getSiteConfig();
  const multi = isMultiBranch(config);
  const scope = multi ? await adminBranchScope(req) : null;
  const mainId = mainBranchId(config);
  const nameOf = (id?: string) => shopBranches(config).find((b) => b.id === recordBranchId(config, id))?.name || "";
  const history = (await listClosings(multi ? 14 * shopBranches(config).length : 14)).map((c) =>
    multi ? { ...c, branchId: recordBranchId(config, c.branchId), branchName: nameOf(c.branchId) } : c
  );

  if (multi && !scope) {
    const [totals, branches] = await Promise.all([
      dayTotals(date),
      Promise.all(
        shopBranches(config).map(async (b) => ({
          id: b.id,
          name: b.name,
          totals: await dayTotals(date, b.id),
          closing: await getClosing(date, b.id, b.id === mainId),
        }))
      ),
    ]);
    return NextResponse.json({ date, totals, closing: null, history, allBranches: true, branches });
  }

  const [totals, closing] = await Promise.all([
    dayTotals(date, scope),
    getClosing(date, scope, !!scope && scope === mainId),
  ]);
  return NextResponse.json({
    date,
    totals,
    closing,
    history: scope ? history.filter((c) => c.branchId === scope) : history,
    branchName: scope ? nameOf(scope) : "",
  });
}

/** บันทึกปิดยอด {countedCash, openingCash, note, date?} — ร้านหลายสาขาปิดทีละสาขา (ลิ้นชักใครลิ้นชักมัน) */
async function handlePost(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.countedCash == null || body.countedCash === "") {
    return NextResponse.json({ error: "กรอกเงินสดที่นับได้" }, { status: 400 });
  }
  const config = await getSiteConfig();
  const multi = isMultiBranch(config);
  const scope = multi ? await adminBranchScope(req) : null;
  if (multi && !scope) {
    return NextResponse.json({ error: "เลือกสาขาที่แถบด้านบนก่อน แล้วค่อยปิดยอดของสาขานั้น" }, { status: 400 });
  }
  try {
    const closing = await closeDay({
      date: body.date ? String(body.date) : undefined,
      openingCash: Number(body.openingCash) || 0,
      countedCash: Number(body.countedCash) || 0,
      note: body.note ? String(body.note) : undefined,
      branchId: scope,
      isMainBranch: !!scope && scope === mainBranchId(config),
    });
    return NextResponse.json({ ok: true, closing });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** หลังบ้านเท่านั้น — ทำงานในนามร้านของคนที่ล็อกอินอยู่ */
async function getAdminSession(req: NextRequest) {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handleGet(req));
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return withTenant(session.tenantId, () => handlePost(req));
}
