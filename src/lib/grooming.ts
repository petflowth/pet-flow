export type GroomSize = "kitten" | "m" | "l";

export const GROOM_SIZE_LABELS = {
  th: {
    kitten: "ลูกแมว (<2 กก.)",
    m: "M (<6 กก.)",
    l: "L (6 กก.↑)",
  },
  en: {
    kitten: "Kitten (<2 kg)",
    m: "M (<6 kg)",
    l: "L (6 kg+)",
  },
} as const;

export const GROOM_MENUS = {
  bath: {
    id: "bath",
    title: { th: "อาบน้ำ · เป่าขน", en: "Bath & blow-dry" },
    subtitle: {
      th: "แชมพู Landin'Elite เกรดพรีเมียม",
      en: "Landin'Elite premium shampoo",
    },
    poster: "",
    programs: [
      {
        id: "dry",
        name: { th: "อาบน้ำ – เป่าขน", en: "Bath & blow-dry" },
      },
      {
        id: "degrease",
        name: { th: "อาบน้ำ + ขจัดคราบมัน", en: "Bath + degreasing" },
        note: {
          th: "ช่วยขจัดความมันส่วนเกิน ขนนุ่มสลวย ไม่แห้งกร้าน บำรุงด้วย Shea butter & Almond oil",
          en: "Removes excess oil, keeps coat soft without drying skin — Shea butter & almond oil",
        },
      },
    ],
    rows: [
      {
        breed: { th: "แมวไทย", en: "Thai cat" },
        dry: { kitten: 400, m: 450, l: 550 },
        degrease: { kitten: 500, m: 600, l: 700 },
      },
      {
        breed: { th: "แมวพันธุ์ขนสั้น", en: "Short hair" },
        dry: { kitten: 450, m: 500, l: 700 },
        degrease: { kitten: 600, m: 750, l: 900 },
      },
      {
        breed: { th: "แมวพันธุ์ขนยาว", en: "Long hair" },
        dry: { kitten: 550, m: 650, l: 850 },
        degrease: { kitten: 700, m: 850, l: 1050 },
      },
      {
        breed: { th: "แรคดอล / เมนคูน (ขนหนาฟู)", en: "Ragdoll / Maine Coon" },
        dry: { kitten: 650, m: 850, l: 1050 },
        degrease: { kitten: 800, m: 1050, l: 1250 },
      },
    ],
  },
  advance: {
    id: "advance",
    title: { th: "Advance Grooming", en: "Advance Grooming" },
    subtitle: {
      th: "Landin'Elite · PetFlow Premium หรือ Malaseb",
      en: "Landin'Elite · PetFlow Premium or Malaseb",
    },
    poster: "",
    variants: [
      {
        id: "premium",
        name: { th: "PetFlow Premium", en: "PetFlow Premium" },
        badge: { th: "แนะนำ", en: "Recommended" },
        features: {
          th: [
            "มาสก์ขจัดความมัน",
            "ดีท็อกซ์",
            "ทรีทเมนต์เพิ่มวอลลุ่ม",
            "แชมพูเฉพาะสภาพขน",
            "สเปรย์บำรุง",
          ],
          en: [
            "Oil-removal mask",
            "Detox",
            "Volume treatment",
            "Custom shampoo",
            "Nourishing spray",
          ],
        },
      },
      {
        id: "malaseb",
        name: { th: "Malaseb ยับยั้งเชื้อรา", en: "Malaseb antifungal" },
        features: {
          th: [
            "มาสก์ขจัดความมัน",
            "รักษาอาการอักเสบจากแบคทีเรีย",
            "ลดอาการคัน",
            "กำจัดสปอร์เชื้อรา",
          ],
          en: [
            "Oil-removal mask",
            "Treats bacterial inflammation",
            "Reduces itching",
            "Eliminates fungal spores",
          ],
        },
      },
    ],
    rows: [
      {
        breed: { th: "แมวพันธุ์ขนสั้น", en: "Short hair" },
        kitten: 700,
        m: 900,
        l: 1100,
      },
      {
        breed: { th: "แมวพันธุ์ขนยาว", en: "Long hair" },
        kitten: 800,
        m: 1000,
        l: 1250,
      },
      {
        breed: { th: "แรคดอล / เมนคูน (ขนหนาฟู)", en: "Ragdoll / Maine Coon" },
        kitten: 1000,
        m: 1200,
        l: 1450,
      },
    ],
  },
} as const;

export const GROOM_SPECIALS = {
  th: [
    { name: "แก้สางขนพันแน่น", price: "100–500" },
    { name: "ขจัดคราบเหลืองฝังแน่น (เฉพาะจุด)", price: "200–500" },
    { name: "หยดยาป้องกันปรสิต NEXGARD COMBO", price: "360" },
  ],
  en: [
    { name: "Detangling matted fur", price: "100–500" },
    { name: "Deep stain removal (spot)", price: "200–500" },
    { name: "Parasite prevention NEXGARD COMBO", price: "360" },
  ],
} as const;

export const GROOM_NOTES = {
  th: [
    "ราคารวม ตัดเล็บ · เช็ดหู-ตา · ไถขนก้นและอุ้งเท้า",
    "บริการแบบ Private รับน้องแมวทีละบ้าน",
    "อาบน้ำแมวประกวด — สอบถามราคาเพิ่มเติม",
  ],
  en: [
    "Includes nail trim, ear/eye cleaning, paw & sanitary trim",
    "Private service — one household at a time",
    "Show cats — please inquire for pricing",
  ],
} as const;
