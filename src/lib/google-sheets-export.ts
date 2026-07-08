import type { CustomerRecord } from "./customers-store";
import type { FinanceRecord } from "./finance-store";
import { getGoogleCredentials, isGoogleConfigured } from "./google-config";
import { getSheetsApi } from "./google-auth";
import { listCustomers } from "./customers-store";
import { listFinance } from "./finance-store";

const CUSTOMERS_SHEET = "ลูกค้า";
const FINANCE_SHEET = "รายรับรายจ่าย";

const CUSTOMER_HEADERS = [
  "ID",
  "ชื่อลูกค้า",
  "เบอร์โทร",
  "LINE User ID",
  "สมาชิก",
  "เครดิตคงเหลือ",
  "ชื่อแมว",
  "โน้ตพนักงาน (แมว)",
  "สมาชิกตั้งแต่",
  "อัปเดตล่าสุด",
];

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

function customerRows(customers: CustomerRecord[]): string[][] {
  const rows: string[][] = [];
  for (const c of customers) {
    if (!c.cats.length) {
      rows.push([
        c.id,
        c.name,
        c.phone || "",
        c.lineUserId || "",
        c.isMember ? "ใช่" : "ไม่",
        String(c.memberCredit),
        "",
        "",
        c.memberSince || "",
        c.updatedAt.slice(0, 10),
      ]);
      continue;
    }
    for (const cat of c.cats) {
      rows.push([
        c.id,
        c.name,
        c.phone || "",
        c.lineUserId || "",
        c.isMember ? "ใช่" : "ไม่",
        String(c.memberCredit),
        cat.name,
        cat.staffNote || "",
        c.memberSince || "",
        c.updatedAt.slice(0, 10),
      ]);
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
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${title}'!A:Z`,
  });
  const exportedAt = new Date().toISOString().slice(0, 19).replace("T", " ") + " (UTC)";
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [`CatCha Hotel — ส่งออกเมื่อ ${exportedAt}`],
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

export async function exportToGoogleSheets(): Promise<SheetsExportResult> {
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

  const [customers, finance] = await Promise.all([
    listCustomers(),
    listFinance(),
  ]);

  try {
    await writeSheet(
      spreadsheetId,
      CUSTOMERS_SHEET,
      CUSTOMER_HEADERS,
      customerRows(customers)
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
