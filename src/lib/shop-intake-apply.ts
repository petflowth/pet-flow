import type { RoomType } from "./business";
import type { BoardingRuleBlock, PointsRewardConfig, SiteConfig } from "./config-types";
import type { LinePromo } from "./line-discount";
import type { GroomProgram, GroomSize } from "./grooming-prices";
import { featureLabel, isFeatureOn, type FeatureKey } from "./features";
import { petKindFromIntake, petKindOf, withDefaultBreeds } from "./pet-kind";

/**
 * แปลงคำตอบแบบสอบถามเจ้าของร้าน (public/shop-questions.html) เป็นการตั้งค่าร้าน (SiteConfig)
 *
 * คำตอบเก็บเป็น { a, other, note } ตามหน้าแบบสอบถาม:
 * - a[id] = คำตอบข้อนั้น (ข้อความ หรือ array ถ้าเลือกได้หลายข้อ)
 * - a["id~ตัวเลือก"] = คำถามต่อของตัวเลือกนั้น · a["rooms.0.price"] = ช่องในข้อที่ถามซ้ำ/ตาราง
 * - other[id] = ข้อความที่พิมพ์ในช่อง "อื่นๆ"
 * ข้อไหนไม่ได้ตอบ = ไม่แตะค่าเดิมของร้าน · ข้อที่ระบบยังตั้งให้ไม่ได้ อยู่ใน manualItems
 * ชื่อตัวเลือกต้องตรงกับในไฟล์ html — แก้ตัวเลือกที่นั่นแล้วต้องแก้ตรงนี้ด้วย
 */

export type IntakeAnswers = {
  a?: Record<string, unknown>;
  other?: Record<string, string>;
  note?: Record<string, string>;
};

export type IntakeChange = {
  key: string;
  label: string;
  before: string;
  after: string;
};

type Draft = IntakeChange & { patch: (cfg: SiteConfig) => Partial<SiteConfig> };

const OTHER = "อื่นๆ";
const PETS_BOTH = "ทั้งหมาและแมว";
const WEEKDAYS: Record<string, number> = { อาทิตย์: 0, จันทร์: 1, อังคาร: 2, พุธ: 3, พฤหัส: 4, ศุกร์: 5, เสาร์: 6 };
const WEEKDAY_NAME = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const GROOM_KEYS: GroomSize[] = ["kitten", "m", "l"];

/** สีประจำร้านจากข้อ "สีประจำร้านที่ชอบ" — โทนเดียวกับชุดสีในหน้าตั้งค่า แล้วค่อยปรับละเอียดต่อได้ */
const COLOR_PRESETS: Record<string, Omit<NonNullable<SiteConfig["branding"]>, "logoUrl">> = {
  เขียว: { primary: "#2f8a77", accent: "#bfe5da", heading: "#1f4a41", background: "#f2faf7", surface: "#ffffff", text: "#24312e" },
  "ฟ้า/น้ำเงิน": { primary: "#2f6fb5", accent: "#cfe2f6", heading: "#1d3f66", background: "#f3f8fd", surface: "#ffffff", text: "#23303d" },
  ชมพู: { primary: "#d0628f", accent: "#f6c6d9", heading: "#7a2e4f", background: "#fdf4f8", surface: "#ffffff", text: "#3a2a31" },
  ส้ม: { primary: "#e07a2f", accent: "#fbd9bd", heading: "#7a3d12", background: "#fff7f0", surface: "#ffffff", text: "#3a2c22" },
  น้ำตาล: { primary: "#8a5a3b", accent: "#ead7c6", heading: "#4a2f1f", background: "#faf5f0", surface: "#ffffff", text: "#33281f" },
  ม่วง: { primary: "#7a55b8", accent: "#ddd0f2", heading: "#40286b", background: "#f8f5fd", surface: "#ffffff", text: "#2f2a3a" },
  เหลือง: { primary: "#c9971a", accent: "#f7e6a8", heading: "#5e4608", background: "#fffbef", surface: "#ffffff", text: "#353020" },
};

function reader(ans: IntakeAnswers) {
  const a = ans.a || {};
  const other = ans.other || {};
  const pets = String(a.pets || "");
  const petWord = pets === "แมว" ? "แมว" : pets === PETS_BOTH ? "หมา/แมว" : "หมา";
  const T = (s: string) => s.replace(/\{p\}/g, petWord);
  // พิมพ์ "แ" เป็น "เ" สองตัว (เเ) บ่อยมาก — ทำให้เหมือนกันก่อน ไม่งั้นหาคำว่า "แต้ม"/"แมว" ไม่เจอ
  const raw = (k: string) => String(a[k] ?? "").trim().replace(/เเ/g, "แ");
  /** ข้อเลือก 1 ข้อ — เลือก "อื่นๆ" = เอาข้อความที่พิมพ์ */
  const one = (id: string) => {
    const v = raw(id);
    return v === OTHER ? String(other[id] || "").trim() : v;
  };
  /** ข้อเลือกหลายข้อ — "อื่นๆ" แตกเป็นรายการตามจุลภาค/บรรทัด ต่อท้าย (ลำดับเดียวกับแถวตารางราคาในแบบสอบถาม) */
  const many = (id: string): string[] | null => {
    const v = a[id];
    if (!Array.isArray(v)) return null;
    const out = v.filter((x) => x !== OTHER).map(String);
    if (v.includes(OTHER)) out.push(...splitList(String(other[id] || "")));
    return out;
  };
  const fol = (id: string, opt: string) => raw(`${id}~${opt}`);
  const note = ans.note || {};
  return { a, pets, T, raw, one, many, fol, note };
}

function splitList(s: string): string[] {
  return s
    .split(/[,\n、]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** ตัวเลขตัวแรกในข้อความ เช่น "500 บาท" → 500 · "1,200" → 1200 */
function firstNum(s: string): number | null {
  const m = s.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

const show = (v: unknown): string => {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "boolean") return v ? "เปิด" : "ปิด";
  return String(v);
};

/** แยก "เลขบัญชี และชื่อบัญชี" ที่พิมพ์รวมกัน — ตัวเลข/ขีดคือเลขบัญชี ที่เหลือคือชื่อ */
function splitAccount(s: string): { number: string; name: string } {
  const m = s.match(/\d[\d\s-]{5,}\d/);
  if (!m) return { number: "", name: s.trim() };
  const name = (s.slice(0, m.index) + " " + s.slice((m.index || 0) + m[0].length))
    .replace(/(ชื่อบัญชี|เลขบัญชี|บัญชี)\s*[:：]?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { number: m[0].replace(/\s+/g, "").trim(), name };
}

function slugId(prefix: string, label: string, i: number) {
  const ascii = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${prefix}-${ascii || i + 1}`;
}

function buildDrafts(ans: IntakeAnswers, cfg: SiteConfig): Draft[] {
  const r = reader(ans);
  const out: Draft[] = [];
  const add = (d: Draft) => {
    if (d.before !== d.after) out.push(d);
  };
  const biz = (key: keyof SiteConfig["business"], label: string, value: string) => {
    if (!value) return;
    add({
      key: `business.${key}`,
      label,
      before: show(cfg.business[key]),
      after: value,
      patch: () => ({ business: { [key]: value } as unknown as SiteConfig["business"] }),
    });
  };

  // ── ข้อมูลร้าน ──
  biz("name", "ชื่อร้าน", r.raw("shopName"));
  const petKind = petKindFromIntake(r.pets);
  const KIND_LABEL = { cat: "แมว", dog: "หมา", both: "ทั้งหมาและแมว" } as const;
  if (petKind)
    add({
      key: "business.petKind",
      label: "ร้านดูแลน้องอะไร (คำและสายพันธุ์ในแอป)",
      before: KIND_LABEL[petKindOf(cfg)],
      after: KIND_LABEL[petKind],
      patch: () => ({ business: { petKind } as SiteConfig["business"] }),
    });
  const tagline = r.raw("tagline");
  if (tagline)
    add({
      key: "business.tagline",
      label: "คำโปรยใต้ชื่อร้าน",
      before: show(cfg.business.tagline?.th),
      after: tagline,
      patch: (c) => ({ business: { tagline: { ...c.business.tagline, th: tagline } } as SiteConfig["business"] }),
    });
  const phones = splitList(r.raw("phone").replace(/\s*\/\s*/g, ","));
  if (phones.length)
    add({
      key: "business.phones",
      label: "เบอร์โทรร้าน",
      before: show(cfg.business.phones),
      after: show(phones),
      patch: () => ({ business: { phones } as SiteConfig["business"] }),
    });
  biz("lineOa", "LINE OA", r.raw("lineOa"));
  const address = r.raw("address");
  if (address)
    add({
      key: "business.location",
      label: "ที่อยู่ร้าน",
      before: show(cfg.business.location?.th),
      after: address,
      patch: (c) => ({ business: { location: { ...c.business.location, th: address } } as SiteConfig["business"] }),
    });
  biz("maps", "ลิงก์ Google Maps", r.raw("maps"));
  biz("reviewUrl", "ลิงก์รีวิวร้าน", r.raw("reviewUrl"));
  biz("reviewButtonText", "คำบนปุ่มชวนรีวิว", r.T(r.one("reviewBtn")));
  biz("facebook", "Facebook", r.raw("facebook"));

  const walkin = r.raw("walkin");
  if (walkin) {
    const only = walkin === "ต้องจองล่วงหน้าเท่านั้น";
    const note = only ? r.fol("walkin", walkin) : "";
    add({
      key: "business.byAppointmentOnly",
      label: "รับเฉพาะลูกค้าที่จองล่วงหน้า",
      before: show(Boolean(cfg.business.byAppointmentOnly)) + (cfg.business.byAppointmentNote?.th ? ` (${cfg.business.byAppointmentNote.th})` : ""),
      after: show(only) + (note ? ` (${note})` : ""),
      patch: (c) => ({
        business: {
          byAppointmentOnly: only,
          ...(note ? { byAppointmentNote: { th: note, en: c.business.byAppointmentNote?.en || "" } } : {}),
        } as SiteConfig["business"],
      }),
    });
  }

  const color = r.raw("color");
  if (COLOR_PRESETS[color])
    add({
      key: "branding",
      label: "สีประจำร้าน",
      before: cfg.branding?.primary || "สีเริ่มต้น",
      after: `${color} (${COLOR_PRESETS[color].primary})`,
      patch: (c) => ({ branding: { ...c.branding, ...COLOR_PRESETS[color] } }),
    });

  // ── วันและเวลา ──
  const closed = r.many("closedDays");
  if (closed?.length) {
    const days = closed.includes("ไม่มีวันหยุด")
      ? []
      : closed.map((d) => WEEKDAYS[d]).filter((d): d is number => d !== undefined).sort();
    add({
      key: "closedWeekdays",
      label: "วันหยุดประจำสัปดาห์",
      before: show((cfg.closedWeekdays || []).map((d) => WEEKDAY_NAME[d])),
      after: days.length ? days.map((d) => WEEKDAY_NAME[d]).join(", ") : "ไม่มีวันหยุด",
      patch: () => ({ closedWeekdays: days }),
    });
  }

  // ── การรับเงิน ──
  const bank = r.one("bank");
  if (bank)
    add({
      key: "payment.bankName",
      label: "ธนาคาร",
      before: show(cfg.payment.bankName),
      after: bank,
      patch: () => ({ payment: { bankName: bank } as SiteConfig["payment"] }),
    });
  const acc = splitAccount(r.raw("account"));
  if (acc.number)
    add({
      key: "payment.accountNumber",
      label: "เลขบัญชี",
      before: show(cfg.payment.accountNumber),
      after: acc.number,
      patch: () => ({ payment: { accountNumber: acc.number } as SiteConfig["payment"] }),
    });
  if (acc.name)
    add({
      key: "payment.accountName",
      label: "ชื่อบัญชี",
      before: show(cfg.payment.accountName),
      after: acc.name,
      patch: () => ({ payment: { accountName: acc.name } as SiteConfig["payment"] }),
    });
  const pp = r.raw("promptpay").replace(/\D/g, "");
  if (pp.length === 10 || pp.length === 13)
    add({
      key: "payment.promptpayId",
      label: "พร้อมเพย์",
      before: show(cfg.payment.promptpayId),
      after: pp,
      patch: () => ({ payment: { promptpayId: pp } as SiteConfig["payment"] }),
    });

  const deposit = r.many("deposit");
  if (deposit?.length) {
    // มัดจำตอบได้ทั้งบาท ("500 บาท") และ % ("50 %") — แยกเก็บคนละช่อง ห้องพัก/อาบน้ำตั้งต่างหน่วยกันได้
    const amt = (opt: string) => {
      if (!deposit.includes(opt)) return { baht: 0, pct: 0 };
      const f = r.fol("deposit", opt);
      const n = firstNum(f) || 0;
      return /%|เปอร์เซ็น/.test(f) ? { baht: 0, pct: Math.min(100, n) } : { baht: n, pct: 0 };
    };
    const room = amt("เก็บมัดจำห้องพัก");
    const groom = amt("เก็บมัดจำคิวอาบน้ำ");
    const enabled = room.baht + room.pct + groom.baht + groom.pct > 0;
    const cur = cfg.bookingDeposit || {};
    const one = (baht?: number, pct?: number) => (pct ? `${pct}%` : `${baht || 0} บาท`);
    add({
      key: "bookingDeposit",
      label: "มัดจำตอนลูกค้าจอง",
      before: cur.enabled
        ? `ห้องพัก ${one(cur.roomAmount, cur.roomPercent)} · อาบน้ำ ${one(cur.groomAmount, cur.groomPercent)}`
        : "ไม่เก็บ",
      after: enabled ? `ห้องพัก ${one(room.baht, room.pct)} · อาบน้ำ ${one(groom.baht, groom.pct)}` : "ไม่เก็บ",
      patch: () => ({
        bookingDeposit: {
          enabled,
          roomAmount: room.baht,
          groomAmount: groom.baht,
          roomPercent: room.pct,
          groomPercent: groom.pct,
        },
      }),
    });
  }

  const tax = r.raw("tax");
  if (tax && tax !== "ใบเสร็จธรรมดาพอ") {
    const vat = tax.startsWith("จด VAT");
    const f = r.fol("tax", tax);
    const taxId = (f.match(/\d[\d\s-]{11,}\d/)?.[0] || "").replace(/\D/g, "");
    const branch = f.match(/สำนักงานใหญ่|สาขา\s*\d+/)?.[0] || "";
    // ชื่อตามทะเบียน = ข้อความก่อนเลขผู้เสียภาษี (หลังเลขมักเป็นที่อยู่/เบอร์โทร)
    const idAt = f.search(/\d[\d\s-]{11,}\d/);
    const legal = (idAt >= 0 ? f.slice(0, idAt) : f)
      .replace(/เลข(ประจำตัว)?ผู้เสียภาษี(อากร)?\s*[:：]?/g, "")
      .replace(/\(?\s*(สำนักงานใหญ่|สาขา\s*\d+)\s*\)?/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (taxId.length === 13)
      add({
        key: "business.taxId",
        label: "เลขผู้เสียภาษี",
        before: show(cfg.business.taxId),
        after: taxId,
        patch: () => ({ business: { taxId } as SiteConfig["business"] }),
      });
    if (legal) biz("legalName", "ชื่อตามทะเบียน", legal);
    if (branch) biz("taxBranch", "สาขาตามทะเบียน", branch);
    if (vat)
      add({
        key: "business.vatRegistered",
        label: "จด VAT (ออกใบกำกับภาษี)",
        before: show(Boolean(cfg.business.vatRegistered)),
        after: show(true),
        patch: () => ({ business: { vatRegistered: true } as SiteConfig["business"] }),
      });
  }

  // ── ห้องพัก ──
  const roomCount = Math.min(10, firstNum(r.one("roomTypes")) || 0);
  if (roomCount > 0) {
    const amenities = (r.many("inRoom") || []).map(r.T);
    const rooms: RoomType[] = [];
    for (let i = 0; i < roomCount; i++) {
      const f = (k: string) => r.raw(`rooms.${i}.${k}`);
      const name = f("name");
      const price = firstNum(f("price"));
      if (!name && price == null) continue;
      // ห้องแบบที่ i เดิมของร้าน — คง id/รูป/สี ไว้ การจองเดิมจะยังชี้ห้องเดิม · ที่เหลือตั้งใหม่จากคำตอบทั้งหมด
      const base = cfg.rooms[i];
      const num = (k: string) => {
        const n = firstNum(f(k));
        return n == null ? undefined : n;
      };
      const dims = f("size");
      const note = f("note");
      rooms.push({
        id: base?.id || slugId("room", name, i),
        name: name || `ห้องแบบที่ ${i + 1}`,
        size: "S",
        image: base?.image || "",
        ...(base?.color ? { color: base.color } : {}),
        price: price ?? 0,
        count: num("count") ?? 1,
        maxCats: num("maxDogs"),
        includedCats: num("included"),
        extraCatPrice: num("extra"),
        cats: { th: "", en: "" },
        extra: { th: "", en: "" },
        ...(dims ? { dimensions: { th: dims, en: "" } } : {}),
        ...(note ? { note: { th: note, en: "" } } : {}),
        amenities: { th: amenities, en: [] },
      });
    }
    if (rooms.length) {
      const desc = (list: RoomType[]) => list.map((x) => `${x.name} ${x.price} บาท${x.count ? ` × ${x.count} ห้อง` : ""}`).join(" / ");
      add({
        key: "rooms",
        label: "ห้องพัก (ชื่อ ราคา จำนวน)",
        before: desc(cfg.rooms) || "—",
        after: desc(rooms),
        patch: () => ({ rooms }),
      });
    }
  }

  // ── อาบน้ำตัดขน ──
  const sizeCount = Math.min(8, firstNum(r.one("sizeCount")) || 0);
  const services = (r.many("services") || []).filter(Boolean);
  // ตารางราคามี 3 ช่องไซส์ (kitten/m/l) — ร้านที่แบ่ง 3 ไซส์ใส่ตรงช่อง
  // ร้านที่แบ่งจำนวนอื่น (2, 4, 5, 6 …) ใส่ไซส์เป็น "แถว" ของโปรแกรม (ชื่อไซส์ + น้ำหนัก) ราคาเท่ากันทุกช่อง
  // ร้านไม่ต้องแก้อะไร: ตอนออกบิลเลือกแถวตามไซส์ได้ราคาถูกเลย
  const sizeName = (i: number) => {
    const n = r.raw(`sizes.${i}.name`);
    const kg = r.raw(`sizes.${i}.kg`);
    return [n || `ไซส์ ${i + 1}`, kg && `(${kg})`].filter(Boolean).join(" ");
  };
  if (sizeCount > 0 && services.length) {
    const asColumns = sizeCount === 3;
    const programs: GroomProgram[] = [];
    services.forEach((svc, ri) => {
      const prices = Array.from({ length: sizeCount }, (_, ci) => firstNum(r.raw(`prices.${ri}.${ci}`)));
      if (prices.every((p) => p == null)) return;
      const old = cfg.groomPricePrograms?.find((p) => p.name === svc);
      const breeds = asColumns
        ? [{ breed: "ทุกสายพันธุ์", prices: { kitten: prices[0] || 0, m: prices[1] || 0, l: prices[2] || 0 } }]
        : prices
            .map((p, ci) => ({ breed: sizeName(ci), prices: { kitten: p || 0, m: p || 0, l: p || 0 } }))
            .filter((b) => b.prices.m > 0);
      programs.push({
        id: old?.id || slugId("groom", svc, ri),
        name: r.T(svc),
        breeds,
        ...(old?.includes ? { includes: old.includes } : {}),
      });
    });
    const includes = (r.many("includes") || []).map(r.T);
    if (includes.length) programs.forEach((p) => (p.includes = includes));
    if (programs.length) {
      const desc = (list?: GroomProgram[]) =>
        (list || [])
          .map((p) => `${p.name} ${p.breeds.length > 1 ? p.breeds.map((b) => b.prices.m).join("/") : GROOM_KEYS.map((k) => p.breeds[0]?.prices[k] ?? 0).join("/")}`)
          .join(" · ");
      add({
        key: "groomPricePrograms",
        label: `ราคาอาบน้ำตัดขน (${sizeCount} ไซส์)`,
        before: desc(cfg.groomPricePrograms) || "ราคาตัวอย่างของระบบ",
        after: desc(programs),
        patch: () => ({ groomPricePrograms: programs }),
      });
    }
    if (asColumns) {
      const labels: Partial<Record<GroomSize, string>> = {};
      GROOM_KEYS.forEach((k, i) => {
        const n = r.raw(`sizes.${i}.name`);
        const kg = r.raw(`sizes.${i}.kg`);
        const l = [n, kg && `(${kg})`].filter(Boolean).join(" ");
        if (l) labels[k] = l;
      });
      if (Object.keys(labels).length)
        add({
          key: "groomSizeLabels",
          label: "ชื่อไซส์อาบน้ำ",
          before: show(GROOM_KEYS.map((k) => cfg.groomSizeLabels?.[k]).filter(Boolean)),
          after: show(GROOM_KEYS.map((k) => labels[k]).filter(Boolean)),
          patch: (c) => ({ groomSizeLabels: { ...c.groomSizeLabels, ...labels } }),
        });
    }
  }

  const addons = (r.many("addons") || [])
    .map((v) => ({ label: r.T(v), amount: firstNum(r.fol("addons", v)) || 0 }))
    .filter((x) => x.label);
  // ค่าบริการที่ตอบไว้ในข้ออื่น — เป็นปุ่มกดเพิ่มในหน้าคิดเงินเหมือนบริการเสริม ไม่ต้องจำ/พิมพ์เอง
  const extraFee = (id: string, opt: string, label: string) => {
    if (r.raw(id) !== opt) return;
    const f = r.fol(id, opt);
    const n = firstNum(f);
    addons.push({ label: n != null && /^\D*\d+(?:\.\d+)?\s*(บาท)?\s*$/.test(f) ? label : f ? `${label} (${f})` : label, amount: n || 0 });
  };
  extraFee("meds", "ป้อนให้ คิดเพิ่ม", "ป้อนยา ต่อวัน");
  extraFee("flea", "ร้านหยดให้ คิดเงินเพิ่ม", "หยดยาเห็บหมัด");
  extraFee("food", "ร้านมีให้ คิดเงินเพิ่ม", "อาหารระหว่างฝาก ต่อวัน");
  extraFee("earlyIn", "คิดเพิ่ม", "มาส่งก่อนเวลาเช็คอิน");
  extraFee("waitPickup", "รับช้าคิดเพิ่ม", "รับช้าหลังอาบน้ำเสร็จ");
  extraFee("lateFee", "คิดเพิ่มเป็นชั่วโมง", "รับช้ากว่าเวลาเช็คเอาท์ ต่อชั่วโมง");
  extraFee("lateFee", "คิดเพิ่มครึ่งวัน", "รับช้า คิดครึ่งวัน");
  // ช้าเกินเวลาที่ตั้ง = คิดเพิ่ม 1 คืน (ราคาตามห้อง — ไม่ใส่ยอดตายตัว ให้เลือกห้องเพิ่ม 1 คืนในบิล)
  if (addons.length)
    add({
      key: "options.servicePresets",
      label: "บริการเสริมที่คิดเงินแยก",
      before: show(cfg.options.servicePresets.map((x) => `${x.label} ${x.amount}`)),
      after: show(addons.map((x) => `${x.label} ${x.amount}`)),
      patch: () => ({ options: { servicePresets: addons } as SiteConfig["options"] }),
    });

  // ── โปรพักยาว / VIP — เป็นโปรลดเฉพาะรายการ กดเลือกตอนออกบิล ──
  const promos: LinePromo[] = [];
  for (const opt of r.many("longStay") || []) {
    const nights = firstNum(opt);
    const f = r.fol("longStay", opt);
    const n = firstNum(f);
    if (!nights || !n) continue;
    if (/บาท/.test(f) && !/%/.test(f)) continue; // ลดเป็นบาท — โปรรายการลดได้แค่ %
    promos.push({ id: `stay${nights}`, name: `พัก ${nights} คืนขึ้นไป ลด ${n}%`, percent: n, kinds: ["stay"], minNights: nights });
  }
  if (r.raw("vipPerk") === "ส่วนลด") {
    const n = firstNum(r.fol("vipPerk", "ส่วนลด"));
    if (n) promos.push({ id: "vip", name: `ลูกค้า VIP ลด ${n}%`, percent: n, kinds: ["stay", "daycare", "grooming", "service"] });
  }
  if (promos.length) {
    const keep = (cfg.linePromos || []).filter((p) => !promos.some((x) => x.id === p.id));
    add({
      key: "linePromos",
      label: "โปรพักยาว / ส่วนลด VIP (เลือกตอนออกบิล)",
      before: show((cfg.linePromos || []).map((p) => p.name)),
      after: show([...keep, ...promos].map((p) => p.name)),
      patch: (c) => ({ linePromos: [...(c.linePromos || []).filter((p) => !promos.some((x) => x.id === p.id)), ...promos] }),
    });
  }

  // แพ็กห้องรายเดือน ("30 คืน ลด 30%")
  if ((r.many("courses") || []).includes("แพ็กห้องพัก")) {
    const f = r.fol("courses", "แพ็กห้องพัก");
    const nights = f.match(/(\d+)\s*คืน/)?.[1];
    const pct = f.match(/(\d+)\s*%/)?.[1];
    if (nights && pct)
      add({
        key: "business.roomPlan",
        label: "แพ็กห้องพัก",
        before: `${cfg.business.roomPlanMinNights ?? 30} คืน ลด ${cfg.business.roomPlanDiscountPct ?? 30}%`,
        after: `${nights} คืน ลด ${pct}%`,
        patch: () => ({ business: { roomPlanMinNights: Number(nights), roomPlanDiscountPct: Number(pct) } as SiteConfig["business"] }),
      });
  }

  const freebies = r.many("freebies");
  if (freebies) {
    const list = freebies.filter((x) => x !== "ไม่มีของแถม");
    add({
      key: "options.freebies",
      label: "ของแถม",
      before: show(cfg.options.freebies),
      after: show(list),
      patch: () => ({ options: { freebies: list } as SiteConfig["options"] }),
    });
  }

  const breedText = [r.pets !== "แมว" ? r.raw("breeds") : "", r.pets !== "หมา" ? r.raw("catBreeds") : ""].join("\n");
  let breeds = splitList(breedText);
  // พิมพ์มาแบบเว้นวรรคบรรทัดเดียว (เช่น "ปอม ชิวาว่า พุดเดิ้ล") — แยกตามช่องว่าง
  if (breeds.length === 1 && !/[,\n]/.test(breedText.trim())) breeds = breeds[0].split(/\s+/).filter(Boolean);
  // คำตอบคือ "ที่มาบ่อย" → ไว้บนสุด แล้วเติมรายชื่อมาตรฐานต่อท้าย ไม่ให้ลูกค้าเลือกได้แค่ไม่กี่ตัว
  if (breeds.length) breeds = withDefaultBreeds(breeds, petKind ?? petKindOf(cfg));
  if (breeds.length)
    add({
      key: "options.catBreeds",
      label: "สายพันธุ์ (หน้าลงทะเบียนลูกค้า)",
      before: show(cfg.options.catBreeds),
      after: show(breeds),
      patch: () => ({ options: { catBreeds: breeds } as SiteConfig["options"] }),
    });

  const slots = r.many("slots");
  if (slots?.length) {
    const sorted = [...new Set(slots)].sort((x, y) => (firstNum(x) || 0) - (firstNum(y) || 0));
    add({
      key: "groomSlots",
      label: "รอบคิวอาบน้ำ",
      before: show(cfg.groomSlots),
      after: show(sorted),
      patch: () => ({ groomSlots: sorted }),
    });
  }
  const perSlot = firstNum(r.one("perSlot"));
  if (perSlot)
    add({
      key: "groomSlotDefaultCapacity",
      label: "รับพร้อมกันต่อรอบ",
      before: show(cfg.groomSlotDefaultCapacity),
      after: `${perSlot}`,
      patch: () => ({ groomSlotDefaultCapacity: perSlot }),
    });

  // ── แต้มและลูกค้าประจำ ──
  if (r.raw("points") === "มี") {
    const rate = firstNum(r.one("pointRate"));
    if (rate)
      add({
        key: "business.pointsRate",
        label: "ใช้จ่ายกี่บาทได้ 1 แต้ม",
        before: show(cfg.business.pointsRate),
        after: `${rate}`,
        patch: () => ({ business: { pointsRate: rate } as SiteConfig["business"] }),
      });
    const pc = r.raw("pointsCredit");
    if (pc) {
      const noPoints = pc !== "ได้แต้มตามปกติ";
      const topup = pc === "ไม่ได้แต้ม ให้แต้มตอนเติมเงินแทน";
      const desc = (n?: boolean, t?: boolean) => (!n ? "ได้แต้มตามปกติ" : t ? "ให้แต้มตอนเติมเงิน" : "ไม่ได้แต้ม");
      add({
        key: "business.memberCreditPoints",
        label: "จ่ายด้วยเครดิตสมาชิก ได้แต้มไหม",
        before: desc(cfg.business.noPointsOnMemberCredit, cfg.business.pointsOnMemberTopup),
        after: desc(noPoints, topup),
        patch: () => ({ business: { noPointsOnMemberCredit: noPoints, pointsOnMemberTopup: topup } as SiteConfig["business"] }),
      });
    }
  }

  const tr = cfg.crm.tierRules;
  const regular = r.raw("regular") === "ไม่ต้องแบ่ง" ? null : firstNum(r.one("regular"));
  const vip = r.raw("vip") === "ไม่ต้องมี VIP" ? null : firstNum(r.one("vip"));
  const vipSpendRaw = r.raw("vipSpend");
  const vipSpend = vipSpendRaw === "ไม่ใช้ยอดเงิน" ? 0 : firstNum(r.one("vipSpend"));
  if (regular || vip || vipSpend != null) {
    const next = {
      regularMinVisits: regular || tr.regularMinVisits,
      vipMinVisits: vip || tr.vipMinVisits,
      vipMinSpend: vipSpend ?? tr.vipMinSpend,
    };
    const desc = (t: typeof next) => `ประจำ ${t.regularMinVisits} ครั้ง · VIP ${t.vipMinVisits} ครั้ง หรือ ${t.vipMinSpend ? t.vipMinSpend.toLocaleString() + " บาท" : "ไม่ใช้ยอดเงิน"}`;
    add({
      key: "crm.tierRules",
      label: "เกณฑ์ลูกค้าประจำ / VIP",
      before: desc(tr),
      after: desc(next),
      patch: (c) => ({ crm: { ...c.crm, tierRules: next } }),
    });
  }
  const comeback = firstNum(r.one("comeback"));
  if (comeback)
    add({
      key: "crm.inactiveDays",
      label: "ลูกค้าหายไปกี่วันให้ทักชวนกลับ",
      before: show(cfg.crm.inactiveDays),
      after: `${comeback}`,
      patch: (c) => ({ crm: { ...c.crm, inactiveDays: comeback } }),
    });

  const referral = r.many("referral");
  if (referral?.length)
    add({
      key: "options.referralOptions",
      label: "ตัวเลือก รู้จักร้านจากไหน",
      before: show(cfg.options.referralOptions),
      after: show(referral),
      patch: () => ({ options: { referralOptions: referral } as SiteConfig["options"] }),
    });

  // แต้มแลกรางวัล — "5 แต้ม = ลด 100 บาท อาบน้ำ, 10 แต้ม = ลด 200 บาท"
  const rewardText = r.raw("rewards");
  if (r.raw("points") === "มี" && rewardText) {
    const rewards: PointsRewardConfig[] = [];
    const re = /(\d+)\s*แต้ม\s*[=:：]?\s*([^\d\n,/]*?\d[^\n,/]*?)(?=\s*\d+\s*แต้ม|[\n,/]|$)/g;
    for (const m of rewardText.matchAll(re)) {
      const points = Number(m[1]);
      const label = m[2].trim();
      if (!points || !label) continue;
      const baht = /บาท/.test(label) ? firstNum(label) : null;
      rewards.push({ id: `reward-${points}`, points, reward: { th: label, en: "" }, ...(baht ? { discount: baht } : {}) });
    }
    if (rewards.length)
      add({
        key: "pointsRewards",
        label: "แต้มแลกรางวัล",
        before: show(cfg.pointsRewards.map((x) => `${x.points} แต้ม = ${x.reward.th}`)),
        after: show(rewards.map((x) => `${x.points} แต้ม = ${x.reward.th}`)),
        patch: () => ({ pointsRewards: rewards }),
      });
  }

  if (r.raw("referBonus") === "มี") {
    const n = firstNum(r.fol("referBonus", "มี"));
    if (n && /บาท/.test(r.fol("referBonus", "มี")))
      add({
        key: "referral.amount",
        label: "ชวนเพื่อน ได้คูปองคนละ",
        before: `${cfg.referral?.amount ?? 100} บาท`,
        after: `${n} บาท`,
        patch: (c) => ({ referral: { ...c.referral, amount: n } }),
      });
  }

  // ── กฎการรับฝาก → หน้ากฎในแอป + ของที่ต้องเตรียม + เงื่อนไขมัดจำ ──
  const rules: string[] = [];
  const vacc = (r.many("vaccines") || []).filter((v) => v !== "ไม่บังคับ").map((v) => v.replace(/^(หมา|แมว):\s*/, ""));
  if (vacc.length) {
    const age = r.raw("vaccineAge");
    rules.push(`💉 วัคซีนที่ต้องฉีด: ${vacc.join(", ")}${age && age !== "ไม่กำหนด" ? ` (ฉีดมา${age})` : ""}`);
  }
  const proof = r.raw("vaccineProof");
  if (proof && proof !== "ไม่ต้อง") rules.push(`📖 ส่งรูปสมุดวัคซีน${proof === "ต้องส่งทุกครั้ง" ? "ทุกครั้งที่เข้าพัก" : "ครั้งแรก"}`);
  if (r.raw("flea") === "ต้องหยด") {
    const d = firstNum(r.fol("flea", "ต้องหยด"));
    rules.push(`🐛 หยดยาป้องกันเห็บหมัดมาก่อนเข้าพัก${d ? `ไม่เกิน ${d} วัน` : ""}`);
  }
  const notAccept = (r.many("notAccept") || []).filter((v) => v !== "รับหมด").map((v) => {
    const f = r.fol("notAccept", v);
    return r.T(v) + (f ? ` (${f})` : "");
  });
  if (notAccept.length) rules.push(`🚫 ไม่รับฝาก: ${notAccept.join(", ")}`);
  const bring = (r.many("bring") || []).map(r.T);
  if (bring.length) rules.push(`🧳 สิ่งที่ต้องเตรียมมา: ${bring.join(", ")}`);
  const food = r.raw("food");
  if (food) rules.push(`🍽️ อาหารระหว่างฝาก: ${food}${firstNum(r.fol("food", food)) ? ` ${firstNum(r.fol("food", food))} บาท/วัน` : ""}${r.note.food ? ` · ${r.note.food}` : ""}`);
  const cin = r.raw("checkin") || r.note.checkin;
  const cout = r.raw("checkout");
  if (cin || cout) rules.push(`🕐 เช็คอิน ${cin || "-"} · เช็คเอาท์ ${cout || "-"}`);
  const late = r.raw("lateFee");
  if (late) rules.push(`⏰ มารับช้ากว่าเวลาเช็คเอาท์: ${late}${r.fol("lateFee", late) ? ` (${r.fol("lateFee", late)})` : ""}`);
  const meds = r.raw("meds");
  if (meds) rules.push(`💊 ${meds}${firstNum(r.fol("meds", meds)) ? ` วันละ ${firstNum(r.fol("meds", meds))} บาท` : ""}`);
  const sick = r.raw("sick");
  const vet = r.raw("vetCost");
  if (sick || vet) rules.push(`🏥 น้องป่วยระหว่างฝาก: ${[sick, vet && `ค่ารักษา${vet}`].filter(Boolean).join(" · ")}`);
  const depTerms: string[] = [];
  const payFull = r.raw("payFull");
  if (payFull) depTerms.push(`ห้องพักชำระส่วนที่เหลือ${payFull.replace(/^จ่าย/, "")}${r.fol("payFull", payFull) ? ` ${r.fol("payFull", payFull)} วัน` : ""}`);
  const refund = r.raw("refund");
  if (refund) depTerms.push(`ยกเลิก: ${refund}${r.fol("refund", refund) ? ` (${r.fol("refund", refund)})` : ""}`);
  if (depTerms.length) rules.push(`💰 ${depTerms.join(" · ")}`);
  const extra = r.raw("rulesExtra");
  if (extra) rules.push(extra);
  if (rules.length) {
    const block: BoardingRuleBlock = { id: "intake-rules", text: rules.join("\n\n") };
    add({
      key: "boardingRules",
      label: "หน้ากฎการรับฝาก (ข้อความ)",
      before: (cfg.boardingRules || []).length ? `${cfg.boardingRules?.length} บล็อก` : "ยังไม่มี",
      after: `${rules.length} ข้อ จากคำตอบ`,
      // แทนเฉพาะบล็อกที่สร้างจากคำตอบ — รูป/ข้อความที่ร้านใส่เองยังอยู่
      patch: (c) => ({ boardingRules: [block, ...(c.boardingRules || []).filter((b) => b.id !== block.id)] }),
    });
  }
  if (bring.length)
    add({
      key: "messages.prestayPrepItems",
      label: "ของที่ต้องเตรียมก่อนเข้าพัก (การ์ด LINE)",
      before: show(cfg.messages.prestayPrepItems),
      after: show(bring),
      patch: () => ({ messages: { prestayPrepItems: bring } as unknown as SiteConfig["messages"] }),
    });
  if (depTerms.length)
    add({
      key: "messages.depositTerms",
      label: "เงื่อนไขมัดจำในการ์ด",
      before: show(cfg.messages.depositTerms),
      after: show(depTerms),
      patch: () => ({ messages: { depositTerms: depTerms } as unknown as SiteConfig["messages"] }),
    });

  // ── ข้อความ LINE อัตโนมัติ ──
  const auto = r.many("auto");
  const birthday = r.many("birthday");
  const sendTime = { "8 โมงเช้า": "08:00", เที่ยง: "12:00", "6 โมงเย็น": "18:00" }[r.raw("sendTime")];
  if (auto || birthday || sendTime) {
    const am = cfg.automation;
    const next = { ...am };
    const days = (opt: string, fallback: number) => {
      const n = firstNum(r.fol("auto", opt));
      return n == null ? fallback : n;
    };
    if (auto) {
      const on = (opt: string) => auto.includes(opt);
      next.confirmTomorrowEnabled = on("เตือนนัดล่วงหน้า");
      next.confirmDaysBefore = days("เตือนนัดล่วงหน้า", am.confirmDaysBefore);
      next.depositReminderEnabled = on("เตือนยอดค้างจ่ายก่อนเข้าพัก");
      next.depositReminderDays = days("เตือนยอดค้างจ่ายก่อนเข้าพัก", am.depositReminderDays);
      next.prestayReminderEnabled = on("ส่งของที่ต้องเตรียมก่อนเข้าพัก");
      next.prestayReminderDays = days("ส่งของที่ต้องเตรียมก่อนเข้าพัก", am.prestayReminderDays);
      next.checkoutReminderEnabled = on("เตือนวันเช็คเอาท์");
      next.checkoutReminderDays = days("เตือนวันเช็คเอาท์", am.checkoutReminderDays);
      next.reviewRequestEnabled = on("ขอรีวิวหลังกลับบ้าน");
      next.reviewRequestDaysAfter = days("ขอรีวิวหลังกลับบ้าน", am.reviewRequestDaysAfter);
    }
    if (birthday) {
      next.birthdayEnabled = birthday.some((x) => x.startsWith("ส่งอวยพร"));
      next.birthdayCouponEnabled = birthday.includes("แจกคูปองวันเกิด");
      const amt = firstNum(r.fol("birthday", "แจกคูปองวันเกิด"));
      if (amt) next.birthdayCouponAmount = amt;
    }
    if (sendTime) {
      next.checkinReminderTime = sendTime;
      next.checkoutReminderTime = sendTime;
    }
    const desc = (x: typeof am) =>
      [
        x.confirmTomorrowEnabled && `เตือนนัด ${x.confirmDaysBefore} วันก่อน`,
        x.depositReminderEnabled && `เตือนยอดค้าง ${x.depositReminderDays} วันก่อน`,
        x.prestayReminderEnabled && `ของที่ต้องเตรียม ${x.prestayReminderDays} วันก่อน`,
        x.checkoutReminderEnabled && `เตือนเช็คเอาท์ ${x.checkoutReminderDays} วันก่อน`,
        x.reviewRequestEnabled && `ขอรีวิว ${x.reviewRequestDaysAfter} วันหลัง`,
        x.birthdayEnabled && "อวยพรวันเกิด",
        x.birthdayCouponEnabled && `คูปองวันเกิด ${x.birthdayCouponAmount} บาท`,
        x.checkoutReminderTime && `ส่งตอน ${x.checkoutReminderTime}`,
      ]
        .filter(Boolean)
        .join(" · ") || "ปิดทั้งหมด";
    add({
      key: "automation",
      label: "ข้อความ LINE อัตโนมัติ",
      before: desc(am),
      after: desc(next),
      patch: () => ({ automation: next }),
    });
  }

  // ── เปิด/ปิดฟีเจอร์ — จากคำตอบที่บอกชัดว่าร้านใช้/ไม่ใช้ ──
  const feature = (key: FeatureKey, on: boolean | null) => {
    if (on === null) return;
    add({
      key: `features.${key}`,
      label: `ฟีเจอร์: ${featureLabel(key)}`,
      before: show(isFeatureOn(cfg, key)),
      after: show(on),
      patch: (c) => ({ features: { ...c.features, [key]: on } }),
    });
  };
  const yesNo = (id: string, no: string) => {
    const v = r.raw(id);
    return v ? v !== no : null;
  };
  feature("transport", yesNo("pickup", "ไม่มี"));
  feature("pos", yesNo("products", "ไม่ขาย"));
  feature("points", yesNo("points", "ไม่มี"));
  feature("payroll", yesNo("payroll", "ไม่ใช้"));
  const courses = r.many("courses");
  if (courses?.length) feature("packages", courses.some((c) => c !== "ยังไม่มี"));
  const booking = r.raw("booking");
  if (booking) feature("selfBooking", booking === "ลูกค้าจองเองในแอปได้");
  const pick = (id: string, map: Record<string, FeatureKey>) => {
    const got = r.many(id);
    if (!got?.length) return;
    for (const [opt, key] of Object.entries(map)) feature(key, got.includes(opt));
  };
  pick("custDocs", {
    "ฟอร์มข้อมูลน้องก่อนเข้าพัก": "stayInfo",
    "ฟอร์มประวัติน้องก่อนอาบน้ำ": "groomInfo",
    "รูปสมุดวัคซีน": "vaccine",
    "รูปบัตรประชาชนผู้ปกครอง": "idCard",
    "กดยอมรับกฎ + เซ็นชื่อ": "consent",
    "การ์ดแจ้งของที่ต้องเตรียมก่อนเข้าพัก": "prestay",
  });
  pick("money", { "บันทึกรายรับ-รายจ่าย": "finance", "สรุปเอกสารรายได้ / ภาษี": "tax" });

  // ── พนักงาน ──
  const care = r.many("care");
  if (care?.length) {
    const tasks = care.map((label, i) => ({ id: slugId("care", label, i), label: r.T(label) }));
    add({
      key: "careTasks",
      label: "งานดูแลน้องรายวัน",
      before: show((cfg.careTasks || []).map((t) => t.label)),
      after: show(tasks.map((t) => t.label)),
      patch: () => ({ careTasks: tasks }),
    });
  }

  return out;
}

/** สิ่งที่จะเปลี่ยนในตั้งค่าร้าน (เฉพาะข้อที่ตอบแล้วและต่างจากค่าเดิม) */
export function previewIntakeChanges(ans: IntakeAnswers, cfg: SiteConfig): IntakeChange[] {
  return buildDrafts(ans, cfg).map(({ key, label, before, after }) => ({ key, label, before, after }));
}

/** รวมการเปลี่ยนที่เลือกเป็น patch เดียว สำหรับ updateSiteConfig */
export function intakePatch(ans: IntakeAnswers, cfg: SiteConfig, keys: string[]): { patch: Partial<SiteConfig>; applied: IntakeChange[] } {
  const want = new Set(keys);
  const patch: Record<string, unknown> = {};
  const applied: IntakeChange[] = [];
  for (const d of buildDrafts(ans, cfg)) {
    if (!want.has(d.key)) continue;
    for (const [k, v] of Object.entries(d.patch(cfg))) {
      const prev = patch[k];
      patch[k] =
        prev && typeof prev === "object" && !Array.isArray(prev) && v && typeof v === "object" && !Array.isArray(v)
          ? { ...prev, ...v }
          : v;
    }
    applied.push({ key: d.key, label: d.label, before: d.before, after: d.after });
  }
  return { patch: patch as Partial<SiteConfig>, applied };
}

/** ข้อที่ระบบยังตั้งให้อัตโนมัติไม่ได้ — ต้องเข้าไปตั้งเองในหลังบ้านร้าน */
export function manualItems(ans: IntakeAnswers): string[] {
  const r = reader(ans);
  const items: string[] = [];
  const answered = (id: string) => {
    const v = r.a[id];
    return Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "";
  };
  const sizeCount = firstNum(r.one("sizeCount")) || 0;
  const deposits = r.many("deposit") || [];
  if (["เก็บมัดจำห้องพัก", "เก็บมัดจำคิวอาบน้ำ"].some((o) => deposits.includes(o) && firstNum(r.fol("deposit", o)) == null))
    items.push("มัดจำ (คำตอบไม่มีตัวเลข)");
  if (answered("roomTypes") && !(firstNum(r.one("roomTypes")) && r.raw("rooms.0.price"))) items.push("ห้องพักและราคาห้อง");
  if (answered("services") && !sizeCount) items.push("ราคาอาบน้ำตัดขน");
  const courses = (r.many("courses") || []).filter((c) => c !== "ยังไม่มี" && c !== "แพ็กห้องพัก");
  if (courses.length) items.push(`สร้างรายการขายในเมนูคอร์ส: ${courses.map((c) => `${c} (${r.fol("courses", c)})`).join(" · ")}`);
  if (r.raw("products") === "ขาย") items.push("สินค้าหน้าร้าน");
  if (r.raw("moveData") === "อยาก") items.push("ย้ายข้อมูลลูกค้าเก่า");
  if (answered("sheetLink")) items.push(`กรอกข้อมูลจากชีทของร้าน: ${r.raw("sheetLink")}`);
  if (answered("picsLink")) items.push(`ใส่รูปจากโฟลเดอร์: ${r.raw("picsLink")}`);
  if (r.raw("lineReady") === "ยังไม่มี") items.push("สร้าง LINE OA ให้ร้าน แล้วเชื่อม LINE");
  else if (r.raw("lineAdmin") === "เพิ่มแล้ว") items.push("เชื่อม LINE ของร้าน (Token, LIFF, Webhook)");
  else if (r.raw("lineReady")) items.push("เชื่อม LINE ของร้าน (ร้านยังไม่ได้เพิ่มทีมเป็นผู้ดูแล)");
  if (answered("rewards") && !/\d+\s*แต้ม/.test(r.raw("rewards"))) items.push("แต้มแลกรางวัล (อ่านคำตอบเป็นตัวเลขไม่ได้)");
  if (answered("staffCount") && r.raw("staffCount") !== "0") items.push("รหัสพนักงาน");
  if (answered("pics")) items.push(`ใส่รูปที่ร้านส่งมา: ${(r.many("pics") || []).join(", ")}`);
  if (answered("holidays")) items.push(`วันปิดยาว (${r.raw("holidays")})`);
  if (r.raw("peak") === "เพิ่ม") items.push(`ราคาเทศกาล: ${r.fol("peak", "เพิ่ม")} (ตั้งช่วงวันใน ตั้งค่า › ห้องพัก › Low/High season)`);
  if (r.raw("lateFee") === "คิดเพิ่ม 1 คืน") items.push(`มารับช้า (${r.fol("lateFee", "คิดเพิ่ม 1 คืน") || "ตามเวลาที่ร้านกำหนด"}) = เพิ่มห้อง 1 คืนในบิลเอง (เขียนไว้ในหน้ากฎแล้ว)`);
  return items;
}
