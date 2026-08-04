import type { SiteConfig } from "./config-types";
import { renderTemplate, DEFAULT_MESSAGES } from "./messages";
import { politeName, politeCat } from "./line";

export type BirthdayKind = "owner" | "cat";

export type BirthdayCandidate = {
  customerId: string;
  customerName: string;
  kind: BirthdayKind;
  catName?: string;
};

/**
 * ลูกค้าคนนี้ตรงวันเกิดวันนี้ไหม (mmdd = "MM-DD") — เจ้าของหรือแมวตัวไหน
 * ตรงกันทั้งคู่ (มักเป็นเพราะกรอกวันเกิดตัวเองใส่ช่องแมวไปด้วย) เลือกเจ้าของ —
 * ทักคนผิดเป็นแมวเสียหายกว่าอวยพรแมวช้าไปหนึ่งปี
 */
export function findBirthdayMatch(
  customer: {
    id: string;
    name: string;
    birthday?: string;
    cats: { name: string; birthday?: string }[];
  },
  mmdd: string
): BirthdayCandidate | null {
  if (customer.birthday && customer.birthday.slice(5) === mmdd) {
    return { customerId: customer.id, customerName: customer.name, kind: "owner" };
  }
  const cat = customer.cats.find((c) => c.birthday && c.birthday.slice(5) === mmdd);
  if (cat) {
    return {
      customerId: customer.id,
      customerName: customer.name,
      kind: "cat",
      catName: cat.name,
    };
  }
  return null;
}

/**
 * ข้อความอวยพร (ยังไม่ใส่บรรทัดคูปอง) — เรียกใหม่ทุกครั้งตอนจะส่งจริง ไม่ใช่ตอนคัดเข้าคิว
 * กันกรณีร้านแก้ชื่อลูกค้า/แก้แม่แบบข้อความระหว่างที่การ์ดรอตรวจอยู่
 */
export function buildBirthdayText(
  candidate: Pick<BirthdayCandidate, "kind" | "customerName" | "catName">,
  cfg: Pick<SiteConfig, "messages" | "business">
): string {
  if (candidate.kind === "owner") {
    return renderTemplate(
      cfg.messages.birthdayGreetingOwner || DEFAULT_MESSAGES.birthdayGreetingOwner,
      { shop: cfg.business.name, name: politeName(candidate.customerName) }
    );
  }
  return renderTemplate(cfg.messages.birthdayGreeting, {
    shop: cfg.business.name,
    name: politeName(candidate.customerName),
    cat: politeCat(candidate.catName || ""),
  });
}
