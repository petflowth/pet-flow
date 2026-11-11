import { BREED_OPTIONS } from "./cat-breeds";

/**
 * ร้านนี้ดูแลน้องอะไร — ตั้งจากแบบสอบถามตอนเปิดร้าน (ข้อ "ร้านรับดูแลน้องอะไรบ้าง") หรือหน้าตั้งค่า › ร้าน
 * ใช้เปลี่ยนคำในหน้าลูกค้า/หลังบ้าน (น้องแมว ↔ น้องหมา) และรายชื่อสายพันธุ์เริ่มต้น
 * ไม่ได้ตั้ง = แมว (ร้านเดิมทุกร้านเริ่มจากระบบร้านแมว)
 */
export type PetKind = "cat" | "dog" | "both";

/**
 * ชนิดของน้องแต่ละตัว (cats.species) — "cat" · "dog" หรือรหัสชนิดที่ร้านเพิ่มเอง (เช่น "rabbit", "sp-x8k2")
 * ร้านรับชนิดเดียวไม่ต้องเก็บ ถือว่าเป็นชนิดของร้าน
 */
export type PetSpecies = string;

/**
 * ชนิดสัตว์ที่ร้านรับ — ร้านตั้งเองได้ที่ ตั้งค่า › รายการ (options.petSpecies)
 * ไม่ได้ตั้ง = ตาม business.petKind (แมว / หมา / ทั้งหมาและแมว) เหมือนเดิม
 */
export type SpeciesDef = {
  /** รหัสที่เก็บใน cats.species — cat / dog / ตัวอักษรอังกฤษเล็ก ตัวเลข - _ */
  id: string;
  /** ชื่อไทย ใช้ต่อท้าย "น้อง" เช่น กระต่าย → "น้องกระต่าย" */
  name: string;
  emoji: string;
  /** ชื่ออังกฤษ (ไม่ใส่ก็ได้) */
  en?: string;
  /** สายพันธุ์ให้เลือกตอนสมัคร — หมา/แมวเว้นว่างได้ (ใช้รายชื่อสายพันธุ์หมา/แมวของร้านตามเดิม) */
  breeds?: string[];
};

type KindCfg = {
  business?: { petKind?: string };
  options?: { catBreeds?: string[]; petSpecies?: SpeciesDef[] };
} | null | undefined;

export const BUILTIN_SPECIES: Record<"cat" | "dog", SpeciesDef> = {
  cat: { id: "cat", name: "แมว", emoji: "🐱", en: "cat" },
  dog: { id: "dog", name: "หมา", emoji: "🐶", en: "dog" },
};

/** ชนิดที่กดเพิ่มได้เร็วในหน้าตั้งค่า — แค่ตัวช่วยกรอก ร้านแก้ชื่อ/อีโมจิ/สายพันธุ์ได้หมด */
export const SPECIES_SUGGESTIONS: SpeciesDef[] = [
  { id: "rabbit", name: "กระต่าย", emoji: "🐰", en: "rabbit", breeds: ["ฮอลแลนด์ ลอป (Holland Lop)", "เนเธอร์แลนด์ ดวาร์ฟ (Netherland Dwarf)", "ไลอ้อนเฮด (Lionhead)", "มินิเร็กซ์ (Mini Rex)", "เท็ดดี้แบร์ (Teddy Bear)", "พันธุ์ผสม (Mixed)"] },
  { id: "guinea-pig", name: "แกสบี้", emoji: "🐹", en: "guinea pig", breeds: ["ขนสั้น (American)", "แอบบิสซิเนียน (Abyssinian)", "เปรูเวียน (Peruvian)", "เท็ดดี้ (Teddy)", "สกินนี่ (Skinny)", "พันธุ์ผสม (Mixed)"] },
  { id: "hamster", name: "แฮมสเตอร์", emoji: "🐹", en: "hamster", breeds: ["ไจแอนท์ / ซีเรียน (Syrian)", "วินเทอร์ไวท์ (Winter White)", "แคมป์เบล (Campbell)", "โรโบรอฟสกี้ (Roborovski)"] },
  { id: "bird", name: "นก", emoji: "🦜", en: "bird" },
  { id: "hedgehog", name: "เม่นแคระ", emoji: "🦔", en: "hedgehog" },
  { id: "turtle", name: "เต่า", emoji: "🐢", en: "turtle" },
  { id: "ferret", name: "เฟอร์เร็ต", emoji: "🦦", en: "ferret" },
];

const SPECIES_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function normalizeSpecies(v: unknown): PetSpecies | undefined {
  return typeof v === "string" && SPECIES_ID.test(v) ? v : undefined;
}

/** รหัสใหม่สำหรับชนิดที่ร้านตั้งชื่อเอง */
export function newSpeciesId(taken: string[]): string {
  for (;;) {
    const id = `sp-${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.includes(id)) return id;
  }
}

/** ทำความสะอาดรายการที่ร้านบันทึก — ตัดรหัสผิด/ซ้ำ เติมชื่อ/อีโมจิของหมาแมวให้ถ้าเว้นว่าง */
export function cleanSpeciesList(list: unknown): SpeciesDef[] {
  if (!Array.isArray(list)) return [];
  const out: SpeciesDef[] = [];
  for (const raw of list as Partial<SpeciesDef>[]) {
    const id = normalizeSpecies(raw?.id);
    if (!id || out.some((x) => x.id === id)) continue;
    const base = BUILTIN_SPECIES[id as "cat" | "dog"];
    const name = String(raw?.name || "").trim() || base?.name || "";
    if (!name) continue;
    const breeds = Array.isArray(raw?.breeds) ? raw!.breeds.map((b) => String(b).trim()).filter(Boolean) : [];
    out.push({
      id,
      name,
      emoji: String(raw?.emoji || "").trim() || base?.emoji || "🐾",
      ...(String(raw?.en || "").trim() || base?.en ? { en: String(raw?.en || "").trim() || base!.en } : {}),
      ...(breeds.length ? { breeds } : {}),
    });
  }
  return out;
}

/** ชนิดสัตว์ทั้งหมดที่ร้านรับ (เรียงตามที่ร้านตั้ง) — ร้านที่ไม่เคยตั้ง = ตามแบบร้าน แมว / หมา / หมาและแมว */
export function speciesListOf(cfg?: KindCfg): SpeciesDef[] {
  const own = cleanSpeciesList(cfg?.options?.petSpecies);
  if (own.length) return own;
  const k = cfg?.business?.petKind;
  if (k === "dog") return [BUILTIN_SPECIES.dog];
  if (k === "both") return [BUILTIN_SPECIES.dog, BUILTIN_SPECIES.cat];
  return [BUILTIN_SPECIES.cat];
}

/** แบบร้านที่ได้จากรายการชนิด — แมวล้วน = cat · หมาล้วน = dog · อย่างอื่น (หลายชนิด/ชนิดที่ร้านเพิ่ม) = both */
export function petKindFromSpecies(list: SpeciesDef[]): PetKind {
  if (list.length === 1 && list[0].id === "cat") return "cat";
  if (list.length === 1 && list[0].id === "dog") return "dog";
  return "both";
}

/** ข้อมูลชนิดนี้ของร้าน — ชนิดที่ร้านลบออกไปแล้วแต่น้องเก่ายังเป็นชนิดนั้น: หมา/แมวใช้ค่าเริ่มต้น อย่างอื่น undefined */
export function speciesDef(cfg: KindCfg, species: string | undefined | null): SpeciesDef | undefined {
  if (!species) return undefined;
  return speciesListOf(cfg).find((s) => s.id === species) || BUILTIN_SPECIES[species as "cat" | "dog"];
}

/** ชื่อชนิดสั้นๆ ไว้โชว์ในสรุป เช่น "กระต่าย" · ไม่รู้ = "" */
export function speciesName(cfg: KindCfg, species: string | undefined | null): string {
  return speciesDef(cfg, species)?.name || "";
}

/**
 * ชนิดนี้ใช้ฟอร์ม/ค่าเริ่มต้นแบบไหน — หมา/แมวใช้ของตัวเอง · ชนิดที่ร้านเพิ่ม (กระต่าย ฯลฯ) ใช้แบบกลางๆ ("both")
 * ไม่รู้ชนิด = ตามแบบร้าน
 */
export function formKindOf(species: string | undefined | null, cfg?: KindCfg): PetKind {
  if (species === "cat" || species === "dog") return species;
  if (species) return "both";
  return petKindOf(cfg);
}

/** ค่าตัวเลือกในแบบสอบถาม (public/shop-questions.html) → ชนิดสัตว์ */
export function petKindFromIntake(pets: unknown): PetKind | null {
  if (pets === "หมา") return "dog";
  if (pets === "แมว") return "cat";
  if (pets === "ทั้งหมาและแมว") return "both";
  return null;
}

export function petKindOf(cfg?: KindCfg): PetKind {
  const own = cleanSpeciesList(cfg?.options?.petSpecies);
  if (own.length) return petKindFromSpecies(own);
  const k = cfg?.business?.petKind;
  return k === "dog" || k === "both" ? k : "cat";
}

export type PetWords = {
  /**
   * แมว · หมา · (ว่าง) — ใช้ต่อท้าย "น้อง" เช่น `น้อง${w.th}`
   * ร้านที่รับทั้งสองแบบเป็นค่าว่าง ได้คำกลางๆ ว่า "น้อง" ไม่ต้องเขียน "น้องหมา/แมว"
   */
  th: string;
  /** แมว · หมา · สัตว์เลี้ยง — ใช้ตอนคำนี้อยู่เดี่ยวๆ ไม่มี "น้อง" นำหน้า เช่น `${w.noun}ของฉัน` */
  noun: string;
  /** cat · dog · pet */
  en: string;
  /** cats · dogs · pets */
  enPlural: string;
  emoji: string;
};

const WORDS: Record<PetKind, PetWords> = {
  cat: { th: "แมว", noun: "แมว", en: "cat", enPlural: "cats", emoji: "🐱" },
  dog: { th: "หมา", noun: "หมา", en: "dog", enPlural: "dogs", emoji: "🐶" },
  both: { th: "", noun: "สัตว์เลี้ยง", en: "pet", enPlural: "pets", emoji: "🐾" },
};

function wordsOfDef(d: SpeciesDef): PetWords {
  const builtin = WORDS[d.id as "cat" | "dog"];
  const en = d.en || builtin?.en || "pet";
  return {
    th: d.name,
    noun: d.name,
    en,
    enPlural: builtin && en === builtin.en ? builtin.enPlural : `${en}s`,
    emoji: d.emoji || builtin?.emoji || "🐾",
  };
}

export function petWords(cfg?: KindCfg): PetWords {
  const own = cleanSpeciesList(cfg?.options?.petSpecies);
  if (!own.length) return WORDS[petKindOf(cfg)];
  // ร้านรับชนิดเดียว (เช่น กระต่ายล้วน) = คำของชนิดนั้น · หลายชนิด = คำกลางๆ
  return own.length === 1 ? wordsOfDef(own[0]) : WORDS.both;
}

/** คำของน้องตัวนั้น — รู้ชนิดแล้วใช้คำของชนิดนั้น (ร้านรับหลายชนิดก็ขึ้น "น้องหมา" / "น้องกระต่าย" ได้) */
export function speciesWords(species: PetSpecies | undefined, cfg?: KindCfg): PetWords {
  const d = speciesDef(cfg, species);
  if (d) return wordsOfDef(d);
  return species ? WORDS.both : petWords(cfg);
}

/** ร้านนี้มีเรื่องทรายแมวไหม — ร้านหมาล้วนไม่มีทราย ซ่อนช่องตั้งค่าและไม่ใส่ข้อความเตรียมทรายในการ์ด */
export function usesLitter(cfg?: KindCfg): boolean {
  return petKindOf(cfg) !== "dog";
}

/** ร้านนี้ต้องให้เลือกว่าน้องแต่ละตัวเป็นชนิดไหนไหม (เฉพาะร้านที่รับมากกว่าหนึ่งชนิด) */
export function asksSpecies(cfg?: KindCfg): boolean {
  return speciesListOf(cfg).length > 1;
}

/** รายชื่อสายพันธุ์หมาเริ่มต้น — ร้านแก้เองได้ในหน้าตั้งค่า (ชื่อเก็บใน options.catBreeds เหมือนเดิม) */
export const DOG_BREED_OPTIONS = [
  "หมาไทย / พันธุ์ผสม (Mixed)",
  "ปอมเมอเรเนียน (Pomeranian)",
  "ชิวาวา (Chihuahua)",
  "พุดเดิ้ล / ทอย พุดเดิ้ล (Poodle)",
  "ชิสุ (Shih Tzu)",
  "มอลทีส (Maltese)",
  "ยอร์คเชียร์ เทอร์เรีย (Yorkshire Terrier)",
  "ปั๊ก (Pug)",
  "เฟรนช์ บูลด็อก (French Bulldog)",
  "คอร์กี้ (Corgi)",
  "ชิบะ อินุ (Shiba Inu)",
  "บีเกิ้ล (Beagle)",
  "ดัชชุน (Dachshund)",
  "มินิเจอร์ ชเนาเซอร์ (Miniature Schnauzer)",
  "บิชอง ฟริเซ่ (Bichon Frise)",
  "โกลเด้น รีทรีฟเวอร์ (Golden Retriever)",
  "ลาบราดอร์ รีทรีฟเวอร์ (Labrador Retriever)",
  "ไซบีเรียน ฮัสกี้ (Siberian Husky)",
  "บางแก้ว (Bangkaew)",
  "ไทยหลังอาน (Thai Ridgeback)",
  "ไม่ทราบสายพันธุ์ (Unknown)",
];

const breedKey = (s: string) => s.toLowerCase().replace(/\s+/g, "");
/** ชื่อซ้อนกันนับเป็นตัวเดียว เช่น "ปอม" กับ "ปอมเมอเรเนียน (Pomeranian)" */
const sameBreed = (a: string, b: string) => {
  const x = breedKey(a);
  const y = breedKey(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};
const UNKNOWN_BREED = "ไม่ทราบสายพันธุ์ (Unknown)";

/** สายพันธุ์นี้เป็นของหมาหรือแมว — ดูจากรายชื่อเริ่มต้น / คำว่าหมา-แมวในชื่อ · บอกไม่ได้ = undefined */
export function speciesOfBreed(breed?: string | null): PetSpecies | undefined {
  const b = (breed || "").trim();
  if (!b || sameBreed(b, UNKNOWN_BREED)) return undefined;
  const saysDog = /หมา|สุนัข|\bdog\b/i.test(b);
  const saysCat = /แมว|\bcat\b/i.test(b);
  if (saysDog !== saysCat) return saysDog ? "dog" : "cat";
  // คำกลางๆ เช่น "พันธุ์ผสม" / "ไม่ทราบ" ใช้ได้ทั้งหมาและแมว
  if (/ผสม|mix|ไม่ทราบ|unknown|อื่น|other/i.test(b)) return undefined;
  const isDog = DOG_BREED_OPTIONS.some((d) => d !== UNKNOWN_BREED && sameBreed(b, d));
  const isCat = BREED_OPTIONS.some((d) => d !== UNKNOWN_BREED && sameBreed(b, d));
  if (isDog && !isCat) return "dog";
  if (isCat && !isDog) return "cat";
  return undefined;
}

/**
 * ชนิดของน้องตัวนี้ — ที่บันทึกไว้ก่อน · ร้านรับชนิดเดียว = ชนิดของร้าน
 * ร้านที่รับทั้งสองแบบแต่น้องตัวเก่ายังไม่ได้ระบุ → เดาจากสายพันธุ์ (เดาไม่ได้ = undefined)
 */
export function speciesOf(
  pet: { species?: string | null; breed?: string | null } | null | undefined,
  cfg?: KindCfg
): PetSpecies | undefined {
  const saved = normalizeSpecies(pet?.species);
  if (saved) return saved;
  const list = speciesListOf(cfg);
  if (list.length === 1) return list[0].id;
  // ชนิดที่ร้านเพิ่มเอง: สายพันธุ์อยู่ในรายชื่อของชนิดนั้นชนิดเดียว = ชนิดนั้น
  const breed = (pet?.breed || "").trim();
  if (breed) {
    const hits = list.filter((s) => s.id !== "cat" && s.id !== "dog" && s.breeds?.some((b) => sameBreed(b, breed)));
    if (hits.length === 1) return hits[0].id;
  }
  const guess = speciesOfBreed(pet?.breed);
  return guess && list.some((s) => s.id === guess) ? guess : undefined;
}

/** หมา/แมวที่ร้านรับ (ใช้เลือกรายชื่อสายพันธุ์หมา/แมวเริ่มต้น) — ไม่รับทั้งคู่ = null */
function builtinKind(cfg: KindCfg): PetKind | null {
  const ids = speciesListOf(cfg).map((s) => s.id);
  const cat = ids.includes("cat");
  const dog = ids.includes("dog");
  if (cat && dog) return "both";
  if (dog) return "dog";
  if (cat) return "cat";
  return null;
}

function defaultBreeds(kind: PetKind): string[] {
  if (kind === "dog") return DOG_BREED_OPTIONS;
  if (kind === "both") return [...DOG_BREED_OPTIONS.slice(0, -1), ...BREED_OPTIONS];
  return BREED_OPTIONS;
}

/**
 * รายชื่อของร้าน (ไว้บนสุด) + เติมสายพันธุ์เริ่มต้นตามชนิดสัตว์ที่ยังไม่มี
 * แบบสอบถามถาม "สายพันธุ์ที่มาบ่อย" ร้านตอบมาไม่กี่ตัว (เช่น "ปอม") — ไม่ใช่ให้เหลือแค่นั้น
 * ตัวที่ชื่อซ้อนกัน (เช่น "ปอม" กับ "ปอมเมอเรเนียน (Pomeranian)") นับเป็นตัวเดียว ไม่เติมซ้ำ
 */
export function withDefaultBreeds(shopBreeds: string[], kind: PetKind): string[] {
  const mine = shopBreeds.map((s) => s.trim()).filter(Boolean);
  const extra = defaultBreeds(kind).filter((d) => !mine.some((m) => sameBreed(m, d)));
  return [...mine, ...extra];
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * สายพันธุ์ที่ให้ลูกค้าเลือก — ร้านตั้งเองไว้ใช้ของร้าน (ร้านหมาเติมพันธุ์ยอดนิยมต่อท้ายให้) · ยังไม่ได้ตั้ง (หรือยังเป็นรายชื่อแมวเริ่มต้น)
 * ใช้รายชื่อเริ่มต้นตามชนิดสัตว์ของร้าน ร้านหมาจะได้ไม่เห็นสายพันธุ์แมว
 */
export function breedOptionsFor(cfg?: KindCfg): string[] {
  const own = cleanSpeciesList(cfg?.options?.petSpecies);
  const builtin = catDogBreeds(cfg);
  if (!own.length) return builtin;
  const extra = own.flatMap((s) => (s.id === "cat" || s.id === "dog" ? [] : s.breeds || []));
  return [...builtin, ...extra.filter((b, i) => !builtin.includes(b) && extra.indexOf(b) === i)];
}

/** รายชื่อสายพันธุ์หมา/แมวของร้าน (options.catBreeds) — ร้านที่ไม่รับหมาหรือแมวเลย = ว่าง */
function catDogBreeds(cfg?: KindCfg): string[] {
  const own = cleanSpeciesList(cfg?.options?.petSpecies);
  const kind = own.length ? builtinKind(cfg) : petKindOf(cfg);
  if (!kind) return [];
  const saved = cfg?.options?.catBreeds || [];
  if (!saved.length || (kind !== "cat" && sameList(saved, BREED_OPTIONS))) return defaultBreeds(kind);
  // ร้านหมา/ร้านที่รับทั้งสองแบบ: รายชื่อของร้านมักมาจากแบบสอบถาม ("สายพันธุ์ที่มาบ่อย" เช่น "ปอม")
  // เติมสายพันธุ์ยอดนิยมให้ครบเสมอ ไม่ต้องรอร้านไปกดเติมเอง · ร้านแมวเดิมใช้รายชื่อที่ร้านตั้งตามเดิม
  if (kind !== "cat") return withDefaultBreeds(saved, kind);
  return saved;
}

/**
 * สายพันธุ์ให้เลือกสำหรับน้องตัวที่รู้ชนิดแล้ว — ร้านที่รับทั้งสองแบบใช้รายชื่อเดียวกันของร้าน
 * แต่ซ่อนพันธุ์ของอีกชนิด (เลือก "หมา" จะไม่เห็นเปอร์เซีย) · ชื่อที่บอกไม่ได้ว่าเป็นของชนิดไหนโชว์ทั้งสองแบบ
 * ยังไม่เลือกชนิด / ร้านรับชนิดเดียว = รายชื่อเต็มของร้าน
 */
export function breedOptionsForSpecies(cfg: KindCfg, species: PetSpecies | undefined): string[] {
  const list = speciesListOf(cfg);
  if (!species && list.length === 1) species = list[0].id;
  if (!species) return breedOptionsFor(cfg);
  const def = speciesDef(cfg, species);
  if (def?.breeds?.length) return def.breeds;
  if (species !== "cat" && species !== "dog") return [UNKNOWN_BREED];
  const all = catDogBreeds(cfg);
  if (builtinKind(cfg) !== "both") return all;
  return all.filter((b) => {
    const s = speciesOfBreed(b);
    return !s || s === species;
  });
}
