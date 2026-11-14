/**
 * ระบบร้านทำผม — ชนิดข้อมูล ค่าตั้งต้น และสูตรคำนวณที่ใช้ทั้งหน้าจอและเซิร์ฟเวอร์
 * ไฟล์นี้ห้าม import อะไรฝั่งเซิร์ฟเวอร์ (ใช้ในหน้าจอด้วย)
 *
 * เงินคิดเป็นบาท ทศนิยม 2 ตำแหน่ง — ปัดทุกครั้งที่คูณ/หาร ไม่ปล่อยเศษสะสม
 */

export type SalonSettings = {
  shop_name: string;
  /** เวลาเปิด-ปิด HH:MM */
  open: string;
  close: string;
  /** วันหยุดประจำสัปดาห์ 0=อาทิตย์ … 6=เสาร์ */
  closed_weekdays: number[];
  /** ช่องเวลาจองทุกกี่นาที */
  slot_step: number;
  deposit: {
    enabled: boolean;
    /** % ของราคาบริการที่ต้องมัดจำ */
    pct: number;
    /** มัดจำขั้นต่ำ (บาท) */
    min: number;
    /** ยกเลิกก่อนกี่ชั่วโมงถึงคืนมัดจำ */
    refund_hours: number;
  };
  points: {
    enabled: boolean;
    /** จ่ายกี่บาทได้ 1 แต้ม */
    baht_per_point: number;
    /** ใช้ทีละกี่แต้ม */
    redeem_points: number;
    /** แลกได้กี่บาท ต่อ redeem_points แต้ม */
    redeem_value: number;
    /** ใช้แต้มลดได้ไม่เกินกี่ % ของบิล */
    max_pct: number;
    expire_months: number;
  };
  pay: {
    cash: boolean;
    transfer: boolean;
    card: boolean;
    /** ค่าธรรมเนียมบัตร % (ร้านจ่ายให้ธนาคาร — ใช้คำนวณเงินเข้าจริง ไม่บวกลูกค้า) */
    card_fee_pct: number;
    /** เบอร์/เลขบัตรประชาชนพร้อมเพย์ สำหรับสร้าง QR */
    promptpay_id: string;
  };
};

export const DEFAULT_SETTINGS: SalonSettings = {
  shop_name: "ร้านทำผม",
  open: "10:00",
  close: "20:00",
  closed_weekdays: [],
  slot_step: 30,
  // ร้านคนเดียว: มัดจำ/แต้มปิดไว้ก่อน เจ้าของเปิดเองได้ในหน้าตั้งค่า
  deposit: { enabled: false, pct: 30, min: 300, refund_hours: 24 },
  points: {
    enabled: false,
    baht_per_point: 25,
    redeem_points: 100,
    redeem_value: 50,
    max_pct: 50,
    expire_months: 12,
  },
  pay: { cash: true, transfer: true, card: true, card_fee_pct: 2, promptpay_id: "" },
};

/** รวมค่าที่บันทึกไว้กับค่าตั้งต้น — ค่าที่เพิ่มทีหลังจะได้ค่าตั้งต้นเสมอ */
export function mergeSettings(saved: unknown): SalonSettings {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<SalonSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    deposit: { ...DEFAULT_SETTINGS.deposit, ...(s.deposit || {}) },
    points: { ...DEFAULT_SETTINGS.points, ...(s.points || {}) },
    pay: { ...DEFAULT_SETTINGS.pay, ...(s.pay || {}) },
    closed_weekdays: Array.isArray(s.closed_weekdays) ? s.closed_weekdays : DEFAULT_SETTINGS.closed_weekdays,
  };
}

export type Stylist = {
  id: string;
  name: string;
  level: "stylist" | "senior" | "assistant";
  commission_pct: number | null;
  color: string | null;
  sort: number;
  active: boolean;
};

export type Service = {
  id: string;
  category: string;
  name: string;
  price: number;
  price_from: boolean;
  duration_min: number;
  wait_min: number;
  wait_after_min: number;
  needs_deposit: boolean;
  rebook_days: number | null;
  sort: number;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  reorder_point: number;
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  nickname: string | null;
  phone: string | null;
  line_id: string | null;
  birthday: string | null;
  hair_length: string | null;
  allergies: string | null;
  color_formula: string | null;
  notes: string | null;
  marketing_consent: boolean;
  photo_consent: boolean;
  points: number;
  no_show_count: number;
  created_at: string;
};

export type VisitStatus =
  | "booked"
  | "confirmed"
  | "arrived"
  | "waiting"
  | "in_service"
  | "awaiting_payment"
  | "done"
  | "cancelled"
  | "no_show";

export type VisitService = {
  id?: string;
  service_id: string | null;
  name: string;
  quoted_price: number;
  final_price: number | null;
  price_from: boolean;
  price_confirmed_by?: string | null;
  duration_min: number;
  wait_min: number;
  wait_after_min: number;
  stylist_id: string | null;
  assistant_id: string | null;
};

export type Visit = {
  id: string;
  customer_id: string | null;
  guest_name: string | null;
  source: "booking" | "walk_in";
  status: VisitStatus;
  start_at: string;
  end_at: string;
  stylist_id: string | null;
  queue_no: number | null;
  note: string | null;
  deposit_required: number;
  cancel_reason: string | null;
  version: number;
  services: VisitService[];
  customer?: Pick<Customer, "id" | "name" | "nickname" | "phone" | "points" | "allergies" | "no_show_count"> | null;
  /** มัดจำที่รับแล้ว (ยังไม่ผูกบิล) */
  deposit_paid: number;
  bill?: { id: string; bill_no: number; total: number; status: string } | null;
};

export const STATUS_LABEL: Record<VisitStatus, string> = {
  booked: "จองไว้",
  confirmed: "ยืนยันแล้ว",
  arrived: "มาถึงแล้ว",
  waiting: "รอคิว",
  in_service: "กำลังทำ",
  awaiting_payment: "รอจ่ายเงิน",
  done: "จ่ายแล้ว",
  cancelled: "ยกเลิก",
  no_show: "ไม่มา",
};

export const METHOD_LABEL: Record<string, string> = {
  cash: "เงินสด",
  transfer: "โอน / พร้อมเพย์",
  card: "บัตร",
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function baht(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return v.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ───────────── เวลา (ร้านอยู่ไทย UTC+7 ไม่มีเวลาออมแสง)

export function toIso(day: string, hhmm: string): string {
  return `${day}T${hhmm}:00+07:00`;
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function hhmmOf(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** เวลา HH:MM ไทยของ ISO */
export function bkkTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function bkkDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return bkkDay(d.toISOString());
}

const TH_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** "วันเสาร์ 14 พ.ย." */
export function thaiDay(day: string): string {
  const d = new Date(`${day}T12:00:00+07:00`);
  const wd = d.getUTCDay();
  const [, m, dd] = day.split("-").map(Number);
  return `วัน${TH_DAYS[wd]} ${dd} ${TH_MONTHS[m - 1]}`;
}

export function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00+07:00`).getUTCDay();
}

// ───────────── ช่วงเวลาที่ช่างติดงาน

export type Busy = { from: number; to: number };

/**
 * ช่วงที่ช่างไม่ว่าง (นาทีนับจากเที่ยงคืน) ของบริการชุดหนึ่งที่เริ่มเวลา start
 * บริการที่มีช่วงรอ (เช่น รอสีขึ้น) ช่างว่างไปรับงานอื่นได้ระหว่างรอ
 */
export function busyPlan(
  start: number,
  services: Pick<VisitService, "duration_min" | "wait_min" | "wait_after_min">[]
): { busy: Busy[]; end: number } {
  const busy: Busy[] = [];
  let t = start;
  for (const s of services) {
    const dur = Math.max(5, Number(s.duration_min) || 0);
    const wait = Math.max(0, Math.min(Number(s.wait_min) || 0, dur));
    const after = Math.max(0, Math.min(Number(s.wait_after_min) || 0, dur - wait));
    if (wait > 0) {
      if (after > 0) busy.push({ from: t, to: t + after });
      if (dur - after - wait > 0) busy.push({ from: t + after + wait, to: t + dur });
    } else {
      busy.push({ from: t, to: t + dur });
    }
    t += dur;
  }
  // รวมช่วงที่ติดกัน
  const merged: Busy[] = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (last && last.to >= b.from) last.to = Math.max(last.to, b.to);
    else merged.push({ ...b });
  }
  return { busy: merged, end: t };
}

export function overlaps(a: Busy[], b: Busy[]): boolean {
  return a.some((x) => b.some((y) => x.from < y.to && y.from < x.to));
}

// ───────────── มัดจำ

export function depositFor(settings: SalonSettings, services: { price: number; needs_deposit: boolean }[]): number {
  if (!settings.deposit.enabled) return 0;
  const base = services.filter((s) => s.needs_deposit).reduce((a, s) => a + (Number(s.price) || 0), 0);
  if (base <= 0) return 0;
  const pct = Math.ceil((base * settings.deposit.pct) / 100);
  return Math.min(base, Math.max(settings.deposit.min, pct));
}

// ───────────── คำนวณบิล

export type BillLineInput = {
  kind: "service" | "product";
  ref_id: string | null;
  name: string;
  qty: number;
  unit_price: number;
  stylist_id: string | null;
  assistant_id: string | null;
};

export type BillCalc = {
  subtotal: number;
  discount: number;
  points_used: number;
  points_value: number;
  /** รายได้สุทธิของบิล */
  total: number;
  deposit_applied: number;
  /** ต้องเก็บเพิ่มวันนี้ */
  due: number;
  /** มัดจำเกินยอด ต้องคืนลูกค้า */
  refund_deposit: number;
  points_earned: number;
  /** ใช้แต้มได้มากสุดเท่าไร (เป็นขั้นละ redeem_points) */
  max_points: number;
  lines: (BillLineInput & { amount: number; net: number })[];
};

export function calcBill(input: {
  lines: BillLineInput[];
  discount: number;
  points_used: number;
  customer_points: number;
  has_customer: boolean;
  deposit_paid: number;
  settings: SalonSettings;
}): BillCalc {
  const { settings: st } = input;
  const lines = input.lines.map((l) => {
    const qty = Math.max(1, Math.round(Number(l.qty) || 1));
    const unit = round2(Math.max(0, Number(l.unit_price) || 0));
    return { ...l, qty, unit_price: unit, amount: round2(qty * unit), net: 0 };
  });
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  const discount = round2(Math.min(subtotal, Math.max(0, Number(input.discount) || 0)));
  const afterDiscount = round2(subtotal - discount);

  // แต้ม: ใช้ได้ทีละ redeem_points ไม่เกินยอดที่มี และไม่เกิน max_pct ของบิล
  const p = st.points;
  let maxPoints = 0;
  if (p.enabled && input.has_customer && p.redeem_points > 0 && p.redeem_value > 0) {
    const capValue = (afterDiscount * p.max_pct) / 100;
    const stepsByValue = Math.floor(capValue / p.redeem_value);
    const stepsByBalance = Math.floor(Math.max(0, input.customer_points) / p.redeem_points);
    maxPoints = Math.max(0, Math.min(stepsByValue, stepsByBalance)) * p.redeem_points;
  }
  const wanted = Math.max(0, Math.floor(Number(input.points_used) || 0));
  const points_used = Math.min(maxPoints, Math.floor(wanted / Math.max(1, p.redeem_points)) * p.redeem_points);
  const points_value = p.redeem_points > 0 ? round2((points_used / p.redeem_points) * p.redeem_value) : 0;

  const total = round2(Math.max(0, afterDiscount - points_value));

  // กระจายส่วนลด+แต้มลงแต่ละบรรทัดตามสัดส่วน (เศษไปอยู่บรรทัดสุดท้าย) — ไว้ดูยอดขายต่อบริการ
  let left = total;
  lines.forEach((l, i) => {
    if (i === lines.length - 1) l.net = round2(left);
    else {
      l.net = subtotal > 0 ? round2((l.amount / subtotal) * total) : 0;
      left = round2(left - l.net);
    }
  });

  const deposit_applied = round2(Math.min(total, Math.max(0, input.deposit_paid)));
  const refund_deposit = round2(Math.max(0, input.deposit_paid - total));
  const due = round2(total - deposit_applied);

  const points_earned =
    p.enabled && input.has_customer && p.baht_per_point > 0 ? Math.floor(total / p.baht_per_point) : 0;

  return {
    subtotal,
    discount,
    points_used,
    points_value,
    total,
    deposit_applied,
    due,
    refund_deposit,
    points_earned,
    max_points: maxPoints,
    lines,
  };
}

/** ค่าธรรมเนียมบัตรโดยประมาณ */
export function cardFee(settings: SalonSettings, amount: number): number {
  return round2((Math.max(0, amount) * (Number(settings.pay.card_fee_pct) || 0)) / 100);
}

export function cleanPhone(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "").slice(0, 10);
}
