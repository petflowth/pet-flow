"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVICE_PRESETS, type ServicePreset } from "@/lib/service-presets";
import { CustomerSendButtons } from "@/components/CustomerSendButtons";
import { toast } from "@/components/Toast";
import { groupBookings, groupCatNames } from "@/lib/booking-group";
import { formatThaiDateShort } from "@/lib/format-thai-date";
import {
  GROOM_PROGRAMS,
  GROOM_SIZES,
  groomPrice,
  groomProgram,
  groomSizeLabel,
  type GroomSize,
} from "@/lib/grooming-prices";

type Customer = {
  id: string;
  name: string;
  phone?: string;
  lineUserId?: string;
  cats: { id?: string; name: string }[];
  isMember: boolean;
  memberCredit: number;
  /** มัดจำล่วงหน้าคงเหลือ — หักบิลนี้อัตโนมัติ */
  depositCredit?: number;
};

type Promo = {
  id: string;
  title: { th: string };
  discountPercent?: number;
  discountAmount?: number;
};

type Invoice = {
  id: string;
  total: number;
  subtotal?: number;
  discount?: number;
  deposit?: number;
  promoLabel?: string;
  status: string;
  customerName: string;
  catName: string;
  lineUserId?: string;
  customerId?: string;
  bookingId?: string;
  depositReceivedAt?: string;
  createdAt?: string;
  items?: {
    label: string;
    amount: number;
    kind?: string;
    catName?: string;
    qty?: number;
    unitAmount?: number;
  }[];
};

type Booking = {
  id: string;
  customerId?: string;
  customerName: string;
  catName: string;
  service: "room" | "groom";
  room?: string;
  checkin?: string;
  checkout?: string;
  date?: string;
  time?: string;
  status: string;
  autoOff?: string[];
  /** โปรแกรมอาบน้ำที่เลือกไว้ตอนจอง (id ใน GROOM_PROGRAMS) — ถ้ามีจะเลือกไว้ให้อัตโนมัติตอนออกบิล */
  groomProgram?: string;
};

type ItemKind = "grooming" | "room" | "service" | "custom" | "freebie" | "product";
type Item = {
  kind: ItemKind;
  program: string;
  breed: string;
  size: GroomSize;
  roomLabel: string;
  roomPrice: number;
  nights: number;
  label: string;
  amount: number;
  /** น้องแมวตัวไหน — บ้านที่มีหลายตัวจะได้รู้ว่าตัวไหนอาบโปรแกรมอะไร */
  catName?: string;
  /** จำนวนชิ้น (ห้องพักใช้ "คืน" แทน) */
  qty?: number;
  /** สินค้าหน้าร้านที่แตะเพิ่มจากกริด (products-store.ts) — ใช้ตัดสต็อกตอนจ่ายเงิน */
  productId?: string;
};

/** programId มาจากนัด (booking.groomProgram) ถ้ามี — ให้เลือกโปรแกรมที่ลูกค้าเลือกไว้ตอนจองอัตโนมัติ */
function newGrooming(programId?: string): Item {
  const prog = (programId && GROOM_PROGRAMS.find((p) => p.id === programId)) || GROOM_PROGRAMS[0];
  return {
    kind: "grooming",
    program: prog.id,
    breed: prog.breeds[0].breed,
    size: "m",
    roomLabel: "",
    roomPrice: 0,
    nights: 1,
    label: "",
    amount: 0,
  };
}

/**
 * บิลนี้มีอาบน้ำ ห้องพัก หรือทั้งคู่ — ใช้กรองว่าปุ่ม "ปิดข้อความอัตโนมัติ" ควรโชว์หัวข้อไหน
 * (บิลอาบน้ำล้วนไม่ควรมีตัวเลือกเรื่องเข้าพักมาให้เลือกโดยไม่มีผล)
 */
function billServiceKind(items?: { label: string; kind?: string }[]): "room" | "groom" | "both" {
  const hasRoom = !!items?.some((it) => it.kind === "room" || /คืน|ห้อง/.test(it.label));
  const hasGroom = !!items?.some((it) => it.kind === "grooming" || /อาบน้ำ|กรูม/.test(it.label));
  if (hasRoom && hasGroom) return "both";
  return hasRoom ? "room" : "groom";
}

/**
 * รายการเดียวใส่ชื่อน้องได้หลายตัว (เช่น แมว 2 ตัวนอนห้องเดียวกัน)
 * เก็บเป็นชื่อคั่นด้วย "," ในฟิลด์เดิม — ไม่ต้องแก้โครงสร้างบิล/ฐานข้อมูล
 */
const CAT_SEP = ", ";
/**
 * เทียบชื่อน้องแบบไม่แคร์ช่องว่าง/อักขระล่องหน — ชื่อไทยที่พิมพ์คนละครั้ง
 * อาจมี zero-width หรือสระเรียงคนละแบบ ทำให้ === ไม่ตรงทั้งที่ตาเห็นเหมือนกัน
 * (เป็นเหตุให้ติ๊กชื่อออกไม่ได้ แล้วชื่อน้องตัวอื่นติดมาในบรรทัดบิล)
 */
function catKey(name: string): string {
  return name.normalize("NFC").replace(/[\u200B-\u200D\uFEFF\s]/g, "").toLowerCase();
}
function parseCatNames(v?: string): string[] {
  return (v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function joinCatNames(names: string[]): string | undefined {
  return names.length ? names.join(CAT_SEP) : undefined;
}

function computeLine(it: Item): {
  label: string;
  amount: number;
  catName?: string;
  qty: number;
  unitAmount: number;
  productId?: string;
} {
  const cat = joinCatNames(parseCatNames(it.catName));
  /** ใส่ชื่อน้องนำหน้า ให้เจ้าของอ่านบิลแล้วรู้ทันทีว่าตัวไหนใช้อะไร */
  const withCat = (label: string) => (cat ? `🐱 ${cat} · ${label}` : label);
  const qty = Math.max(1, Math.round(it.qty || 1));

  if (it.kind === "grooming") {
    const prog = groomProgram(it.program);
    const unit = groomPrice(it.program, it.breed, it.size);
    const base = `${prog?.name || "อาบน้ำ"} · ${it.breed} · ${groomSizeLabel(it.size)}`;
    return {
      label: withCat(qty > 1 ? `${base} × ${qty}` : base),
      amount: unit * qty,
      catName: cat,
      qty,
      unitAmount: unit,
    };
  }
  if (it.kind === "room") {
    // ห้องพักคิดเป็น "คืน" อยู่แล้ว จึงไม่ใช้ qty ซ้ำ
    const n = Math.max(1, it.nights || 1);
    const unit = it.roomPrice || 0;
    return {
      label: withCat(`${it.roomLabel || "ห้องพัก"} × ${n} คืน`),
      amount: unit * n,
      catName: cat,
      qty: n,
      unitAmount: unit,
    };
  }
  if (it.kind === "freebie") {
    return {
      label: withCat(`🎁 ${it.label || "ของแถม"} (ฟรี)`),
      amount: 0,
      catName: cat,
      qty: 1,
      unitAmount: 0,
    };
  }
  const unit = it.amount || 0;
  return {
    label: withCat(qty > 1 ? `${it.label} × ${qty}` : it.label),
    amount: unit * qty,
    catName: cat,
    qty,
    unitAmount: unit,
    productId: it.productId,
  };
}

/** สรุปการจอง (วัน/เวลา) จากนัดที่ผูกกับบิล — โชว์ในบิล + การ์ดสรุปให้ลูกค้า */
function scheduleLabelFor(bk?: {
  service?: string;
  checkin?: string;
  checkout?: string;
  date?: string;
  time?: string;
}): string {
  if (!bk) return "";
  const isRoom = bk.service === "room" || !!bk.checkin;
  if (isRoom) {
    const inD = formatThaiDateShort(bk.checkin || bk.date || "");
    const outD = bk.checkout ? formatThaiDateShort(bk.checkout) : "";
    let nights = 0;
    if (bk.checkin && bk.checkout) {
      nights = Math.max(
        1,
        Math.round(
          (new Date(`${bk.checkout}T12:00:00`).getTime() -
            new Date(`${bk.checkin}T12:00:00`).getTime()) /
            86400000
        )
      );
    }
    if (!inD) return "";
    return `🏠 เข้าพัก ${inD}${outD ? ` → ${outD}` : ""}${nights ? ` · ${nights} คืน` : ""}`;
  }
  const d = formatThaiDateShort(bk.date || "");
  if (!d) return "";
  return `🛁 นัดอาบน้ำ ${d}${bk.time ? ` · ${bk.time} น.` : ""}`;
}

const KIND_OPTIONS: { id: ItemKind; label: string }[] = [
  { id: "grooming", label: "🛁 อาบน้ำ / กรูม" },
  { id: "room", label: "🏠 ห้องพัก" },
  { id: "service", label: "✨ บริการเสริม" },
  { id: "freebie", label: "🎁 ของแถม (ฟรี)" },
  { id: "custom", label: "✏️ พิมพ์เอง" },
];

const FREEBIE_PRESETS = [
  "กล้องวงจรปิด (CCTV)",
  "น้ำพุแมว",
  "รับ-ส่ง",
  "ขนม/ทรีท",
];

/**
 * ช่องกรอกตัวเลขที่ "ลบให้ว่างแล้วพิมพ์ใหม่ได้" — เก็บ draft เป็น string ระหว่างพิมพ์
 * ปัญหาเดิม: bind ค่าเป็นตัวเลข + `Number(x)||1` ทุก keystroke พอลบจนว่างมันเด้งกลับเป็น 1
 * ที่นี่ปล่อยให้ว่างได้ระหว่างพิมพ์ แล้วค่อย clamp ตอนออกจากช่อง (blur)
 */
function NumField({
  value,
  min = 0,
  onCommit,
  className,
}: {
  value: number;
  min?: number;
  onCommit: (n: number) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  // ค่าจากภายนอกเปลี่ยน (เช่น เลือกห้องใหม่) ตอนที่ไม่ได้พิมพ์อยู่ → sync ให้ตรง
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        const raw = e.target.value;
        if (!/^\d*$/.test(raw)) return; // ตัวเลขล้วน (อนุญาตว่าง)
        setDraft(raw);
        if (raw !== "") onCommit(Math.max(min, Number(raw)));
      }}
      onBlur={() => {
        setEditing(false);
        const n = draft === "" ? min : Math.max(min, Number(draft));
        setDraft(String(n));
        onCommit(n);
      }}
      className={className}
    />
  );
}

export default function BillingPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rooms, setRooms] = useState<(ServicePreset & { id: string })[]>([]);
  const [servicePresets, setServicePresets] = useState<ServicePreset[]>(SERVICE_PRESETS);
  const [freebiePresets, setFreebiePresets] = useState<string[]>(FREEBIE_PRESETS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState<string | undefined>(undefined);
  const [showBookings, setShowBookings] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);

  const [promoId, setPromoId] = useState("");
  const [autoPromoLabel, setAutoPromoLabel] = useState("");
  const [discount, setDiscount] = useState("");
  const [couponId, setCouponId] = useState("");
  const [customerCoupons, setCustomerCoupons] = useState<
    { id: string; amount: number; reason: string; code: string }[]
  >([]);
  const [packageId, setPackageId] = useState("");
  const [customerPackages, setCustomerPackages] = useState<
    { id: string; name: string; totalUses: number; usedUses: number; unit?: "use" | "night" }[]
  >([]);
  const [billDeposit, setBillDeposit] = useState("");
  const [billDepPct, setBillDepPct] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState("");
  const [billFilter, setBillFilter] = useState<"all" | "pending" | "paid">("pending");
  const [billSearch, setBillSearch] = useState("");
  const [billSort, setBillSort] = useState<
    | "date-desc"
    | "date-asc"
    | "issued-desc"
    | "issued-asc"
    | "amount-desc"
    | "due-desc"
  >("issued-desc");
  const [items, setItems] = useState<Item[]>([newGrooming()]);
  // ขายเร็ว ไม่ระบุลูกค้า — ใช้ลูกค้าโครง "ลูกค้าหน้าร้าน" แทน (สำหรับขายสินค้าล้วนๆ ไม่มีนัด)
  const [quickSale, setQuickSale] = useState(false);
  const [products, setProducts] = useState<
    { id: string; name: string; category: string; price: number; imageUrl?: string; stockCount: number }[]
  >([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productTab, setProductTab] = useState("ทั้งหมด");
  // ส่วนลดกรอกได้ทั้งบาทและเปอร์เซ็นต์ — ร้านคิดโปรเป็น % บ่อย จะได้ไม่ต้องกดเครื่องคิดเลขเอง
  const [discountMode, setDiscountMode] = useState<"baht" | "percent">("baht");
  const [creating, setCreating] = useState(false);
  const [pay, setPay] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [shopName, setShopName] = useState("PetFlow");
  const [billMsg, setBillMsg] = useState({
    summaryBookingTitle: "สรุปการจอง",
    summaryDepositTitle: "แจ้งมัดจำ",
    summaryFullTitle: "แจ้งยอดชำระ",
    summaryClosing: "",
  });
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [c, p, i, cfg, b] = await Promise.all([
      fetch("/api/customers"),
      fetch("/api/promos?active=1"),
      fetch("/api/invoices"),
      fetch("/api/config"),
      fetch("/api/bookings"),
    ]);
    // parse ทั้งหมดก่อน แล้วค่อย setState (rooms ก่อน bookings) — กัน auto-pick
    // จาก URL รันก่อนห้องโหลดเสร็จ (ไม่งั้นราคาห้องออกมา 0)
    const [cj, pj, ij, cfgj, bj] = await Promise.all([
      c.json(),
      p.json(),
      i.json(),
      cfg.json(),
      b.json(),
    ]);
    const config = cfgj.config;
    setCustomers(cj.customers || []);
    setPromos(pj.promos || []);
    setInvoices(ij.invoices || []);
    setRooms(
      (config?.rooms || []).map((r: { id: string; name: string; price: number }) => ({
        id: r.id,
        label: `ห้อง ${r.name}`,
        amount: r.price,
      }))
    );
    if (config?.payment) setPay(config.payment);
    if (config?.business?.name) setShopName(config.business.name);
    if (config?.billing) setBillMsg(config.billing);
    if (config?.options?.servicePresets?.length) setServicePresets(config.options.servicePresets);
    if (config?.options?.freebies?.length) setFreebiePresets(config.options.freebies);
    setBookings((bj.bookings || []).filter((x: Booking) => x.status !== "cancelled"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // โหลดสินค้าหน้าร้านตอนเปิดตัวเลือกครั้งแรกเท่านั้น (ไม่ใช่ทุกบิล) — ยอดขายส่วนใหญ่ไม่มีสินค้า
  useEffect(() => {
    if (!showProductPicker) return;
    fetch("/api/products?activeOnly=1")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => {});
  }, [showProductPicker]);

  // ดึงนัดจาก URL อัตโนมัติ (มาจากปุ่ม "ออกบิล" ในตารางนัด) — ทำครั้งเดียว
  const autoPicked = useRef(false);
  useEffect(() => {
    if (autoPicked.current || bookings.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const bId = params.get("bookingId");
    if (!bId) return;
    const bk = bookings.find((b) => b.id === bId);
    if (!bk) return;
    // นัดห้องพัก ต้องรอ rooms โหลดก่อน ไม่งั้น match ราคาไม่เจอ → ยอด 0
    if (bk.service === "room" && rooms.length === 0) return;
    autoPicked.current = true;
    // กดปุ่ม "ออกบิล" จากตารางนัดส่งมาแค่ id เดียว — ดึงทั้งบ้านมาด้วย
    const group = groupBookings(bookings).find((g) => g.some((x) => x.id === bId));
    pickBooking(group || [bk]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, rooms]);

  const selected = customers.find((c) => c.id === customerId);

  // โหลดคูปอง + คอร์สที่ใช้ได้ของลูกค้าที่เลือก
  useEffect(() => {
    setCouponId("");
    setPackageId("");
    if (!customerId) {
      setCustomerCoupons([]);
      setCustomerPackages([]);
      return;
    }
    let alive = true;
    fetch(`/api/coupons?customerId=${customerId}&active=1`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setCustomerCoupons(d.coupons || []);
      })
      .catch(() => {});
    fetch(`/api/packages?customerId=${customerId}&active=1`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setCustomerPackages(d.packages || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [customerId]);

  // บ้านเดียวกัน + นัดเดียวกัน = 1 รายการในลิสต์ ออกบิลใบเดียว
  //
  // บิลของบ้านรวมผูกกับ "นัดตัวแรก" ตัวเดียว ถ้าตัดทั้งกลุ่มเมื่อเจอบิลที่จ่ายแล้ว
  // บ้านที่ออกบิลไปแค่บางตัว (พนักงานลบบางแถวออก) จะหายทั้งกลุ่ม อีกหลายตัวออกบิลไม่ได้เลย
  // จึงดูจาก "ชื่อน้องที่ถูกออกบิลไปแล้ว" แทน แล้วเหลือเฉพาะตัวที่ยังไม่ได้ออกบิล
  const bookingGroups = groupBookings(bookings)
    .map((group) => {
      const groupIds = new Set(group.map((b) => b.id));
      const paidForGroup = invoices.filter(
        (i) => i.status === "paid" && i.bookingId && groupIds.has(i.bookingId)
      );
      if (paidForGroup.length === 0) return group;
      // บิลเก่าที่ยังไม่มีชื่อน้องรายรายการ → ถือว่าคุมแค่น้องหลักของบิลนั้น (ปลอดภัยกว่าซ่อนเกิน)
      const billedCats = new Set(
        paidForGroup.flatMap((i) => {
          // 1 รายการใส่ชื่อน้องได้หลายตัว (คั่นด้วย ",") → ต้องแตกออกให้ครบ
          // ไม่งั้นบิลที่คุมแมว 2 ตัวจะซ่อนนัดให้แค่ตัวเดียว
          const perItem = (i.items || []).flatMap((it) => parseCatNames(it.catName));
          return perItem.length ? perItem : [i.catName];
        })
      );
      return group.filter((b) => !billedCats.has(b.catName));
    })
    .filter((group) => group.length > 0);
  const lines = items.map(computeLine);
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const selectedPromo = promos.find((p) => p.id === promoId);
  const promoDiscount = selectedPromo
    ? Math.min(
        subtotal,
        Math.max(
          selectedPromo.discountPercent
            ? Math.round((subtotal * selectedPromo.discountPercent) / 100)
            : 0,
          selectedPromo.discountAmount || 0
        )
      )
    : 0;
  const discountInput = Math.max(0, Number(discount) || 0);
  const manualDiscount =
    discountMode === "percent"
      ? // คิด % จากยอดรวมหลังหักโปรแล้ว และไม่ให้เกินยอดที่เหลือ
        Math.min(
          Math.max(0, subtotal - promoDiscount),
          Math.round(((subtotal - promoDiscount) * Math.min(100, discountInput)) / 100)
        )
      : discountInput;
  const couponAmount = customerCoupons.find((c) => c.id === couponId)?.amount || 0;

  const pickedPackage = customerPackages.find((p) => p.id === packageId);
  const packageLeft = pickedPackage
    ? pickedPackage.totalUses - pickedPackage.usedUses
    : 0;
  /**
   * คอร์สแบบคืน: หักตามจำนวนคืนที่พักจริง แล้วคลุมเฉพาะค่าห้องของคืนที่หักได้
   * (ค่าอาบน้ำ/ของเสริมในบิลเดียวกันยังต้องจ่าย) ถ้าคืนที่เหลือไม่พอ
   * จะคลุมเท่าที่เหลือ แล้วส่วนที่เกินลูกค้าจ่ายเพิ่มตามปกติ
   */
  const roomLines = lines
    .map((l, i) => ({ ...l, kind: items[i]?.kind }))
    .filter((l) => l.kind === "room");
  const nightsOnBill = roomLines.reduce((n, l) => n + Math.max(1, l.qty || 1), 0);
  const nightsToUse =
    pickedPackage?.unit === "night" ? Math.min(packageLeft, nightsOnBill) : 0;
  const nightsCover = (() => {
    if (!nightsToUse) return 0;
    let left = nightsToUse;
    let covered = 0;
    for (const l of roomLines) {
      if (left <= 0) break;
      const take = Math.min(left, Math.max(1, l.qty || 1));
      covered += take * (l.unitAmount || 0);
      left -= take;
    }
    return covered;
  })();

  // คอร์สนับครั้ง: หัก 1 ครั้ง → คลุมยอดที่เหลือทั้งบิลให้เป็น 0 (จ่ายไปแล้วตอนซื้อคอร์ส)
  const packageCovers = !packageId
    ? 0
    : pickedPackage?.unit === "night"
      ? Math.min(nightsCover, Math.max(0, subtotal - promoDiscount - manualDiscount - couponAmount))
      : Math.max(0, subtotal - promoDiscount - manualDiscount - couponAmount);
  const total = Math.max(
    0,
    subtotal - promoDiscount - manualDiscount - couponAmount - packageCovers
  );
  // มัดจำของบิลนี้ (กรอกในฟอร์ม) → คงเหลือ = ยอดสุทธิ − มัดจำ
  const depositAmount = Math.min(total, Math.max(0, Number(billDeposit) || 0));
  const remaining = Math.max(0, total - depositAmount);

  const buildSummary = (mode: "booking" | "deposit" | "full") => {
    const catName = selected?.cats[0]?.name || "น้องแมว";
    const L: string[] = [];
    L.push(`🐾 ${shopName}`);
    L.push(
      mode === "deposit"
        ? billMsg.summaryDepositTitle
        : mode === "full"
          ? billMsg.summaryFullTitle
          : billMsg.summaryBookingTitle
    );
    L.push("");
    if (selected) L.push(`ลูกค้า: ${selected.name} · 🐱 ${catName}`);
    L.push("— รายการ —");
    for (const l of lines) {
      if (!l.label.trim()) continue;
      L.push(`• ${l.label}${l.amount > 0 ? ` — ${l.amount.toLocaleString()} บาท` : ""}`);
    }
    if (promoDiscount + manualDiscount > 0)
      L.push(`ส่วนลด: -${(promoDiscount + manualDiscount).toLocaleString()} บาท`);
    L.push(`ยอดสุทธิ: ${total.toLocaleString()} บาท`);
    if (mode === "deposit" && depositAmount > 0) {
      L.push(`มัดจำที่ต้องโอน: ${depositAmount.toLocaleString()} บาท`);
      L.push(`ยอดคงเหลือ (ชำระก่อนเข้าพัก): ${remaining.toLocaleString()} บาท`);
    }
    if (mode === "full") L.push(`ยอดที่ต้องโอน: ${total.toLocaleString()} บาท`);
    if (mode !== "booking" && pay.accountNumber) {
      L.push("");
      L.push("— โอนเงิน —");
      L.push(pay.bankName);
      L.push(`เลขบัญชี: ${pay.accountNumber}`);
      L.push(`ชื่อบัญชี: ${pay.accountName}`);
    }
    return L.join("\n");
  };

  const buildSummaryPayload = (mode: "booking" | "deposit" | "full") => {
    const catName = selected?.cats[0]?.name || "น้องแมว";
    const title =
      mode === "deposit"
        ? billMsg.summaryDepositTitle
        : mode === "full"
          ? billMsg.summaryFullTitle
          : billMsg.summaryBookingTitle;
    const bk = bookings.find((b) => b.id === bookingId);
    const scheduleText = scheduleLabelFor(bk) || undefined;
    return {
      mode,
      title,
      closing: "",
      customerName: selected?.name || "",
      catName,
      scheduleText,
      items: lines
        .filter((l) => l.label.trim())
        .map((l) => ({ label: l.label, amount: l.amount })),
      subtotal,
      discount: promoDiscount + manualDiscount,
      total,
      deposit: mode === "deposit" ? depositAmount : 0,
      remaining: mode === "deposit" ? remaining : 0,
      bankName: pay.bankName,
      accountNumber: pay.accountNumber,
      accountName: pay.accountName,
    };
  };

  const sendSummaryLine = async (mode: "booking" | "deposit" | "full") => {
    if (!selected) return;
    if (!selected.lineUserId) return toast("ลูกค้ายังไม่ได้ผูก LINE — ส่งไม่ได้", "error");
    setSending(true);
    const res = await fetch("/api/line/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: selected.lineUserId,
        summary: buildSummaryPayload(mode),
        text: buildSummary(mode),
      }),
    });
    setSending(false);
    toast(res.ok ? "ส่งการ์ดเข้า LINE ลูกค้าแล้ว 📨" : "ส่งไม่สำเร็จ", res.ok ? "success" : "error");
  };

  const copySummary = async (mode: "booking" | "deposit" | "full") => {
    try {
      await navigator.clipboard.writeText(buildSummary(mode));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("ก๊อปไม่สำเร็จ", "error");
    }
  };

  const filtered =
    search.trim().length === 0
      ? customers.slice(0, 8)
      : customers
          .filter((c) => {
            const q = search.toLowerCase();
            return (
              c.name.toLowerCase().includes(q) ||
              (c.phone || "").includes(q) ||
              c.cats.some((cat) => cat.name.toLowerCase().includes(q))
            );
          })
          .slice(0, 8);

  const pickCustomer = async (c: Customer) => {
    setCustomerId(c.id);
    setSearch(c.name);
    setShowList(false);
    setPromoId("");
    setAutoPromoLabel("");
    try {
      const res = await fetch(`/api/promos?autoFor=${c.id}&subtotal=${subtotal}`);
      const { promo } = await res.json();
      if (promo) {
        setPromoId(promo.id);
        setAutoPromoLabel(promo.label);
      }
    } catch {
      /* ไม่มีโปรก็ข้าม */
    }
  };

  const clearCustomer = () => {
    setCustomerId("");
    setSearch("");
    setPromoId("");
    setAutoPromoLabel("");
    setBookingId(undefined);
    setShowList(true);
  };

  const nightsBetween = (ci?: string, co?: string) => {
    if (!ci || !co) return 1;
    const a = new Date(ci).getTime();
    const b = new Date(co).getTime();
    const n = Math.round((b - a) / 86400000);
    return n > 0 ? n : 1;
  };

  /**
   * ดึงนัดมาออกบิล — บ้านเดียวกัน วันเดียวกัน ออกเป็นบิลใบเดียว
   * (แมวแต่ละตัวเป็นคนละแถวในระบบ แต่เจ้าของคนเดียว จ่ายทีเดียว)
   */
  const pickBooking = async (group: Booking[]) => {
    const bk = group[0];
    setBookingId(bk.id);
    setShowBookings(false);
    const cust = customers.find((c) => c.id === bk.customerId);
    if (cust) await pickCustomer(cust);
    else setSearch(bk.customerName);

    // นัดนี้เคยออกบิลไปแล้วหรือยัง — 1 นัดออกได้แค่ 1 บิลเท่านั้น
    // มีบิลค้างอยู่แล้ว → เปิดมาแก้ไขบิลเดิมแทนสร้างซ้ำ, จ่ายจบแล้ว → ห้ามออกซ้ำ
    // เช็คทุกตัวในกลุ่ม เพราะบิลเก่าอาจผูกกับตัวไหนก็ได้
    const ids = new Set(group.map((g) => g.id));
    const matches = invoices.filter((i) => i.bookingId && ids.has(i.bookingId));
    const existing = matches.find((i) => i.status !== "paid") || matches[0];
    if (existing) {
      if (existing.status === "paid") {
        toast("นัดนี้ออกบิลและชำระแล้ว — แก้ไขไม่ได้ (1 นัดออกบิลได้ 1 ใบเท่านั้น)", "error");
        return;
      }
      toast("นัดนี้มีบิลค้างอยู่แล้ว — เปิดมาแก้ไขบิลเดิมให้แทน", "info");
      editInvoice(existing);
      return;
    }

    // ตั้งชื่อน้องให้แต่ละบรรทัดเมื่อมาหลายตัว จะได้รู้ว่าตัวไหนใช้บริการอะไร
    const many = group.length > 1;
    if (bk.service === "room") {
      setItems(
        group.map((g) => {
          // นัดเก็บ room เป็น id → จับคู่กับ id ก่อน แล้วค่อย fallback เป็นชื่อ
          const matched =
            rooms.find((r) => g.room && r.id === g.room) ||
            rooms.find((r) => g.room && r.label.includes(g.room));
          return {
            ...newGrooming(),
            kind: "room" as const,
            roomLabel:
              matched?.label || rooms[0]?.label || (g.room ? `ห้อง ${g.room}` : "ห้องพัก"),
            roomPrice: matched?.amount ?? rooms[0]?.amount ?? 0,
            nights: nightsBetween(g.checkin, g.checkout),
            catName: many ? g.catName : undefined,
          };
        })
      );
    } else {
      setItems(
        group.map((g) => ({
          ...newGrooming(g.groomProgram),
          catName: many ? g.catName : undefined,
        }))
      );
    }
    if (many) {
      toast(`ดึงนัดบ้านนี้มาแล้ว ${group.length} ตัว — ออกบิลใบเดียว 🧾`, "success");
    }
  };

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const changeKind = (idx: number, kind: ItemKind) => {
    // เลือกจาก dropdown นี้ได้เฉพาะ kind ที่พิมพ์เอง (ไม่มี "product" เป็นตัวเลือก) —
    // ต้องล้าง productId เสมอ ไม่งั้นเปลี่ยนจากสินค้าไปเป็นรายการอื่นแล้วจะยังไปตัดสต็อกสินค้าเดิมตอนจ่ายเงิน
    let patch: Partial<Item> = { kind, productId: undefined };
    if (kind === "grooming") {
      const prog = GROOM_PROGRAMS[0];
      patch = { kind, program: prog.id, breed: prog.breeds[0].breed, size: "m" };
    } else if (kind === "room") {
      patch = {
        kind,
        roomLabel: rooms[0]?.label || "",
        roomPrice: rooms[0]?.amount || 0,
        nights: 1,
      };
    } else if (kind === "service") {
      patch = { kind, label: servicePresets[0]?.label || "", amount: servicePresets[0]?.amount || 0 };
    } else if (kind === "freebie") {
      patch = { kind, label: freebiePresets[0] || "", amount: 0 };
    } else {
      patch = { kind, label: "", amount: 0 };
    }
    updateItem(idx, patch);
  };

  const changeProgram = (idx: number, program: string) => {
    const prog = groomProgram(program);
    updateItem(idx, { program, breed: prog?.breeds[0].breed || "" });
  };

  const removeItem = (idx: number) =>
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

  /** แตะสินค้าจากกริด — มีอยู่แล้วในบิลก็บวก qty ต่อ ไม่มีก็เพิ่มบรรทัดใหม่ (บรรทัดว่างเริ่มต้นถูกกรองทิ้งตอนส่งอยู่แล้ว) */
  const addProduct = (p: { id: string; name: string; price: number }) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.kind === "product" && it.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: (next[idx].qty || 1) + 1 };
        return next;
      }
      return [
        ...prev,
        { ...newGrooming(), kind: "product", productId: p.id, label: p.name, amount: p.price, qty: 1 },
      ];
    });
    toast(`เพิ่ม ${p.name} แล้ว — แตะสินค้าอื่นต่อได้เลย`, "success");
  };

  const resetForm = () => {
    // ยังอยู่โหมดขายเร็วต่อ (ขายของหน้าร้านหลายเจ้าติดกัน) — เริ่มบิลถัดไปด้วยตะกร้าว่าง
    // ไม่งั้นแถวอาบน้ำเริ่มต้น 450฿ จะโผล่มาอีกทุกครั้งทั้งที่ไม่มีใครตั้งใจขาย
    setItems(quickSale ? [] : [newGrooming()]);
    setDiscount("");
    setDiscountMode("baht");
    setBillDeposit("");
    setBillDepPct(null);
    setBookingId(undefined);
    setEditingId(null);
  };

  const createBill = async () => {
    let cust = selected;
    // แก้ไขบิลเดิมไม่ต้องมีลูกค้าตอนนี้ (customerId ผูกไว้ตั้งแต่ตอนเปิดแก้ไขแล้ว)
    // บิลใหม่ที่ไม่ได้เลือกลูกค้า ต้องเปิดโหมด "ขายเร็ว" ก่อน ไม่งั้นบังคับให้เลือกเหมือนเดิม
    if (!editingId && !cust) {
      if (!quickSale) return toast("เลือกลูกค้าก่อน", "error");
      setCreating(true);
      const wRes = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_or_create_walkin" }),
      });
      const wData = await wRes.json().catch(() => ({}));
      if (!wData.ok) {
        setCreating(false);
        return toast("สร้างลูกค้าขายเร็วไม่สำเร็จ", "error");
      }
      cust = wData.customer;
    }
    if (subtotal <= 0) return toast("ใส่รายการอย่างน้อย 1 อย่าง", "error");
    setCreating(true);
    // ขายเร็วไม่มีน้องแมวจริง (cust มาจากการสร้างลูกค้าโครงด้านบน ไม่ใช่ selected) — ปล่อยว่างไว้ ดีกว่าใส่ชื่อปลอม
    const cat = cust?.cats[0]?.name || (selected ? "น้องแมว" : "");
    // เก็บของแถม (ฟรี) ด้วย — label มี แต่ยอด 0
    const payloadItems = items
      .map((it, i) => ({ ...lines[i], kind: it.kind }))
      .filter((l) => l.label.trim());

    if (editingId) {
      // แก้ไขบิลเดิม
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          action: "update",
          items: payloadItems,
          extraDiscount: manualDiscount || undefined,
          deposit: depositAmount || 0,
          promoId: promoId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setCreating(false);
      if (res.ok) {
        toast("แก้ไขบิลแล้ว", "success");
        resetForm();
        load();
      } else {
        toast(data.error === "already_paid" ? "บิลปิดแล้ว แก้ไขไม่ได้" : "แก้ไขไม่สำเร็จ", "error");
      }
      return;
    }

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        customerId: cust!.id,
        lineUserId: cust!.lineUserId,
        customerName: cust!.name,
        catName: cat,
        items: payloadItems,
        promoId: promoId || undefined,
        // ยอดคูปองไม่ส่งไปเป็นตัวเลขแล้ว — เซิร์ฟเวอร์คิดจากคูปองจริงเองผ่าน couponId
        // (กันหน้าเว็บโดนแก้ค่าแล้วส่งยอดลดมาเอง)
        extraDiscount: (manualDiscount + packageCovers) || undefined,
        deposit: depositAmount || undefined,
        bookingId: bookingId || undefined,
        couponId: couponId || undefined,
        packageId: packageId || undefined,
        packageUnits: nightsToUse || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCreating(false);
      toast(data.error || "ออกบิลไม่สำเร็จ", "error");
      return;
    }
    setCreating(false);
    if (data.invoice) {
      toast(
        `ออกบิลแล้ว ${data.invoice.total} บาท` +
          (depositAmount > 0 ? ` · มัดจำ ${depositAmount} · คงเหลือ ${remaining}` : ""),
        "success"
      );
      resetForm();
      load();
    } else {
      toast("ออกบิลไม่สำเร็จ", "error");
    }
  };

  const editInvoice = (inv: Invoice) => {
    if (inv.status === "paid") return toast("บิลปิดแล้ว แก้ไขไม่ได้ (ลบได้อย่างเดียว)", "error");
    if (inv.customerId) setCustomerId(inv.customerId);
    // โหลดรายการเป็นแบบ "พิมพ์เอง" (แก้ยอด/ชื่อได้) — เก็บของแถมฟรีด้วย
    setItems(
      (inv.items || []).map((it) => {
        const qty = Math.max(1, Math.round(it.qty || 1));
        return {
          ...newGrooming(),
          kind: it.amount > 0 ? ("custom" as const) : ("freebie" as const),
          // ถอดคำนำหน้าชื่อน้อง/ตัวคูณออก แล้วเก็บกลับเป็นฟิลด์ — กันชื่อน้องซ้อนกันตอนบันทึกใหม่
          label: it.label
            .replace(/^🐱 .+? · /, "")
            .replace(/ × \d+$/, "")
            .replace(/^🎁 /, "")
            .replace(/ \(ฟรี\)$/, ""),
          catName: it.catName,
          qty,
          // ช่องราคาของรายการ "พิมพ์เอง" คือราคาต่อหน่วย
          amount: it.unitAmount ?? Math.round(it.amount / qty),
        };
      })
    );
    setBillDeposit(inv.deposit ? String(inv.deposit) : "");
    setBillDepPct(null);
    setDiscount("");
    setEditingId(inv.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /**
   * ผูกบิลเข้ากับนัดด้วยมือ — ใช้ตอนบิลไม่มีนัดผูกอยู่ (เช่นบิลเก่า/พิมพ์เองไม่ได้ดึงจากนัด)
   * ปุ่มส่งการ์ดที่ต้องอิงนัด (แจ้งเตือนนัด/ส่งชุดการ์ด) จะกลับมาใช้ได้หลังผูกแล้ว
   */
  const linkInvoiceToBooking = async (invId: string, bookingId: string) => {
    setInvoiceBusy(`${invId}:link_booking`);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invId, action: "link_booking", bookingId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("ผูกนัดให้บิลแล้ว — ปุ่มส่งการ์ดกลับมาแล้ว 🔗", "success");
        load();
      } else if (data.error === "customer_mismatch") {
        toast("นัดนี้เป็นของลูกค้าคนอื่น — ผูกไม่ได้ (กันส่งการ์ดผิดคน)", "error");
      } else {
        toast("ผูกนัดไม่สำเร็จ", "error");
      }
    } finally {
      setInvoiceBusy("");
    }
  };

  const invoiceAction = async (
    id: string,
    action: string,
    okMsg: string,
    confirmMsg?: string
  ) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setInvoiceBusy(`${id}:${action}`);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(okMsg, "success");
        if (editingId === id) resetForm();
        load();
      } else {
        toast(data.error === "already_received" ? "รับมัดจำบิลนี้ไปแล้ว" : "ไม่สำเร็จ", "error");
      }
    } finally {
      setInvoiceBusy("");
    }
  };

  const markPaid = async (
    id: string,
    method: "transfer" | "member_credit" | "cash"
  ) => {
    // กันกดรัว — ปุ่มนี้เมื่อก่อนไม่มีตัวล็อก กดสองทีเสี่ยงลงบัญชีซ้ำ
    if (invoiceBusy) return;
    setInvoiceBusy(`${id}:mark_paid`);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "mark_paid", paymentMethod: method }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        // ปุ่มนี้เป็นแค่สถานะหลังบ้าน — ไม่ส่งอะไรหาลูกค้า ต้องบอกให้ร้านรู้ว่าใบเสร็จต้องกดส่งเอง
        toast("รับเงินแล้ว — ลงบัญชี + แต้ม ✅ (ใบเสร็จกดส่งเองที่ปุ่ม 🧾)", "success");
        load();
      } else if (data.error === "insufficient_credit") {
        toast("เครดิต Member ไม่พอ", "error");
      } else if (data.error === "invalid" || data.error === "already_paid") {
        toast("บิลนี้ปิดไปแล้ว (อาจกดซ้ำ) — รีเฟรชให้แล้วนะคะ", "error");
        load();
      } else {
        toast("ไม่สำเร็จ", "error");
      }
    } finally {
      setInvoiceBusy("");
    }
  };

  const sub = "w-full rounded-lg border border-petflow-line bg-paper px-3 py-2 text-sm";
  const field =
    "w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-sm";

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-petflow-chocolate">💳 คิดเงิน</h1>

      <div className="mb-4 space-y-3 rounded-petflow bg-card p-4 shadow-petflow-sm">
        {/* ── ดึงจากนัด ── */}
        {bookings.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowBookings((v) => !v)}
              className="w-full rounded-petflow-sm border border-dashed border-latte/60 bg-latte/10 py-2 text-xs font-extrabold text-latte-deep"
            >
              📅 ดึงจากนัด ({bookingGroups.length}) {showBookings ? "▲" : "▼"}
            </button>
            {showBookings && (
              <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {bookingGroups.map((group) => {
                  const bk = group[0];
                  return (
                    <li key={group.map((g) => g.id).join(",")}>
                      <button
                        type="button"
                        onClick={() => pickBooking(group)}
                        className="block w-full rounded-petflow-sm border border-petflow-line bg-paper px-3 py-2 text-left text-xs"
                      >
                        <span className="font-bold text-brown">
                          {bk.service === "room" ? "🏠" : "🛁"} {groupCatNames(group)} ·{" "}
                          {bk.customerName}
                          {group.length > 1 && (
                            <span className="ml-1 rounded-full bg-latte/25 px-1.5 py-0.5 text-[10px] font-extrabold text-latte-deep">
                              {group.length} ตัว · บิลใบเดียว
                            </span>
                          )}
                        </span>
                        <span className="block text-[10px] text-brown-faint">
                          {bk.service === "room"
                            ? `${bk.checkin || "?"} → ${bk.checkout || "?"}${bk.room ? ` · ${bk.room}` : ""}`
                            : bk.date || ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ── ค้นหาลูกค้า ── */}
        <div>
          <p className="mb-1 text-xs font-bold text-brown-soft">ลูกค้า</p>
          {selected ? (
            <div className="rounded-petflow-sm border border-latte/50 bg-latte/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-bold text-brown">
                  🐱 {selected.cats[0]?.name || "—"} · {selected.name}
                  {selected.isMember ? ` · 💎 ${selected.memberCredit}฿` : ""}
                </span>
                <button
                  type="button"
                  onClick={clearCustomer}
                  className="shrink-0 text-xs font-bold text-wait"
                >
                  ✕ เปลี่ยน
                </button>
              </div>
              {(selected.depositCredit ?? 0) > 0 && (
                <p className="mt-1.5 text-[11px] font-bold text-ok">
                  💰 มีเครดิตมัดจำล่วงหน้า {selected.depositCredit!.toLocaleString()} บาท —
                  ออกบิลนี้จะหักให้อัตโนมัติ
                </p>
              )}
            </div>
          ) : quickSale ? (
            <div className="flex items-center justify-between gap-2 rounded-petflow-sm border border-honey-deep/50 bg-honey/15 px-3 py-2">
              <span className="text-sm font-bold text-petflow-chocolate">
                ⚡ ขายเร็ว ไม่ระบุลูกค้า — ขายสินค้าหน้าร้านอย่างเดียวได้เลย
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuickSale(false);
                  // กลับไปโหมดปกติ (มีลูกค้า/นัด) — คืนแถวอาบน้ำเริ่มต้นให้เหมือนเดิม
                  setItems([newGrooming()]);
                }}
                className="shrink-0 text-xs font-bold text-wait"
              >
                ✕ เปลี่ยน
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setQuickSale(true);
                  // ขายเร็วมักเป็นบิลซื้อสินค้าล้วนๆ ไม่มีอาบน้ำ — ล้างแถวอาบน้ำเริ่มต้นทิ้ง
                  // ไม่งั้นค้างเป็นรายการ 450฿ ที่ไม่มีใครตั้งใจขาย ติดไปในบิลโดยไม่รู้ตัว
                  setItems([]);
                }}
                className="mb-1.5 w-full rounded-petflow-sm bg-honey/25 py-2 text-xs font-extrabold text-petflow-chocolate"
              >
                ⚡ ขายเร็ว ไม่ระบุลูกค้า (ขายของหน้าร้านอย่างเดียว)
              </button>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowList(true);
                }}
                onFocus={() => setShowList(true)}
                placeholder="🔍 พิมพ์ชื่อลูกค้า / ชื่อแมว / เบอร์"
                className={field}
              />
              {showList && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-petflow-sm border border-petflow-line bg-card shadow-petflow">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-brown-soft">ไม่พบลูกค้า</li>
                  ) : (
                    filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => pickCustomer(c)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-paper"
                        >
                          <span className="font-bold text-brown">
                            {c.cats[0]?.name || "👤"}
                          </span>{" "}
                          · {c.name}
                          {c.isMember ? " 💎" : ""}
                          <span className="block text-[10px] text-brown-faint">
                            {c.phone || "ไม่มีเบอร์"}
                            {c.lineUserId ? " · LINE ✓" : ""}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>


        {/* ── รายการ ── */}
        <div>
          <p className="mb-1 text-xs font-bold text-brown-soft">รายการ</p>
          <div className="space-y-2">
            {items.map((item, i) => {
              const line = computeLine(item);
              const prog = groomProgram(item.program);
              return (
                <div
                  key={i}
                  className="space-y-2 rounded-petflow-sm border border-petflow-line bg-paper/40 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={item.kind}
                      onChange={(e) => changeKind(i, e.target.value as ItemKind)}
                      className="min-w-0 flex-1 rounded-lg border border-petflow-line bg-card px-3 py-2 text-sm font-bold"
                    >
                      {/* รายการสินค้าจากกริดเท่านั้นที่มี kind นี้ — ไม่ให้เลือกเองจาก dropdown
                          (เปลี่ยนจาก dropdown จะล้าง productId ทิ้งเสมอ ดู changeKind) แต่ยังต้อง
                          มี option ไว้โชว์ค่าปัจจุบัน ไม่งั้น select จะโชว์ว่างเปล่า */}
                      {item.kind === "product" && (
                        <option value="product" hidden>
                          🛒 สินค้า
                        </option>
                      )}
                      {KIND_OPTIONS.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="shrink-0 px-1 text-brown-faint"
                        aria-label="ลบรายการ"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* บ้านที่มีแมวหลายตัว — ระบุว่ารายการนี้ของน้องตัวไหน
                      โชว์เฉพาะตอนที่ลูกค้ามีแมวมากกว่า 1 ตัว จะได้ไม่รกโดยไม่จำเป็น */}
                  {(selected?.cats.length || 0) > 1 && item.kind !== "freebie" && (
                    <div className="rounded-petflow-sm border border-petflow-line bg-paper px-2.5 py-2">
                      <p className="mb-1.5 text-[10px] font-bold text-brown-soft">
                        🐱 รายการนี้ของน้องตัวไหน — ติ๊กได้หลายตัว (เช่น นอนห้องเดียวกัน)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected?.cats.map((c) => {
                          const picked = parseCatNames(item.catName);
                          const key = catKey(c.name);
                          const on = picked.some((n) => catKey(n) === key);
                          return (
                            <button
                              key={c.id || c.name}
                              type="button"
                              onClick={() =>
                                updateItem(i, {
                                  catName: joinCatNames(
                                    on
                                      ? picked.filter((n) => catKey(n) !== key)
                                      : [...picked, c.name]
                                  ),
                                })
                              }
                              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                on
                                  ? "bg-latte-deep text-white"
                                  : "bg-card text-brown-soft"
                              }`}
                            >
                              {on ? "✓ " : ""}
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                      {parseCatNames(item.catName).length === 0 && (
                        <p className="mt-1 text-[10px] text-brown-faint">
                          ไม่ติ๊ก = ไม่ระบุตัว (ใช้ได้ปกติ)
                        </p>
                      )}
                    </div>
                  )}

                  {item.kind === "grooming" && (
                    <>
                      <select
                        value={item.program}
                        onChange={(e) => changeProgram(i, e.target.value)}
                        className={sub}
                      >
                        {GROOM_PROGRAMS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={item.breed}
                          onChange={(e) => updateItem(i, { breed: e.target.value })}
                          className={sub}
                        >
                          {prog?.breeds.map((b) => (
                            <option key={b.breed} value={b.breed}>
                              {b.breed}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.size}
                          onChange={(e) =>
                            updateItem(i, { size: e.target.value as GroomSize })
                          }
                          className={sub}
                        >
                          {GROOM_SIZES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {item.kind === "room" && (
                    <div className="flex gap-2">
                      <select
                        value={item.roomLabel}
                        onChange={(e) => {
                          const r = rooms.find((x) => x.label === e.target.value);
                          updateItem(i, {
                            roomLabel: e.target.value,
                            roomPrice: r?.amount || 0,
                          });
                        }}
                        className={`${sub} min-w-0 flex-1`}
                      >
                        {rooms.map((r) => (
                          <option key={r.label} value={r.label}>
                            {r.label} ({r.amount}฿/คืน)
                          </option>
                        ))}
                      </select>
                      <div className="flex shrink-0 items-center gap-1">
                        <NumField
                          value={item.nights || 1}
                          min={1}
                          onCommit={(n) => updateItem(i, { nights: n })}
                          className="w-16 rounded-lg border border-petflow-line bg-paper px-2 py-2 text-center text-sm"
                        />
                        <span className="text-xs font-bold text-brown-soft">คืน</span>
                      </div>
                    </div>
                  )}

                  {item.kind === "service" && (
                    <select
                      value={item.label}
                      onChange={(e) => {
                        const p = servicePresets.find((x) => x.label === e.target.value);
                        updateItem(i, {
                          label: e.target.value,
                          amount: p?.amount ?? item.amount,
                        });
                      }}
                      className={sub}
                    >
                      {servicePresets.map((p) => (
                        <option key={p.label} value={p.label}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {item.kind === "custom" && (
                    <input
                      value={item.label}
                      onChange={(e) => updateItem(i, { label: e.target.value })}
                      placeholder="พิมพ์ชื่อรายการ"
                      className={sub}
                    />
                  )}

                  {item.kind === "freebie" && (
                    <>
                      <input
                        value={item.label}
                        onChange={(e) => updateItem(i, { label: e.target.value })}
                        placeholder="ของแถม (เช่น กล้องวงจรปิด)"
                        list={`freebies-${i}`}
                        className={sub}
                      />
                      <datalist id={`freebies-${i}`}>
                        {freebiePresets.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </>
                  )}

                  {/* จำนวนชิ้น — ซื้อหลายอันไม่ต้องเพิ่มทีละบรรทัด
                      ห้องพักไม่มีช่องนี้ เพราะคิดเป็น "คืน" อยู่แล้ว */}
                  {item.kind !== "room" && item.kind !== "freebie" && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-brown-soft">จำนวน</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(i, { qty: Math.max(1, (item.qty || 1) - 1) })
                        }
                        className="h-8 w-8 shrink-0 rounded-lg border border-petflow-line bg-card text-sm font-extrabold text-brown disabled:opacity-40"
                        disabled={(item.qty || 1) <= 1}
                        aria-label="ลดจำนวน"
                      >
                        −
                      </button>
                      <NumField
                        value={item.qty || 1}
                        min={1}
                        onCommit={(n) => updateItem(i, { qty: n })}
                        className="w-14 rounded-lg border border-petflow-line bg-paper px-2 py-1.5 text-center text-sm font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => updateItem(i, { qty: (item.qty || 1) + 1 })}
                        className="h-8 w-8 shrink-0 rounded-lg border border-petflow-line bg-card text-sm font-extrabold text-brown"
                        aria-label="เพิ่มจำนวน"
                      >
                        +
                      </button>
                      {(item.qty || 1) > 1 && (
                        <span className="text-[11px] text-brown-faint">
                          {line.unitAmount.toLocaleString()} ฿ × {line.qty}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] text-brown-faint">
                      {line.label}
                    </span>
                    {item.kind === "service" || item.kind === "custom" ? (
                      <NumField
                        value={item.amount}
                        min={0}
                        onCommit={(n) => updateItem(i, { amount: n })}
                        className="w-24 shrink-0 rounded-lg border border-petflow-line bg-paper px-3 py-1.5 text-right text-sm font-bold"
                      />
                    ) : item.kind === "freebie" ? (
                      <span className="shrink-0 text-sm font-extrabold text-ok">
                        ฟรี 🎁
                      </span>
                    ) : (
                      <span className="shrink-0 text-sm font-extrabold text-latte-deep">
                        {line.amount.toLocaleString()} ฿
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, newGrooming()])}
              className="flex flex-1 items-center justify-center gap-2 rounded-petflow-sm border-2 border-dashed border-latte/60 bg-latte/10 py-2.5 text-sm font-extrabold text-latte-deep transition active:scale-[.98]"
            >
              <span className="text-lg">➕</span> เพิ่มรายการ
              <span className="text-lg">🧾</span>
            </button>
            <button
              type="button"
              onClick={() => setShowProductPicker((v) => !v)}
              className="flex flex-1 items-center justify-center gap-2 rounded-petflow-sm border-2 border-dashed border-sky-deep/50 bg-sky/20 py-2.5 text-sm font-extrabold text-sky-deep transition active:scale-[.98]"
            >
              <span className="text-lg">🛒</span> เพิ่มสินค้า
            </button>
          </div>

          {showProductPicker && (
            <div className="mt-2 rounded-petflow-sm border border-petflow-line bg-card p-2.5">
              {products.length === 0 ? (
                <p className="py-4 text-center text-xs text-brown-soft">
                  ยังไม่มีสินค้า — ไปเพิ่มที่เมนู &quot;สินค้าหน้าร้าน&quot; ก่อน
                </p>
              ) : (
                <>
                  <div className="mb-2 flex gap-1.5 overflow-x-auto">
                    {["ทั้งหมด", ...new Set(products.map((p) => p.category).filter(Boolean))].map(
                      (t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setProductTab(t)}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                            productTab === t
                              ? "bg-honey/40 text-petflow-chocolate"
                              : "bg-paper text-brown-soft"
                          }`}
                        >
                          {t}
                        </button>
                      )
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {products
                      .filter((p) => productTab === "ทั้งหมด" || p.category === productTab)
                      .map((p) => {
                        const outOfStock = p.stockCount <= 0;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={outOfStock}
                            onClick={() => addProduct(p)}
                            className="relative flex flex-col items-center gap-1 rounded-petflow-sm border border-petflow-line bg-paper/50 p-2 text-center transition active:scale-[.97] disabled:opacity-40"
                          >
                            <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-petflow-sm bg-card">
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-xl">📦</span>
                              )}
                              {outOfStock && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-extrabold text-white">
                                  หมด
                                </span>
                              )}
                            </span>
                            <span className="line-clamp-2 text-[10px] font-bold text-brown">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-extrabold text-latte-deep">
                              {p.price.toLocaleString()}฿
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── โปร + ส่วนลด ── */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-xs font-bold text-brown-soft">
            โปรโมชั่น
            <select
              value={promoId}
              onChange={(e) => setPromoId(e.target.value)}
              className={`mt-1 ${field}`}
            >
              <option value="">ไม่ใช้โปร</option>
              {promos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title.th}
                  {p.discountPercent ? ` (${p.discountPercent}%)` : ""}
                  {p.discountAmount ? ` (-${p.discountAmount}฿)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-brown-soft">
            ส่วนลดเพิ่ม
            <div className="mt-1 flex gap-1.5">
              <input
                type="number"
                min="0"
                max={discountMode === "percent" ? 100 : undefined}
                inputMode="numeric"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className={`min-w-0 flex-1 ${field}`}
              />
              <div className="flex shrink-0 overflow-hidden rounded-petflow-sm border border-petflow-line">
                {(["baht", "percent"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDiscountMode(m)}
                    className={`px-3 py-2 text-xs font-extrabold transition ${
                      discountMode === m
                        ? "bg-latte-deep text-white"
                        : "bg-paper text-brown-soft"
                    }`}
                  >
                    {m === "baht" ? "฿" : "%"}
                  </button>
                ))}
              </div>
            </div>
            {discountMode === "percent" && discountInput > 0 && (
              <span className="mt-1 block text-[10px] font-normal text-brown-faint">
                ลด {Math.min(100, discountInput)}% = {manualDiscount.toLocaleString()} บาท
              </span>
            )}
          </label>

          {customerCoupons.length > 0 && (
            <div>
              <span className="mb-1 block text-xs font-bold text-brown-soft">
                🎟️ คูปองของลูกค้า (กดใช้)
              </span>
              <div className="flex flex-wrap gap-2">
                {customerCoupons.map((cp) => (
                  <button
                    key={cp.id}
                    type="button"
                    onClick={() => setCouponId((prev) => (prev === cp.id ? "" : cp.id))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      couponId === cp.id
                        ? "bg-latte-deep text-card"
                        : "bg-paper text-brown-soft"
                    }`}
                  >
                    {couponId === cp.id ? "✓ " : ""}฿{cp.amount} · {cp.reason}
                  </button>
                ))}
              </div>
            </div>
          )}

          {customerPackages.length > 0 && (
            <div>
              <span className="mb-1 block text-xs font-bold text-brown-soft">
                🎫 คอร์สของลูกค้า (นับครั้ง = บิลนี้ฟรี · นับคืน = หักตามคืนที่พัก)
              </span>
              <div className="flex flex-wrap gap-2">
                {customerPackages.map((pk) => (
                  <button
                    key={pk.id}
                    type="button"
                    onClick={() => setPackageId((prev) => (prev === pk.id ? "" : pk.id))}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                      packageId === pk.id ? "bg-sage text-card" : "bg-paper text-brown-soft"
                    }`}
                  >
                    {packageId === pk.id ? "✓ " : ""}
                    {pk.name} (เหลือ {pk.totalUses - pk.usedUses}/{pk.totalUses}{" "}
                    {pk.unit === "night" ? "คืน" : "ครั้ง"})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {pickedPackage?.unit === "night" && (
          <p className="rounded-catcha-sm bg-sage/15 px-3 py-1.5 text-[11px] font-bold text-ok">
            {nightsToUse > 0
              ? `🏠 หักคอร์ส ${nightsToUse} คืน (คลุมค่าห้าง ${nightsCover.toLocaleString()} บาท)`.replace(
                  "ค่าห้าง",
                  "ค่าห้อง"
                )
              : "⚠️ บิลนี้ไม่มีรายการห้องพัก หรือคอร์สหมดคืนแล้ว — ยังหักไม่ได้"}
            {nightsToUse > 0 && nightsOnBill > nightsToUse && (
              <span className="block font-normal text-brown-soft">
                บิลนี้พัก {nightsOnBill} คืน แต่คอร์สเหลือ {nightsToUse} คืน — ส่วนที่เกินคิดเงินตามปกติ
              </span>
            )}
          </p>
        )}

        {autoPromoLabel && promoId && (
          <p className="rounded-petflow-sm bg-sage/15 px-3 py-1.5 text-[11px] font-bold text-ok">
            ⚡ ใช้โปร &quot;{autoPromoLabel}&quot; อัตโนมัติ (ลูกค้าคนนี้มีสิทธิ์)
          </p>
        )}

        {/* ── สรุปยอด ── */}
        <div className="space-y-1 rounded-petflow-sm bg-paper/60 px-3 py-2 text-sm">
          <div className="flex justify-between text-brown-soft">
            <span>ยอดรวม</span>
            <span>{subtotal.toLocaleString()} ฿</span>
          </div>
          {(promoDiscount > 0 || manualDiscount > 0) && (
            <div className="flex justify-between text-wait">
              <span>ส่วนลด</span>
              <span>-{(promoDiscount + manualDiscount).toLocaleString()} ฿</span>
            </div>
          )}
          <div className="flex justify-between border-t border-petflow-line pt-1 text-base font-extrabold text-petflow-chocolate">
            <span>ยอดสุทธิ</span>
            <span>{total.toLocaleString()} ฿</span>
          </div>
          {/* มัดจำของบิลนี้ (ถ้ามี) — กด % หรือใส่เอง */}
          <div className="flex items-center justify-between gap-2 border-t border-petflow-line pt-1.5">
            <span className="text-xs font-bold text-brown-soft">💰 มัดจำ (ถ้ามี)</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              placeholder="0"
              value={billDeposit}
              onChange={(e) => {
                setBillDeposit(e.target.value);
                setBillDepPct(null);
              }}
              className="w-24 rounded-lg border border-petflow-line bg-paper px-3 py-1.5 text-right text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {[10, 20, 30, 50].map((pct) => {
              const amt = Math.round((total * pct) / 100);
              return (
                <button
                  key={pct}
                  type="button"
                  disabled={total <= 0}
                  onClick={() => {
                    setBillDeposit(String(amt));
                    setBillDepPct(pct);
                  }}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold disabled:opacity-40 ${
                    billDepPct === pct
                      ? "bg-honey text-petflow-chocolate"
                      : "bg-paper text-brown-soft"
                  }`}
                >
                  {pct}%
                </button>
              );
            })}
            {billDeposit && (
              <button
                type="button"
                onClick={() => {
                  setBillDeposit("");
                  setBillDepPct(null);
                }}
                className="rounded-full px-2.5 py-1 text-[10px] font-bold text-wait"
              >
                ล้าง
              </button>
            )}
          </div>
          {depositAmount > 0 && (
            <div className="flex justify-between font-extrabold text-wait">
              <span>คงเหลือ (เก็บทีหลัง)</span>
              <span>{remaining.toLocaleString()} ฿</span>
            </div>
          )}
        </div>

        {/* ── สรุป (ก๊อป / ส่ง LINE ให้ลูกค้า) ── */}
        <div className="space-y-2 rounded-petflow-sm border border-petflow-line bg-card/80 p-2.5">
          <p className="text-[10px] font-bold text-brown-soft">
            สรุปให้ลูกค้า — ก๊อปไปแปะ หรือส่งเข้า LINE เลย
          </p>
          {(
            [
              ["booking", "📋 สรุปการจอง"],
              ["deposit", "💰 แจ้งมัดจำ"],
              ["full", "💳 แจ้งยอดเต็ม"],
            ] as const
          ).map(([mode, label]) => (
            <div key={mode} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-brown">
                {label}
              </span>
              <button
                type="button"
                onClick={() => copySummary(mode)}
                disabled={!selected}
                className="shrink-0 rounded-full bg-paper px-3 py-1.5 text-[10px] font-bold text-brown-soft disabled:opacity-40"
              >
                📋 ก๊อป
              </button>
              <button
                type="button"
                onClick={() => sendSummaryLine(mode)}
                disabled={!selected || sending}
                className="shrink-0 rounded-full bg-[#06C755]/15 px-3 py-1.5 text-[10px] font-bold text-[#06883c] disabled:opacity-40"
              >
                💬 ส่ง LINE
              </button>
            </div>
          ))}
        </div>
        {copied && (
          <p className="text-center text-[11px] font-bold text-ok">✅ ก๊อปข้อความแล้ว — เอาไปแปะแชทลูกค้าได้เลย</p>
        )}

        <button
          type="button"
          disabled={creating}
          onClick={createBill}
          className="w-full rounded-petflow-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-petflow-chocolate disabled:opacity-60"
        >
          {creating
            ? "กำลังบันทึก…"
            : editingId
              ? "💾 บันทึกการแก้ไขบิล"
              : "🧾 ออกบิล"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="w-full rounded-petflow-sm bg-paper py-2 text-xs font-bold text-brown-soft"
          >
            ยกเลิกการแก้ไข
          </button>
        )}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-extrabold">บิล</h2>
        {(() => {
          const pending = invoices.filter((i) => i.status === "pending");
          const due = pending.reduce((s, i) => s + (i.total - (i.deposit || 0)), 0);
          return due > 0 ? (
            <span className="rounded-full bg-wait/15 px-2.5 py-1 text-[11px] font-extrabold text-wait">
              ยอดค้างรวม {due.toLocaleString()} ฿ ({pending.length} บิล)
            </span>
          ) : null;
        })()}
      </div>
      <div className="mb-2 flex gap-1.5">
        {(
          [
            ["all", "ทั้งหมด"],
            ["pending", "รอชำระ"],
            ["paid", "จ่ายแล้ว"],
          ] as const
        ).map(([f, label]) => {
          const n =
            f === "all"
              ? invoices.length
              : invoices.filter((i) => i.status === f).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setBillFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                billFilter === f
                  ? "bg-honey/45 text-petflow-chocolate"
                  : "bg-paper text-brown-soft"
              }`}
            >
              {label} {n}
            </button>
          );
        })}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={billSearch}
          onChange={(e) => setBillSearch(e.target.value)}
          placeholder="🔍 ค้นหาชื่อน้อง / ลูกค้า / เลขบิล"
          className="min-w-0 flex-1 rounded-petflow-sm border border-petflow-line bg-paper px-3 py-1.5 text-xs"
        />
        <select
          value={billSort}
          onChange={(e) => setBillSort(e.target.value as typeof billSort)}
          className="rounded-petflow-sm border border-petflow-line bg-paper px-2 py-1.5 text-xs font-bold text-brown-soft"
        >
          <option value="issued-desc">🧾 ออกบิลล่าสุดก่อน</option>
          <option value="issued-asc">🧾 ออกบิลเก่าก่อน</option>
          <option value="date-desc">📅 วันนัดล่าสุดก่อน</option>
          <option value="date-asc">📅 วันนัดเก่าก่อน</option>
          <option value="amount-desc">💰 ยอดมากสุด</option>
          <option value="due-desc">⏳ ค้างชำระมากสุด</option>
        </select>
      </div>
      {(() => {
        const linkedFor = (inv: Invoice) =>
          bookings.find((b) => b.id === inv.bookingId) ||
          bookings.find(
            (b) =>
              !!b.customerId &&
              b.customerId === inv.customerId &&
              b.catName === inv.catName &&
              b.status !== "cancelled"
          );
        const serviceDate = (inv: Invoice) => {
          const bk = linkedFor(inv);
          return bk?.checkin || bk?.date || (inv.createdAt || "").slice(0, 10) || "";
        };
        const dueOf = (inv: Invoice) => inv.total - (inv.deposit || 0);
        const q = billSearch.trim().toLowerCase();
        let list = invoices
          .filter((inv) => billFilter === "all" || inv.status === billFilter)
          .filter(
            (inv) =>
              !q ||
              [inv.catName, inv.customerName, inv.id].some((s) =>
                (s || "").toLowerCase().includes(q)
              )
          );
        list = [...list].sort((a, b) => {
          if (billSort === "amount-desc") return b.total - a.total;
          if (billSort === "due-desc") return dueOf(b) - dueOf(a);
          if (billSort === "issued-asc" || billSort === "issued-desc") {
            const ia = a.createdAt || "";
            const ib = b.createdAt || "";
            return billSort === "issued-asc"
              ? ia < ib ? -1 : ia > ib ? 1 : 0
              : ia > ib ? -1 : ia < ib ? 1 : 0;
          }
          const da = serviceDate(a);
          const db = serviceDate(b);
          if (billSort === "date-asc") return da < db ? -1 : da > db ? 1 : 0;
          return da > db ? -1 : da < db ? 1 : 0;
        });

        const renderBill = (inv: Invoice) => {
          // ผูกนัดโดยตรง หรือถ้าไม่ได้ผูก → เดาจากนัดของลูกค้า/น้องตัวเดียวกัน
          const linkedBk = linkedFor(inv);
          const sched = scheduleLabelFor(linkedBk);
          return (
          <div key={inv.id} className="rounded-petflow border border-petflow-line bg-card p-4">
            <p className="font-bold text-brown">
              {inv.catName} · {inv.customerName}
            </p>

            {sched ? (
              <p className="mt-1 text-xs font-bold text-latte-deep">{sched}</p>
            ) : null}

            {inv.items && inv.items.length > 0 && (
              <div className="mt-2 space-y-0.5 rounded-petflow-sm bg-paper/50 px-3 py-2 text-xs text-brown-soft">
                {inv.items.map((it, k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{it.label}</span>
                    <span className="shrink-0">{it.amount.toLocaleString()} ฿</span>
                  </div>
                ))}
                {inv.discount ? (
                  <div className="flex justify-between border-t border-petflow-line pt-0.5 text-wait">
                    <span>ส่วนลด{inv.promoLabel ? ` (${inv.promoLabel})` : ""}</span>
                    <span>-{inv.discount.toLocaleString()} ฿</span>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold text-latte-deep">
                {inv.total.toLocaleString()} บาท
              </span>
              {inv.status === "paid" ? (
                <span className="rounded-full bg-ok/20 px-2.5 py-1 text-xs font-extrabold text-ok">
                  ✅ ชำระแล้ว
                </span>
              ) : (
                <span className="rounded-full bg-wait/20 px-2.5 py-1 text-xs font-extrabold text-wait">
                  ⏳ รอชำระ
                </span>
              )}
            </div>
            {(inv.deposit ?? 0) > 0 && (
              <p className="text-[11px] font-bold text-ok">
                {inv.depositReceivedAt ? "✅ รับมัดจำแล้ว " : "💰 มัดจำ (รอรับ) "}
                {inv.deposit!.toLocaleString()}
                {inv.status === "pending" && (
                  <span className="text-wait">
                    {" "}
                    · คงเหลือ {(inv.total - inv.deposit!).toLocaleString()} บาท
                  </span>
                )}
              </p>
            )}

            {/* ส่งการ์ดให้ลูกค้า — ชุดปุ่มรวม (เหมือนในปฏิทิน กดจากบิลนี้ได้) */}
            <div className="mt-2 rounded-petflow-sm bg-paper/50 p-2">
              <CustomerSendButtons
                invoiceId={inv.id}
                bookingId={inv.bookingId || linkedBk?.id}
                customerId={inv.customerId}
                lineUserId={inv.lineUserId}
                service={billServiceKind(inv.items)}
                invoiceDeposit={inv.deposit ?? 0}
                invoiceStatus={inv.status}
                initialAutoOff={linkedBk?.autoOff}
                onDone={load}
              />
              {/* บิลนี้ไม่มีนัดผูกอยู่ — ปุ่มแจ้งเตือนนัด/ส่งชุดการ์ดข้างบนเลยหายไปหมด
                  ให้เลือกผูกนัดของลูกค้าคนนี้เองได้ ไม่ต้องแก้ที่ไหนเพิ่ม */}
              {!inv.bookingId && !linkedBk && (
                <div className="mt-2 rounded-petflow-sm border border-dashed border-latte/60 bg-latte/10 px-2.5 py-2">
                  <p className="mb-1.5 text-[10px] font-bold text-brown-soft">
                    ⚠️ บิลนี้ไม่มีนัดผูกอยู่ — ปุ่มแจ้งเตือนนัด/ส่งชุดการ์ดเลยไม่ขึ้น
                    เลือกผูกนัดได้ที่นี่:
                  </p>
                  <select
                    disabled={invoiceBusy === `${inv.id}:link_booking`}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) linkInvoiceToBooking(inv.id, e.target.value);
                    }}
                    className="w-full rounded-lg border border-petflow-line bg-paper px-2.5 py-1.5 text-xs"
                  >
                    <option value="">🔗 เลือกนัดของ {inv.customerName}...</option>
                    {bookings
                      .filter((b) => b.customerId === inv.customerId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.service === "room" ? "🏠" : "🛁"} {b.catName} ·{" "}
                          {b.service === "room"
                            ? `${b.checkin || "?"} → ${b.checkout || "?"}`
                            : b.date || ""}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {inv.status === "pending" && (
              <div className="mt-2 flex flex-wrap gap-2">
                {(inv.deposit ?? 0) > 0 && !inv.depositReceivedAt && (
                  <button
                    type="button"
                    disabled={invoiceBusy === `${inv.id}:receive_deposit`}
                    onClick={() =>
                      invoiceAction(
                        inv.id,
                        "receive_deposit",
                        "รับมัดจำแล้ว 💰 (ลงบัญชี + ส่งการ์ดขอบคุณให้ลูกค้า)"
                      )
                    }
                    className="rounded-full bg-honey/40 px-3 py-1.5 text-xs font-bold text-petflow-chocolate disabled:opacity-50"
                  >
                    💰 รับมัดจำแล้ว
                  </button>
                )}
                <button
                  type="button"
                  disabled={!!invoiceBusy}
                  onClick={() => markPaid(inv.id, "transfer")}
                  className="rounded-full bg-sage/20 px-3 py-1.5 text-xs font-bold text-ok disabled:opacity-50"
                >
                  ✅ {(inv.deposit ?? 0) > 0 ? "รับเงินที่เหลือ (ปิดบิล)" : "รับเงินแล้ว"}
                </button>
                {customers.find((c) => c.id === inv.customerId)?.isMember && (
                  <button
                    type="button"
                    disabled={!!invoiceBusy}
                    onClick={() => markPaid(inv.id, "member_credit")}
                    className="rounded-full bg-honey/30 px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                  >
                    💎 หัก Member
                  </button>
                )}
                <button
                  type="button"
                  disabled={!!invoiceBusy}
                  onClick={() => markPaid(inv.id, "cash")}
                  className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                >
                  💵 เงินสด
                </button>
                <button
                  type="button"
                  onClick={() => editInvoice(inv)}
                  className="rounded-full bg-latte/25 px-3 py-1.5 text-xs font-bold text-petflow-chocolate"
                >
                  ✏️ แก้ไข
                </button>
              </div>
            )}
            {inv.status === "paid" && (
              <div className="mt-2">
                <button
                  type="button"
                  disabled={invoiceBusy === `${inv.id}:unmark_paid`}
                  onClick={() =>
                    invoiceAction(
                      inv.id,
                      "unmark_paid",
                      "ยกเลิกการชำระแล้ว ↩️ — บิลกลับเป็น 'รอชำระ' แก้ไขต่อได้",
                      "ยกเลิกการชำระบิลนี้? (กดผิดใช่ไหม)\nจะกลับเป็น 'รอชำระ' + ย้อนรายรับ/แต้ม/เครดิตที่ลงไป"
                    )
                  }
                  className="rounded-full bg-wait/15 px-3 py-1.5 text-xs font-bold text-wait disabled:opacity-50"
                >
                  ↩️ ยกเลิกการชำระ (กดผิด)
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={invoiceBusy === `${inv.id}:delete`}
              onClick={() =>
                invoiceAction(
                  inv.id,
                  "delete",
                  "ลบบิลแล้ว 🗑️",
                  `ลบบิลนี้? (${inv.total.toLocaleString()} บาท) — ลบรายการบัญชีที่ผูกด้วย กู้คืนไม่ได้`
                )
              }
              className="mt-2 text-[11px] font-bold text-wait"
            >
              🗑️ ลบบิล
            </button>
          </div>
          );
        };

        if (
          billSort === "date-desc" ||
          billSort === "date-asc" ||
          billSort === "issued-desc" ||
          billSort === "issued-asc"
        ) {
          const isIssuedSort = billSort === "issued-desc" || billSort === "issued-asc";
          const groups: { date: string; bills: Invoice[] }[] = [];
          for (const inv of list) {
            const d = isIssuedSort
              ? (inv.createdAt || "").slice(0, 10)
              : serviceDate(inv);
            let g = groups.find((x) => x.date === d);
            if (!g) {
              g = { date: d, bills: [] };
              groups.push(g);
            }
            g.bills.push(inv);
          }
          if (groups.length === 0) {
            return (
              <p className="py-6 text-center text-xs text-brown-soft">ไม่พบบิล</p>
            );
          }
          return (
            <div className="space-y-4">
              {groups.map((g) => {
                const dayTotal = g.bills.reduce((s, i) => s + i.total, 0);
                const dayDue = g.bills
                  .filter((i) => i.status === "pending")
                  .reduce((s, i) => s + dueOf(i), 0);
                return (
                  <div key={g.date || "no-date"}>
                    <div className="mb-2 flex items-center justify-between border-b border-petflow-line pb-1">
                      <span className="text-xs font-extrabold text-petflow-chocolate">
                        {isIssuedSort ? "🧾" : "📅"}{" "}
                        {g.date ? formatThaiDateShort(g.date) : "ไม่ระบุวัน"} ·{" "}
                        {g.bills.length} บิล
                      </span>
                      <span className="text-[11px] font-bold text-brown-soft">
                        {dayTotal.toLocaleString()} ฿
                        {dayDue > 0 ? ` · ค้าง ${dayDue.toLocaleString()}` : ""}
                      </span>
                    </div>
                    <div className="space-y-3">{g.bills.map(renderBill)}</div>
                  </div>
                );
              })}
            </div>
          );
        }

        if (list.length === 0) {
          return (
            <p className="py-6 text-center text-xs text-brown-soft">ไม่พบบิล</p>
          );
        }
        return <div className="space-y-3">{list.map(renderBill)}</div>;
      })()}
    </div>
  );
}
