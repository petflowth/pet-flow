/**
 * ตารางราคาอาบน้ำ/กรูมมิ่ง — เมนูตัวอย่าง (Landin'Elite)
 * เลือก โปรแกรม → พันธุ์ → ไซส์ แล้วได้ราคาเลย
 * TODO(config-driven): ย้ายไปแก้ในหน้าตั้งค่าได้ (ดู memory: prefer-config-driven-no-code-edits)
 */
export type GroomSize = "kitten" | "m" | "l";

export const GROOM_SIZES: { id: GroomSize; label: string }[] = [
  { id: "kitten", label: "ลูกแมว (≤2 กก.)" },
  { id: "m", label: "M (≤6 กก.)" },
  { id: "l", label: "L (6 กก.+)" },
];

export type GroomBreedPrice = {
  breed: string;
  prices: Record<GroomSize, number>;
};

export type GroomProgram = {
  id: string;
  name: string;
  breeds: GroomBreedPrice[];
};

export const GROOM_PROGRAMS: GroomProgram[] = [
  {
    id: "bath-dry",
    name: "อาบน้ำ – เป่าขน",
    breeds: [
      { breed: "แมวไทย", prices: { kitten: 400, m: 450, l: 550 } },
      { breed: "แมวพันธุ์ขนสั้น", prices: { kitten: 450, m: 500, l: 700 } },
      { breed: "แมวพันธุ์ขนยาว", prices: { kitten: 550, m: 650, l: 850 } },
      {
        breed: "แรคดอล/เมนคูน/ขนหนาฟู",
        prices: { kitten: 650, m: 850, l: 1050 },
      },
    ],
  },
  {
    id: "bath-degrease",
    name: "อาบน้ำ + ขจัดคราบมัน",
    breeds: [
      { breed: "แมวไทย", prices: { kitten: 500, m: 600, l: 700 } },
      { breed: "แมวพันธุ์ขนสั้น", prices: { kitten: 600, m: 750, l: 900 } },
      { breed: "แมวพันธุ์ขนยาว", prices: { kitten: 700, m: 850, l: 1050 } },
      {
        breed: "แรคดอล/เมนคูน/ขนหนาฟู",
        prices: { kitten: 800, m: 1050, l: 1250 },
      },
    ],
  },
  {
    id: "premium",
    name: "PetFlow Premium (แนะนำ)",
    breeds: [
      { breed: "แมวพันธุ์ขนสั้น", prices: { kitten: 700, m: 900, l: 1100 } },
      { breed: "แมวพันธุ์ขนยาว", prices: { kitten: 800, m: 1000, l: 1250 } },
      {
        breed: "แรคดอล/เมนคูน/ขนหนาฟู",
        prices: { kitten: 1000, m: 1200, l: 1450 },
      },
    ],
  },
  {
    id: "malaseb",
    name: "Malaseb (ยับยั้งเชื้อรา)",
    breeds: [
      { breed: "แมวพันธุ์ขนสั้น", prices: { kitten: 700, m: 900, l: 1100 } },
      { breed: "แมวพันธุ์ขนยาว", prices: { kitten: 800, m: 1000, l: 1250 } },
      {
        breed: "แรคดอล/เมนคูน/ขนหนาฟู",
        prices: { kitten: 1000, m: 1200, l: 1450 },
      },
    ],
  },
];

export function groomProgram(id: string) {
  return GROOM_PROGRAMS.find((p) => p.id === id);
}

export function groomSizeLabel(size: GroomSize) {
  return GROOM_SIZES.find((s) => s.id === size)?.label || "";
}

/** ราคาอาบน้ำจาก โปรแกรม+พันธุ์+ไซส์ (0 ถ้าไม่เจอ) */
export function groomPrice(
  programId: string,
  breed: string,
  size: GroomSize
): number {
  const prog = groomProgram(programId);
  const b = prog?.breeds.find((x) => x.breed === breed);
  return b ? b.prices[size] : 0;
}
