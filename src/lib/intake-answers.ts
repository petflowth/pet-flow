import type { StoredBooking } from "@/lib/bookings-store";
import { listBookings } from "@/lib/bookings-store";
import { stayForGroom } from "@/lib/booking-group";
import { bookingMatchesCustomer } from "@/lib/booking-customer-match";
import { catNameKey } from "@/lib/cat-name-replace";
import { getSiteConfig } from "@/lib/config-store";
import {
  findCustomerByLine,
  listCustomers,
  type CatRecord,
  type CustomerRecord,
} from "@/lib/customers-store";
import { isFeatureOn } from "@/lib/features";
import { groomInfoSummary, parseGroomInfo } from "@/lib/groom-info";
import { stayInfoDone, summaryFields } from "@/lib/intake-rules";
import { formKindOf, speciesOf } from "@/lib/pet-kind";
import { escapeHtml } from "@/lib/telegram";

/**
 * คำตอบทั้งหมดที่ลูกค้ากรอกไว้ของนัดหนึ่ง (ฟอร์มก่อนอาบน้ำ / ก่อนเข้าพัก + ข้อมูลสุขภาพจากหน้าสมัคร)
 * ใช้ร่วมกันทั้ง Telegram เช้าวันนัด และการ์ดนัดในหลังร้าน — ทุกข้อ ไม่ตัดเหลือแค่ข้อสำคัญ
 * ข้อที่ยังไม่ตอบขึ้นว่า "ยังไม่ได้ตอบ" ร้านจะได้รู้ว่าขาดอะไร
 */
export type IntakeRow = { label: string; value: string; answered: boolean; required?: boolean };
export type IntakeSection = {
  form: "groom" | "stay" | "signup";
  title: string;
  /** ลูกค้ากรอกเมื่อไร (ISO) */
  submittedAt?: string;
  /** ลูกค้ายังไม่ได้กรอกฟอร์มนี้เลย */
  empty?: boolean;
  /** คำตอบมาจากหน้าสมัครอย่างเดียว ยังไม่ได้กรอกฟอร์มก่อนเข้าพัก */
  fromRegister?: boolean;
  rows: IntakeRow[];
};
export type BookingIntakeAnswers = { catName: string; customerName: string; sections: IntakeSection[] };

const UNANSWERED = "ยังไม่ได้ตอบ";

function findCat(cats: CatRecord[] | undefined, name: string): CatRecord | undefined {
  const key = catNameKey(name || "");
  const exact = cats?.find((c) => catNameKey(c.name) === key);
  if (exact) return exact;
  const bare = (n: string) => catNameKey(n).replace(/^น้อง/, "");
  return bare(name) ? cats?.find((c) => bare(c.name) === bare(name)) : undefined;
}

/** ลูกค้าเจ้าของนัด — จาก LINE → ชื่อลูกค้า+ชื่อน้อง (นัดที่ร้านลงให้) */
async function customerOf(b: StoredBooking, all?: CustomerRecord[]): Promise<CustomerRecord | undefined> {
  if (b.lineUserId) {
    const c = await findCustomerByLine(b.lineUserId).catch(() => undefined);
    if (c) return c;
  }
  const list = all ?? (await listCustomers().catch(() => [] as CustomerRecord[]));
  return list.find((c) => bookingMatchesCustomer(b, c));
}

function formSection(
  form: "groom" | "stay",
  title: string,
  raw: string | undefined,
  cat: CatRecord | undefined,
  cfg: Awaited<ReturnType<typeof getSiteConfig>>
): IntakeSection {
  const info = parseGroomInfo(raw);
  if (!info) return { form, title, empty: true, rows: [] };
  const kind = formKindOf(speciesOf(cat, cfg), cfg);
  const fields = summaryFields(form, kind, cfg, info as Record<string, unknown>);
  const required = new Set((fields ?? []).filter((f) => f.required).map((f) => f.label));
  const rows = Object.entries(groomInfoSummary(info, fields)).map(([label, v]) => ({
    label,
    value: v === "-" ? UNANSWERED : v,
    answered: v !== "-",
    required: required.has(label) || undefined,
  }));
  return {
    form,
    title,
    submittedAt: info.submittedAt,
    fromRegister: form === "stay" ? !stayInfoDone(raw) : undefined,
    rows,
  };
}

/** สร้างคำตอบทั้งหมดของนัด — list = นัดทั้งร้าน (ส่งมาเมื่อมีอยู่แล้ว ไม่ต้องดึงซ้ำ) */
export async function bookingIntakeAnswers(
  b: StoredBooking,
  opts?: { list?: StoredBooking[]; customers?: CustomerRecord[]; config?: Awaited<ReturnType<typeof getSiteConfig>> }
): Promise<BookingIntakeAnswers> {
  const cfg = opts?.config ?? (await getSiteConfig());
  const customer = await customerOf(b, opts?.customers);
  const cat = findCat(customer?.cats, String(b.catName || ""));
  const sections: IntakeSection[] = [];

  const groomOn = isFeatureOn(cfg, "groomInfo");
  const stayOn = isFeatureOn(cfg, "stayInfo");
  if (b.service === "room") {
    if (stayOn) sections.push(formSection("stay", "ข้อมูลก่อนเข้าพัก", cat?.stayInfo, cat, cfg));
    // เข้าพัก + อาบก่อนกลับ → คำตอบส่วนอาบน้ำด้วย
    if (groomOn) {
      const list = opts?.list ?? (await listBookings());
      const hasBath = list.some((g) => g.service === "groom" && stayForGroom(g, list)?.id === b.id);
      if (hasBath) sections.push(formSection("groom", "ประวัติก่อนอาบน้ำ", cat?.groomHealthInfo, cat, cfg));
    }
  } else if (groomOn) {
    sections.push(formSection("groom", "ประวัติก่อนอาบน้ำ", cat?.groomHealthInfo, cat, cfg));
  }

  // ข้อมูลสุขภาพที่ลูกค้าตอบไว้ตอนสมัคร — ฟอร์มก่อนเข้าพักไม่ถามซ้ำ จึงต้องโชว์ตรงนี้ด้วย
  const signup: IntakeRow[] = [
    ["โรคประจำตัว", cat?.medical],
    ["ประวัติชัก/ช็อค", cat?.seizureHistory],
    ["ประวัติการแพ้", cat?.allergy],
  ]
    .filter(([, v]) => String(v || "").trim())
    .map(([label, v]) => ({ label: String(label), value: String(v).trim(), answered: true }));
  if (signup.length) sections.push({ form: "signup", title: "สุขภาพ (จากหน้าสมัคร)", rows: signup });

  return {
    catName: String(b.catName || cat?.name || "-"),
    customerName: b.customerName || customer?.name || "-",
    sections,
  };
}

function thaiDateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    calendar: "gregory",
    timeZone: "Asia/Bangkok",
  });
}

const SECTION_ICON: Record<IntakeSection["form"], string> = { groom: "🩺", stay: "🏠", signup: "💊" };

/** ข้อความ Telegram (HTML) ของนัดหนึ่ง — หัวข้อนัด + คำตอบทุกข้อ */
export function formatIntakeTelegram(b: StoredBooking, a: BookingIntakeAnswers, date: string) {
  const e = escapeHtml;
  const when =
    b.service === "room"
      ? [
          b.checkin === date ? `🏠 เข้าพักวันนี้${b.arrivalTime ? ` · มาส่ง ${b.arrivalTime} น.` : ""}` : "🏠 เข้าพัก",
          `${b.checkin || "-"} → ${b.checkout || "-"}`,
          b.room ? `ห้อง ${b.room}` : "",
        ]
      : [`🛁 อาบน้ำ ${b.time ? `${b.time} น.` : "ไม่ระบุเวลา"}`];
  const lines = [
    `📋 <b>คำตอบลูกค้า — นัดวันนี้</b>`,
    `<b>${e(a.catName)}</b> · ${e(a.customerName)}`,
    e(when.filter(Boolean).join(" · ")),
  ];
  if (b.notes) lines.push(`📝 โน้ตนัด: ${e(b.notes)}`);
  if (!a.sections.length) lines.push("", "ร้านปิดฟอร์มข้อมูลก่อนรับน้องไว้");
  for (const s of a.sections) {
    lines.push("");
    if (s.empty) {
      lines.push(`${SECTION_ICON[s.form]} <b>${e(s.title)}</b>`, `⚠️ ลูกค้ายังไม่ได้กรอกฟอร์มนี้`);
      continue;
    }
    const at = thaiDateTime(s.submittedAt);
    const note = s.fromRegister ? " (จากหน้าสมัคร — ยังไม่ได้กรอกฟอร์มก่อนเข้าพัก)" : at ? ` (กรอกเมื่อ ${e(at)})` : "";
    lines.push(`${SECTION_ICON[s.form]} <b>${e(s.title)}</b>${note}`);
    for (const r of s.rows) {
      lines.push(`<b>${e(r.label)}</b>: ${r.answered ? e(r.value) : `<i>${UNANSWERED}</i>`}`);
    }
  }
  return lines.join("\n");
}

/**
 * นัดของวันนี้ที่ต้องส่งสรุปคำตอบ — นัดอาบน้ำวันนี้ + วันเข้าพักวันนี้ (ไม่รวมยกเลิก/ไม่มา)
 * เรียงตามเวลา เหมือนตารางงานในสรุปเช้า
 */
export function intakeBookingsForDate(all: StoredBooking[], date: string): StoredBooking[] {
  const live = all.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
  const groom = live.filter((b) => b.service === "groom" && b.date === date);
  const checkin = live.filter((b) => b.service === "room" && b.checkin === date);
  const at = (b: StoredBooking) => (b.service === "room" ? b.arrivalTime : b.time) || "99";
  return [...groom, ...checkin].sort((x, y) => at(x).localeCompare(at(y)));
}
