import type { CustomerRecord, CatRecord } from "./customers-store";
import type { FinanceRecord } from "./finance-store";
import { getGoogleCredentials, isGoogleConfigured } from "./google-config";
import { getSheetsApi } from "./google-auth";
import { listCustomers } from "./customers-store";
import { listFinance } from "./finance-store";
import { catCurrentAgeLabel } from "./cat-age";
import { parseGroomInfo, groomInfoSummary } from "./groom-info";

/** ย่อประวัติก่อนอาบน้ำเป็นบรรทัดเดียวสำหรับใส่ช่องตาราง (ตัดข้อที่ไม่ได้ตอบออก) */
function groomInfoCell(cat?: CatRecord): string {
  const info = parseGroomInfo(cat?.groomHealthInfo);
  if (!info) return "";
  return Object.entries(groomInfoSummary(info))
    .filter(([, v]) => v && v !== "-")
    .map(([k, v]) => `${k}: ${v}`)
    .join(" | ");
}

const CUSTOMERS_SHEET = "ลูกค้า";
const FINANCE_SHEET = "รายรับรายจ่าย";

type CustomerColumn = {
  key: string;
  label: string;
  get: (c: CustomerRecord, cat?: CatRecord) => string;
};

/** คอลัมน์ที่เลือกส่งออกได้ (แก้/เพิ่มได้ที่นี่) */
export const CUSTOMER_COLUMNS: CustomerColumn[] = [
  { key: "id", label: "รหัสลูกค้า", get: (c) => c.id },
  { key: "name", label: "ชื่อผู้ปกครอง", get: (c) => c.name },
  { key: "phone", label: "เบอร์โทร", get: (c) => c.phone || "" },
  { key: "email", label: "อีเมล", get: (c) => c.email || "" },
  { key: "birthday", label: "วันเกิดผู้ปกครอง", get: (c) => c.birthday || "" },
  { key: "referral", label: "รู้จักจาก", get: (c) => c.referralSource || "" },
  { key: "address", label: "ที่อยู่ (รับ-ส่ง)", get: (c) => c.address || "" },
  { key: "addressMap", label: "ลิงก์แผนที่", get: (c) => c.addressMapUrl || "" },
  { key: "postalCode", label: "รหัสไปรษณีย์", get: (c) => c.postalCode || "" },
  { key: "consent", label: "ยินยอมรับข่าวสาร", get: (c) => (c.marketingConsent ? "ใช่" : "ไม่") },
  { key: "line", label: "ผูก LINE", get: (c) => (c.lineUserId ? "ผูกแล้ว" : "") },
  { key: "member", label: "สมาชิก", get: (c) => (c.isMember ? "ใช่" : "ไม่") },
  { key: "credit", label: "เครดิตคงเหลือ", get: (c) => String(c.memberCredit) },
  { key: "depositCredit", label: "เครดิตมัดจำล่วงหน้า", get: (c) => String(c.depositCredit || 0) },
  { key: "tier", label: "กลุ่มลูกค้า", get: (c) => c.tier || "" },
  { key: "catName", label: "ชื่อแมว", get: (_c, cat) => cat?.name || "" },
  {
    key: "catGender",
    label: "เพศแมว",
    get: (_c, cat) =>
      cat?.gender === "male" ? "ผู้" : cat?.gender === "female" ? "เมีย" : "",
  },
  { key: "catBreed", label: "พันธุ์", get: (_c, cat) => cat?.breed || "" },
  {
    key: "catFur",
    label: "ลักษณะขน",
    get: (_c, cat) =>
      cat?.furLength === "short" ? "ขนสั้น" : cat?.furLength === "long" ? "ขนยาว" : "",
  },
  { key: "catColor", label: "สี/ลักษณะเด่น", get: (_c, cat) => cat?.color || "" },
  { key: "catAge", label: "อายุ", get: (_c, cat) => (cat ? catCurrentAgeLabel(cat) : "") },
  { key: "catBirthday", label: "วันเกิดแมว", get: (_c, cat) => cat?.birthday || "" },
  { key: "catMedical", label: "โรคประจำตัว", get: (_c, cat) => cat?.medical || "" },
  { key: "catGroomInfo", label: "ประวัติก่อนอาบน้ำ", get: (_c, cat) => groomInfoCell(cat) },
  { key: "catNote", label: "โน้ตแมว", get: (_c, cat) => cat?.staffNote || "" },
  { key: "catPrivateNote", label: "โน้ตลับร้าน", get: (_c, cat) => cat?.staffPrivateNote || "" },
  { key: "createdAt", label: "วันที่สมัคร", get: (c) => c.createdAt.slice(0, 10) },
  { key: "updatedAt", label: "อัปเดตล่าสุด", get: (c) => c.updatedAt.slice(0, 10) },
];

const DEFAULT_CUSTOMER_KEYS = CUSTOMER_COLUMNS.map((c) => c.key);

const FINANCE_HEADERS = [
  "ID",
  "วันที่",
  "ประเภท",
  "จำนวน (บาท)",
  "หมวด",
  "รายละเอียด",
  "รหัสลูกค้า",
  "รหัสบิล",
  "บันทึกเมื่อ",
];

function customerRows(
  customers: CustomerRecord[],
  cols: CustomerColumn[]
): string[][] {
  const rows: string[][] = [];
  for (const c of customers) {
    if (!c.cats.length) {
      rows.push(cols.map((col) => col.get(c, undefined)));
      continue;
    }
    for (const cat of c.cats) {
      rows.push(cols.map((col) => col.get(c, cat)));
    }
  }
  return rows;
}

function financeRows(records: FinanceRecord[]): string[][] {
  return records.map((r) => [
    r.id,
    r.date,
    r.type === "income" ? "รายรับ" : "รายจ่าย",
    String(r.amount),
    r.category,
    r.description,
    r.customerId || "",
    r.invoiceId || "",
    r.createdAt.slice(0, 19).replace("T", " "),
  ]);
}

async function ensureSheetTab(spreadsheetId: string, title: string) {
  const sheets = await getSheetsApi();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === title);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
  }
}

async function writeSheet(
  spreadsheetId: string,
  title: string,
  headers: string[],
  rows: string[][]
) {
  const sheets = await getSheetsApi();
  await ensureSheetTab(spreadsheetId, title);
  // ล้างทั้งแท็บก่อนเขียนใหม่ทุกครั้ง — ข้อมูลเก่าถูกแทนด้วยชุดล่าสุดเสมอ (A:AZ เผื่อคอลัมน์เกิน 26)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${title}'!A:AZ`,
  });
  const exportedAt = new Date().toISOString().slice(0, 19).replace("T", " ") + " (UTC)";
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [`PetFlow — ส่งออกเมื่อ ${exportedAt}`],
        headers,
        ...rows,
      ],
    },
  });
}

export type SheetsExportResult = {
  ok: boolean;
  reason?: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  customers: number;
  finance: number;
};

export async function exportToGoogleSheets(
  customerKeys?: string[]
): Promise<SheetsExportResult> {
  const creds = await getGoogleCredentials();
  if (!(await isGoogleConfigured()) || !creds) {
    return {
      ok: false,
      reason: "google_not_configured",
      customers: 0,
      finance: 0,
    };
  }
  const spreadsheetId = creds.spreadsheetId;

  const keys =
    customerKeys && customerKeys.length ? customerKeys : DEFAULT_CUSTOMER_KEYS;
  const cols = CUSTOMER_COLUMNS.filter((c) => keys.includes(c.key));
  const customerHeaders = cols.map((c) => c.label);

  const [customers, finance] = await Promise.all([
    listCustomers(),
    listFinance(),
  ]);

  try {
    await writeSheet(
      spreadsheetId,
      CUSTOMERS_SHEET,
      customerHeaders,
      customerRows(customers, cols)
    );
    await writeSheet(
      spreadsheetId,
      FINANCE_SHEET,
      FINANCE_HEADERS,
      financeRows(finance)
    );

    return {
      ok: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      customers: customers.length,
      finance: finance.length,
    };
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : String(e),
      customers: 0,
      finance: 0,
    };
  }
}
