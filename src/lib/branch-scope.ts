import { getSiteConfig } from "./config-store";
import { getSupabase } from "./supabase/server";
import { healWrite } from "./heal-write";
import { requireTenantId } from "./tenant-context";
import { getSessionFrom } from "./auth";
import {
  BRANCH_COOKIE,
  bookingBranchId,
  isMultiBranch,
  knownBranchId,
  recordBranchId,
  staffBranchIds,
} from "./branches";
import type { SiteConfig } from "./config-types";

type CookieReq = { cookies: { get(name: string): { value: string } | undefined } };

/**
 * สาขาที่หลังบ้านเลือกดูอยู่ (จากปุ่มเลือกสาขาบนหัวหลังบ้าน)
 * คืน null = ดูทุกสาขา / ร้านสาขาเดียว / ค่าในคุกกี้ไม่ใช่สาขาของร้านนี้
 * ต้องเรียกใน withTenant ของคนที่ล็อกอินหลังบ้านแล้วเท่านั้น
 */
export async function adminBranchScope(req: CookieReq): Promise<string | null> {
  const raw = req.cookies.get(BRANCH_COOKIE)?.value;
  const session = await getSessionFrom(req).catch(() => null);
  const limited = session?.role === "staff" && (session.branches || []).length > 0;
  if (!raw && !limited) return null;
  const config = await getSiteConfig();
  if (!isMultiBranch(config)) return null;
  const picked = raw ? knownBranchId(config, decodeURIComponent(raw)) || null : null;
  // พนักงานที่เจ้าของจำกัดสาขาไว้: ดูได้เฉพาะสาขาของตัวเอง (ไม่มี "ทุกสาขา") — คุกกี้ชี้สาขาอื่น = ใช้สาขาแรกที่ได้รับ
  const allowed = limited ? staffBranchIds(config, session?.branches) : null;
  if (allowed) return picked && allowed.includes(picked) ? picked : allowed[0];
  return picked;
}

/** สาขาที่คนที่ล็อกอินอยู่ใช้ได้ — null = ไม่จำกัด (เจ้าของร้าน / พนักงานที่เห็นทุกสาขา) */
export async function staffAllowedBranches(req: CookieReq, config: SiteConfig): Promise<string[] | null> {
  const session = await getSessionFrom(req).catch(() => null);
  if (session?.role !== "staff") return null;
  return staffBranchIds(config, session.branches);
}

/** บันทึกสาขาให้แถวที่เพิ่งสร้าง (best-effort · ยังไม่ migrate ก็ซ่อมเองแล้วเขียนใหม่) */
export async function setRecordBranch(
  table: "bookings" | "invoices" | "pos_sales" | "finance_records",
  id: string,
  branchId: string | null | undefined
) {
  const sb = getSupabase();
  if (!sb || !branchId || !id) return;
  await healWrite(table, ["branch_id"], () =>
    sb.from(table).update({ branch_id: branchId }).eq("id", id).eq("tenant_id", requireTenantId())
  );
}

type BookingLike = { id: string; branchId?: string; room?: string; service?: string };
type InvoiceLike = { id: string; branchId?: string; bookingId?: string };

/**
 * ตัวกรองรายการตามสาขา — โหลดนัด/บิลมาเท่าที่ต้องใช้หาสาขาของบิลที่ผูกนัด
 * และรายการเงินที่ผูกบิล (ของเก่าที่ยังไม่มีสาขาของตัวเอง)
 */
export async function branchFilter(branchId: string, config?: SiteConfig) {
  const cfg = config || (await getSiteConfig());
  const { listBookings } = await import("./bookings-store");
  const { listInvoices } = await import("./invoices-store");

  let bookingMap: Map<string, BookingLike> | null = null;
  const bookingsById = async () => {
    if (!bookingMap) bookingMap = new Map((await listBookings()).map((b) => [b.id, b]));
    return bookingMap;
  };
  const invoiceBranch = async (inv: InvoiceLike) => {
    if (inv.branchId && knownBranchId(cfg, inv.branchId)) return inv.branchId;
    if (inv.bookingId) {
      const b = (await bookingsById()).get(inv.bookingId);
      if (b) return bookingBranchId(cfg, b);
    }
    return recordBranchId(cfg, inv.branchId);
  };
  let invoiceBranchMap: Map<string, string> | null = null;
  const invoiceBranchById = async () => {
    if (!invoiceBranchMap) {
      const m = new Map<string, string>();
      for (const inv of await listInvoices()) m.set(inv.id, await invoiceBranch(inv));
      invoiceBranchMap = m;
    }
    return invoiceBranchMap;
  };

  return {
    bookings<T extends { branchId?: string; room?: string; service?: string }>(list: T[]): T[] {
      return list.filter((b) => bookingBranchId(cfg, b) === branchId);
    },
    async invoices<T extends InvoiceLike>(list: T[]): Promise<T[]> {
      const out: T[] = [];
      for (const inv of list) if ((await invoiceBranch(inv)) === branchId) out.push(inv);
      return out;
    },
    sales<T extends { branchId?: string }>(list: T[]): T[] {
      return list.filter((s) => recordBranchId(cfg, s.branchId) === branchId);
    },
    async finance<T extends { branchId?: string; invoiceId?: string }>(list: T[]): Promise<T[]> {
      const needInvoices = list.some((r) => !knownBranchId(cfg, r.branchId) && r.invoiceId);
      const map = needInvoices ? await invoiceBranchById() : null;
      return list.filter((r) => {
        const own = knownBranchId(cfg, r.branchId);
        if (own) return own === branchId;
        const viaInvoice = r.invoiceId ? map?.get(r.invoiceId) : undefined;
        return (viaInvoice || recordBranchId(cfg)) === branchId;
      });
    },
  };
}
