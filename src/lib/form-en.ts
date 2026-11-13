import type { GroomField } from "./groom-form";

/**
 * คำถามฟอร์มก่อนอาบน้ำ / ก่อนเข้าพัก / ประวัติน้อง เป็นภาษาอังกฤษ (ลูกค้าที่เลือก EN ในแอป)
 *
 * ลำดับที่ใช้: ชื่อภาษาอังกฤษที่ร้านพิมพ์เอง (labelEn) → คำแปลของคำถามค่าเริ่มต้นของระบบ (ตารางด้านล่าง)
 * → ข้อความเดิมของร้าน (ร้านแก้คำถามเป็นภาษาไทยเองแต่ไม่ได้ใส่ภาษาอังกฤษ)
 * ตารางเทียบด้วยข้อความไทยที่ตัดอีโมจินำหน้าออก — อีโมจิของตัวเลือกจึงคงไว้ตามเดิม (หน้าแมว/หน้าคนของร้านหมา)
 * คำตอบยังเก็บเป็น key เหมือนเดิม ร้านเห็นคำตอบเป็นภาษาไทยตามปกติ
 */
const EN: Record<string, string> = {
  // ── โรคติดต่อ/เชื้อราตอนนี้ (CONTAGIOUS_FIELD — ถามใหม่ทุกนัด)
  "ตอนนี้น้องมีโรคติดต่อ โรคผิวหนัง หรือเชื้อราไหมคะ (เลือกได้หลายข้อ)":
    "Does your pet currently have any contagious illness, skin condition or fungal infection? (pick any)",
  "โรคผิวหนัง / ผื่น คัน": "Skin condition / rash / itching",
  "เชื้อรา / กลาก": "Fungus / ringworm",
  "ขี้เรื้อน / ไรขน": "Mange / mites",
  "มีเห็บหมัดอยู่ตอนนี้": "Has fleas or ticks right now",
  "หวัด ไอ จาม มีน้ำมูก": "Cold, cough, sneezing, runny nose",
  "ท้องเสีย / อาเจียน": "Diarrhoea / vomiting",
  "กำลังรักษาโรคอยู่": "Currently under treatment",
  // ── ฟอร์มก่อนอาบน้ำ (groom-form.ts)
  "เคยอาบน้ำที่อื่นมาก่อนไหมคะ หรือว่าครั้งแรก": "Has your pet been bathed elsewhere before, or is this the first time?",
  "เคยอาบที่อื่นแล้ว": "Yes, bathed elsewhere before",
  "ครั้งแรก": "First time",
  "นิสัยตอนถูกจับ/อาบน้ำ (เลือกได้หลายข้อ)": "Behaviour when handled/bathed (pick any)",
  "ปกติ": "Normal",
  "ขี้เล่น": "Playful",
  "ขี้อ้อน": "Affectionate",
  "เครียดง่าย": "Stresses easily",
  "ใจดี ให้จับง่าย": "Gentle, easy to handle",
  "ขี้กลัว/ตกใจง่าย": "Fearful / startles easily",
  "ดิ้น": "Wriggles",
  "ดุ/กัด/ข่วน": "Aggressive / bites / scratches",
  "ไม่ชอบคนแปลกหน้า": "Dislikes strangers",
  "อื่นๆ": "Other",
  "สุขภาพ (เลือกได้หลายข้อ)": "Health (pick any)",
  "แข็งแรงดี": "Healthy",
  "โรคผิวหนัง": "Skin disease",
  "ลมชัก/ชัก": "Seizures",
  "สูงอายุ": "Senior",
  "น้องเป็นโรคหัวใจไหมคะ": "Does your pet have heart disease?",
  "ไม่เป็น": "No",
  "เป็นโรคหัวใจ": "Yes, heart disease",
  "ไม่เคยตรวจ": "Never been checked",
  "เคยใช้วิธีเป่าขนแบบไหนคะ (เลือกได้หลายข้อ)": "How has your pet been dried before? (pick any)",
  "ไดร์เป่าขน": "Hand dryer",
  "ตู้เป่าขน": "Drying cabinet",
  "อยากให้เราดูแล/ระวังเป็นพิเศษเรื่องอะไรไหมคะ": "Anything we should take special care with?",
  "เช่น ไม่ชอบเป่าขนแรง, กลัวเสียงดัง": "e.g. dislikes strong dryers, scared of loud noises",

  // ── ฟอร์มก่อนเข้าพัก (stay-form.ts) — แมว
  "ปกติน้องกินอาหารอะไรคะ (ยี่ห้อ / เม็ด / เปียก) — รบกวนเตรียมอาหารมาเองนะคะ":
    "What does your pet usually eat? (brand / dry / wet) — please bring their own food",
  "เช่น Royal Canin เม็ด + อาหารเปียกมื้อเย็น": "e.g. Royal Canin dry + wet food for dinner",
  "กินวันละกี่มื้อ มื้อละประมาณเท่าไหร่คะ": "How many meals a day, and about how much each?",
  "เช่น 2 มื้อ เช้า-เย็น มื้อละ 1/4 ถ้วย": "e.g. 2 meals, morning and evening, 1/4 cup each",
  "ขนมที่ให้ได้ / ห้ามให้ (ถ้ามี)": "Treats allowed / not allowed (if any)",
  "เช่น ให้ขนมได้วันละ 1 ชิ้น": "e.g. 1 treat a day is fine",
  "น้องชอบอะไรคะ (ของเล่น / ให้อุ้ม / ที่นอนแบบไหน)": "What does your pet like? (toys / being held / type of bed)",
  "เช่น ชอบเล่นลูกบอล ชอบนอนในที่มืดๆ": "e.g. loves playing with balls, likes sleeping somewhere dark",
  "น้องไม่ชอบหรือกลัวอะไรคะ": "Anything your pet dislikes or is scared of?",
  "เช่น ไม่ชอบให้จับท้อง กลัวเสียงดัง": "e.g. doesn't like belly touches, scared of loud noises",
  "อยู่กับน้องตัวอื่นได้ไหมคะ": "Can your pet be around other animals?",
  "เข้ากับตัวอื่นได้": "Gets along with others",
  "ชอบอยู่ตัวเดียว": "Prefers being alone",
  "ไม่แน่ใจ": "Not sure",
  "ทรายที่ใช้ / การขับถ่ายที่ควรรู้": "Litter used / toilet habits we should know",
  "เช่น ทรายเต้าหู้ ขับถ่ายปกติ": "e.g. tofu litter, normal toilet habits",
  "โรคประจำตัว / ยาที่ต้องกิน (ถ้าไม่มีเว้นว่างได้)": "Health conditions / medication (leave blank if none)",
  "โรคประจำตัว / ยาที่ต้องกิน": "Health conditions / medication",
  "เช่น กินยาโรคไต เช้า-เย็น หลังอาหาร": "e.g. kidney medicine morning and evening after food",
  "อยากให้ดูแลอะไรเป็นพิเศษไหมคะ": "Anything you'd like us to take special care of?",
  "เช่น ขอรูปอัปเดตทุกเย็น ช่วยแปรงขนให้หน่อย": "e.g. photo updates every evening, please brush their coat",
  "ทรายที่ใช้ (แมว) / การขับถ่าย (หมา)": "Litter used (cats) / toilet habits (dogs)",
  "เช่น ทรายเต้าหู้ · หรือ ขับถ่ายแผ่นรองฉี่": "e.g. tofu litter · or uses pee pads",

  // ── ฟอร์มหมา (stay-form.ts DOG_FORM)
  "นิสัยน้อง (เลือกได้หลายข้อ)": "Your pet's personality (pick any)",
  "เป็นมิตร ให้จับง่าย": "Friendly, easy to handle",
  "ขี้เล่น ซน": "Playful, mischievous",
  "ขี้กลัว ตกใจง่าย": "Fearful, startles easily",
  "ตื่นคนแปลกหน้า": "Nervous with strangers",
  "ดิ้นเวลาโดนจับ": "Wriggles when held",
  "หวง/อาจงับ": "Possessive / may nip",
  "ไม่ถูกกับหมาตัวอื่น": "Doesn't get along with other dogs",
  "มีอะไรต้องระวังเป็นพิเศษไหมคะ": "Anything we should be careful about?",
  "ไม่ชอบให้จับเท้า": "Dislikes having paws touched",
  "ไม่ชอบตัดเล็บ": "Dislikes nail trims",
  "ไม่ชอบให้จับหู": "Dislikes having ears touched",
  "กลัวไดร์/เสียงดัง": "Scared of dryers / loud noises",
  "ผิวแพ้ง่าย": "Sensitive skin",
  "ขา/ข้อไม่ดี อุ้มเบาๆ": "Weak legs/joints, lift gently",
  "สูงอายุ เหนื่อยง่าย": "Senior, tires easily",
  "ไม่มี": "None",
  "อยากบอกอะไรเพิ่มไหมคะ": "Anything else you'd like to tell us?",
  "เช่น ชอบลูกบอล ไม่ชอบให้จับหาง": "e.g. loves balls, doesn't like tail touches",
  "กำจัดเห็บหมัดแบบไหนคะ": "How do you treat fleas and ticks?",
  "หยด": "Spot-on drops",
  "ทานยา": "Oral medicine",
  "ฉีดยา": "Injection",
  "ไม่ได้ทำ / ไม่แน่ใจ": "Not treated / not sure",
  "ให้ยาเห็บหมัดครั้งล่าสุดเมื่อไหร่คะ": "When was the last flea/tick treatment?",
  "เช่น 15 ต.ค. 2569 · ถ้าไม่ได้ทำพิมพ์ว่า ไม่ได้ทำ": "e.g. 15 Oct 2026 · type \"not treated\" if none",
  "อาหาร ให้เวลาไหน อย่างไรบ้าง — รบกวนเตรียมอาหารมาเองนะคะ": "Food: what, when and how much — please bring their own food",
  "เช่น เม็ด Royal Canin เช้า 8 โมง เย็น 6 โมง มื้อละ 1 ถ้วย": "e.g. Royal Canin dry food, 8 am and 6 pm, 1 cup each",
  "การทานยา (หากมี)": "Medication (if any)",
  "การทานยา": "Medication",
  "เช่น ยาโรคหัวใจ 1/2 เม็ด หลังอาหารเช้า": "e.g. half a heart pill after breakfast",
  "เข้าสังคมกับน้องตัวอื่นได้ไหมคะ": "Can your pet socialise with other animals?",
  "วิ่งสนามหญ้าได้ไหมคะ": "Can your pet run on the grass?",
  "วิ่งได้": "Yes",
  "ไม่ให้วิ่ง": "No",
  "การดูแลเพิ่มเติม (request) — บอกได้เหมือนเลี้ยงที่บ้าน ทางร้านจะดูแลตามนี้ให้ได้มากที่สุด อาจปรับเล็กน้อยตามขอบเขตค่ะ":
    "Extra care requests — tell us your routine at home and we'll follow it as closely as we can",
  "เช่น ก่อนนอนชอบให้เปิดเพลงเบาๆ ขอรูปอัปเดตทุกเย็น": "e.g. likes soft music at bedtime, photo updates every evening",
};

/** ท้ายคำถามที่ระบบเติม/ตัดเอง (ข้อที่ไม่มีข้ามได้ ฯลฯ) — แปลแยกจากตัวคำถาม */
const SUFFIXES: [string, string][] = [
  [" (ไม่มีข้ามได้)", " (skip if none)"],
  [" (ไม่มีกด ✅ ไม่มี)", " (tap ✅ None if none)"],
  [" (ถ้าไม่มีเว้นว่างได้)", " (leave blank if none)"],
  [" (หากมี)", " (if any)"],
  [" (ถ้ามี)", " (if any)"],
];

const LEAD_RE = /^([^\p{L}\p{N}]*)(.*)$/u;

/** แปลข้อความค่าเริ่มต้นของระบบ — ไม่รู้จัก = คืน undefined */
export function formTextEn(th: string | undefined): string | undefined {
  if (!th) return undefined;
  const [, lead, body] = LEAD_RE.exec(th.trim()) || ["", "", th];
  const direct = EN[body.trim()];
  if (direct) return lead + direct;
  for (const [s, e] of SUFFIXES) {
    if (body.endsWith(s.trim()) || body.endsWith(s)) {
      const core = EN[body.slice(0, body.length - s.trim().length).trim()];
      if (core) return lead + core + e;
    }
  }
  return undefined;
}

/** คำถามฟอร์มตามภาษาที่ลูกค้าเลือก — ภาษาไทยคืนตามเดิม */
export function localizeFields(fields: GroomField[], locale: "th" | "en"): GroomField[] {
  if (locale !== "en") return fields;
  return fields.map((f) => ({
    ...f,
    label: f.labelEn?.trim() || formTextEn(f.label) || f.label,
    placeholder: f.placeholderEn?.trim() || formTextEn(f.placeholder) || f.placeholder,
    options: f.options.map((o) => ({ ...o, label: o.labelEn?.trim() || formTextEn(o.label) || o.label })),
  }));
}
