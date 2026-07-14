"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SERVICE_PRESETS, type ServicePreset } from "@/lib/service-presets";
import { CustomerSendButtons } from "@/components/CustomerSendButtons";
import { toast } from "@/components/Toast";
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
  cats: { name: string }[];
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
  items?: { label: string; amount: number; kind?: string }[];
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
};

type ItemKind = "grooming" | "room" | "service" | "custom" | "freebie";
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
};

function newGrooming(): Item {
  const prog = GROOM_PROGRAMS[0];
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

function computeLine(it: Item): { label: string; amount: number } {
  if (it.kind === "grooming") {
    const prog = groomProgram(it.program);
    return {
      label: `${prog?.name || "อาบน้ำ"} · ${it.breed} · ${groomSizeLabel(it.size)}`,
      amount: groomPrice(it.program, it.breed, it.size),
    };
  }
  if (it.kind === "room") {
    const n = Math.max(1, it.nights || 1);
    return {
      label: `${it.roomLabel || "ห้องพัก"} × ${n} คืน`,
      amount: (it.roomPrice || 0) * n,
    };
  }
  if (it.kind === "freebie") {
    return { label: `🎁 ${it.label || "ของแถม"} (ฟรี)`, amount: 0 };
  }
  return { label: it.label, amount: it.amount || 0 };
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
    { id: string; name: string; totalUses: number; usedUses: number }[]
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
  const [creating, setCreating] = useState(false);
  const [pay, setPay] = useState({ bankName: "", accountNumber: "", accountName: "" });
  const [shopName, setShopName] = useState("CatCha Hotel");
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
    pickBooking(bk);
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
  const manualDiscount = Math.max(0, Number(discount) || 0);
  const couponAmount = customerCoupons.find((c) => c.id === couponId)?.amount || 0;
  // คอร์ส: หัก 1 ครั้ง → คลุมยอดที่เหลือทั้งบิลให้เป็น 0 (จ่ายไปแล้วตอนซื้อคอร์ส)
  const packageCovers = packageId
    ? Math.max(0, subtotal - promoDiscount - manualDiscount - couponAmount)
    : 0;
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

  const pickBooking = async (bk: Booking) => {
    setBookingId(bk.id);
    setShowBookings(false);
    const cust = customers.find((c) => c.id === bk.customerId);
    if (cust) await pickCustomer(cust);
    else setSearch(bk.customerName);

    if (bk.service === "room") {
      // นัดเก็บ room เป็น id → จับคู่กับ id ก่อน แล้วค่อย fallback เป็นชื่อ
      const matched =
        rooms.find((r) => bk.room && r.id === bk.room) ||
        rooms.find((r) => bk.room && r.label.includes(bk.room));
      setItems([
        {
          ...newGrooming(),
          kind: "room",
          roomLabel: matched?.label || rooms[0]?.label || (bk.room ? `ห้อง ${bk.room}` : "ห้องพัก"),
          roomPrice: matched?.amount ?? rooms[0]?.amount ?? 0,
          nights: nightsBetween(bk.checkin, bk.checkout),
        },
      ]);
    } else {
      setItems([newGrooming()]);
    }
  };

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const changeKind = (idx: number, kind: ItemKind) => {
    let patch: Partial<Item> = { kind };
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

  const resetForm = () => {
    setItems([newGrooming()]);
    setDiscount("");
    setBillDeposit("");
    setBillDepPct(null);
    setBookingId(undefined);
    setEditingId(null);
  };

  const createBill = async () => {
    if (!selected) return toast("เลือกลูกค้าก่อน", "error");
    if (subtotal <= 0) return toast("ใส่รายการอย่างน้อย 1 อย่าง", "error");
    setCreating(true);
    const cat = selected.cats[0]?.name || "น้องแมว";
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
        customerId: selected.id,
        lineUserId: selected.lineUserId,
        customerName: selected.name,
        catName: cat,
        items: payloadItems,
        promoId: promoId || undefined,
        extraDiscount: (manualDiscount + couponAmount + packageCovers) || undefined,
        deposit: depositAmount || undefined,
        bookingId: bookingId || undefined,
        couponId: couponId || undefined,
        packageId: packageId || undefined,
      }),
    });
    const data = await res.json();
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
      (inv.items || []).map((it) => ({
        ...newGrooming(),
        kind: it.amount > 0 ? ("custom" as const) : ("freebie" as const),
        label: it.label.replace(/^🎁 /, "").replace(/ \(ฟรี\)$/, ""),
        amount: it.amount,
      }))
    );
    setBillDeposit(inv.deposit ? String(inv.deposit) : "");
    setBillDepPct(null);
    setDiscount("");
    setEditingId(inv.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    const res = await fetch("/api/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "mark_paid", paymentMethod: method }),
    });
    if (res.ok) {
      toast("รับชำระแล้ว — ลงบัญชี + ส่งใบเสร็จ + แต้ม 🧾", "success");
      load();
    } else {
      const err = await res.json();
      toast(err.error === "insufficient_credit" ? "เครดิต Member ไม่พอ" : "ไม่สำเร็จ", "error");
    }
  };

  const sub = "w-full rounded-lg border border-catcha-line bg-paper px-3 py-2 text-sm";
  const field =
    "w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm";

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">💳 คิดเงิน</h1>

      <div className="mb-4 space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
        {/* ── ดึงจากนัด ── */}
        {bookings.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowBookings((v) => !v)}
              className="w-full rounded-catcha-sm border border-dashed border-latte/60 bg-latte/10 py-2 text-xs font-extrabold text-latte-deep"
            >
              📅 ดึงจากนัด ({bookings.length}) {showBookings ? "▲" : "▼"}
            </button>
            {showBookings && (
              <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {bookings.map((bk) => (
                  <li key={bk.id}>
                    <button
                      type="button"
                      onClick={() => pickBooking(bk)}
                      className="block w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-left text-xs"
                    >
                      <span className="font-bold text-brown">
                        {bk.service === "room" ? "🏠" : "🛁"} {bk.catName} · {bk.customerName}
                      </span>
                      <span className="block text-[10px] text-brown-faint">
                        {bk.service === "room"
                          ? `${bk.checkin || "?"} → ${bk.checkout || "?"}${bk.room ? ` · ${bk.room}` : ""}`
                          : bk.date || ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── ค้นหาลูกค้า ── */}
        <div>
          <p className="mb-1 text-xs font-bold text-brown-soft">ลูกค้า</p>
          {selected ? (
            <div className="rounded-catcha-sm border border-latte/50 bg-latte/10 px-3 py-2">
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
          ) : (
            <div className="relative">
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
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-catcha-sm border border-catcha-line bg-card shadow-catcha">
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
                  className="space-y-2 rounded-catcha-sm border border-catcha-line bg-paper/40 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={item.kind}
                      onChange={(e) => changeKind(i, e.target.value as ItemKind)}
                      className="min-w-0 flex-1 rounded-lg border border-catcha-line bg-card px-3 py-2 text-sm font-bold"
                    >
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
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          value={item.nights}
                          onChange={(e) =>
                            updateItem(i, { nights: Number(e.target.value) || 1 })
                          }
                          className="w-16 rounded-lg border border-catcha-line bg-paper px-2 py-2 text-center text-sm"
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

                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] text-brown-faint">
                      {line.label}
                    </span>
                    {item.kind === "service" || item.kind === "custom" ? (
                      <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={item.amount}
                        onChange={(e) =>
                          updateItem(i, { amount: Number(e.target.value) || 0 })
                        }
                        className="w-24 shrink-0 rounded-lg border border-catcha-line bg-paper px-3 py-1.5 text-right text-sm font-bold"
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

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, newGrooming()])}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-catcha-sm border-2 border-dashed border-latte/60 bg-latte/10 py-2.5 text-sm font-extrabold text-latte-deep transition active:scale-[.98]"
          >
            <span className="text-lg">➕</span> เพิ่มรายการ
            <span className="text-lg">🧾</span>
          </button>
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
            ส่วนลดเพิ่ม (บาท)
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              className={`mt-1 ${field}`}
            />
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
                🎫 คอร์สของลูกค้า (กดหัก 1 ครั้ง → บิลนี้ฟรี)
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
                    {pk.name} (เหลือ {pk.totalUses - pk.usedUses}/{pk.totalUses})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {autoPromoLabel && promoId && (
          <p className="rounded-catcha-sm bg-sage/15 px-3 py-1.5 text-[11px] font-bold text-ok">
            ⚡ ใช้โปร &quot;{autoPromoLabel}&quot; อัตโนมัติ (ลูกค้าคนนี้มีสิทธิ์)
          </p>
        )}

        {/* ── สรุปยอด ── */}
        <div className="space-y-1 rounded-catcha-sm bg-paper/60 px-3 py-2 text-sm">
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
          <div className="flex justify-between border-t border-catcha-line pt-1 text-base font-extrabold text-catcha-chocolate">
            <span>ยอดสุทธิ</span>
            <span>{total.toLocaleString()} ฿</span>
          </div>
          {/* มัดจำของบิลนี้ (ถ้ามี) — กด % หรือใส่เอง */}
          <div className="flex items-center justify-between gap-2 border-t border-catcha-line pt-1.5">
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
              className="w-24 rounded-lg border border-catcha-line bg-paper px-3 py-1.5 text-right text-sm"
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
                      ? "bg-honey text-catcha-chocolate"
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
        <div className="space-y-2 rounded-catcha-sm border border-catcha-line bg-card/80 p-2.5">
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
          className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-60"
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
            className="w-full rounded-catcha-sm bg-paper py-2 text-xs font-bold text-brown-soft"
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
                  ? "bg-honey/45 text-catcha-chocolate"
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
          className="min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-1.5 text-xs"
        />
        <select
          value={billSort}
          onChange={(e) => setBillSort(e.target.value as typeof billSort)}
          className="rounded-catcha-sm border border-catcha-line bg-paper px-2 py-1.5 text-xs font-bold text-brown-soft"
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
          <div key={inv.id} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="font-bold text-brown">
              {inv.catName} · {inv.customerName}
            </p>

            {sched ? (
              <p className="mt-1 text-xs font-bold text-latte-deep">{sched}</p>
            ) : null}

            {inv.items && inv.items.length > 0 && (
              <div className="mt-2 space-y-0.5 rounded-catcha-sm bg-paper/50 px-3 py-2 text-xs text-brown-soft">
                {inv.items.map((it, k) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{it.label}</span>
                    <span className="shrink-0">{it.amount.toLocaleString()} ฿</span>
                  </div>
                ))}
                {inv.discount ? (
                  <div className="flex justify-between border-t border-catcha-line pt-0.5 text-wait">
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
            <div className="mt-2 rounded-catcha-sm bg-paper/50 p-2">
              <CustomerSendButtons
                invoiceId={inv.id}
                bookingId={inv.bookingId || linkedBk?.id}
                customerId={inv.customerId}
                lineUserId={inv.lineUserId}
                service={
                  inv.items?.some((it) => /คืน|ห้อง/.test(it.label))
                    ? "room"
                    : "groom"
                }
                hasGroomService={inv.items?.some(
                  (it) =>
                    it.kind === "grooming" ||
                    /อาบน้ำ|กรูม|premium|malaseb/i.test(it.label)
                )}
                invoiceDeposit={inv.deposit ?? 0}
                onDone={load}
              />
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
                    className="rounded-full bg-honey/40 px-3 py-1.5 text-xs font-bold text-catcha-chocolate disabled:opacity-50"
                  >
                    💰 รับมัดจำแล้ว
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => markPaid(inv.id, "transfer")}
                  className="rounded-full bg-sage/20 px-3 py-1.5 text-xs font-bold text-ok"
                >
                  ✅ {(inv.deposit ?? 0) > 0 ? "รับเงินที่เหลือ (ปิดบิล)" : "รับเงินแล้ว"}
                </button>
                {customers.find((c) => c.id === inv.customerId)?.isMember && (
                  <button
                    type="button"
                    onClick={() => markPaid(inv.id, "member_credit")}
                    className="rounded-full bg-honey/30 px-3 py-1.5 text-xs font-bold"
                  >
                    💎 หัก Member
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => markPaid(inv.id, "cash")}
                  className="rounded-full bg-paper px-3 py-1.5 text-xs font-bold"
                >
                  💵 เงินสด
                </button>
                <button
                  type="button"
                  onClick={() => editInvoice(inv)}
                  className="rounded-full bg-latte/25 px-3 py-1.5 text-xs font-bold text-catcha-chocolate"
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
                    <div className="mb-2 flex items-center justify-between border-b border-catcha-line pb-1">
                      <span className="text-xs font-extrabold text-catcha-chocolate">
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
