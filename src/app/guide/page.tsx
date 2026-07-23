import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "คู่มือการใช้งาน | PetFlow",
  description: "คู่มือหลังบ้าน PetFlow ครบทุกเมนู สำหรับเจ้าของร้านและพนักงาน",
  robots: { index: false, follow: false },
};

type PageCard = {
  id: string;
  icon: string;
  title: string;
  path: string;
  ownerOnly?: boolean;
  items: string[];
};

const DAILY: PageCard[] = [
  {
    id: "dashboard",
    icon: "📊",
    title: "แดชบอร์ด",
    path: "/admin",
    items: [
      "ดูยอดขายวันนี้/เดือนนี้ คิวรอยืนยัน นัดวันนี้ รายรับ-รายจ่ายสุทธิ",
      "“งานที่ต้องทำ” — ลิงก์ตรงไปนัดรอยืนยัน บิลค้างชำระ ลูกค้าที่ยังไม่กดยอมรับเงื่อนไข",
      "ปุ่มลัดไปจองใหม่ / คิดเงิน / ลูกค้า / รายรับ-จ่าย",
    ],
  },
  {
    id: "schedule",
    icon: "🗓️",
    title: "ตารางนัด",
    path: "/admin/schedule",
    items: ["ปฏิทินแสดงนัดอาบน้ำ/เข้าพักทั้งหมด", "กดจองใหม่ต่อได้ทันทีจากหน้านี้"],
  },
  {
    id: "bookings-new",
    icon: "➕",
    title: "จองใหม่",
    path: "/admin/bookings/new",
    items: [
      "ค้นหาลูกค้าเดิม แล้วติ๊กแมวที่มา (เลือกได้ทั้งบ้าน) หรือเพิ่มชื่อเอง",
      "จองอาบน้ำ (วัน-เวลา-โปรแกรม) หรือจองห้องพัก (ห้อง-วันเข้า/ออก)",
      "ติ๊กของแถมฟรี เช่น CCTV, รับ-ส่ง",
      "จองเสร็จ กด “ออกบิลเลย” หรือส่งการ์ดแจ้งลูกค้าทาง LINE ต่อได้ทันที",
    ],
  },
  {
    id: "customers",
    icon: "👤",
    title: "ลูกค้า",
    path: "/admin/customers",
    items: [
      "ดู/แก้ข้อมูลลูกค้า ตั้งระดับลูกค้า (Tier), ดูประวัติแมว รูปภาพ นัดที่จะถึง",
      "เพิ่มแต้มพิเศษ, เติมเครดิต Member, ขายคอร์สรายคน",
      "ส่งข้อความตามลูกค้าที่หายไปทาง LINE",
      "ลบ/กู้คืนลูกค้า, ส่งออกเป็น Google Sheets",
    ],
  },
  {
    id: "billing",
    icon: "💳",
    title: "คิดเงิน",
    path: "/admin/billing",
    items: [
      "ดึงรายการจากนัดมาออกบิลอัตโนมัติ (บ้านเดียวกันหลายตัว → บิลใบเดียว)",
      "ใส่โปร ส่วนลด ใช้คูปอง/คอร์สหักบิล ตั้งยอดมัดจำ",
      "ส่งการ์ดสรุปยอด/แจ้งมัดจำ/แจ้งชำระเข้า LINE ลูกค้า",
      "รับชำระ → ลงบัญชีอัตโนมัติ + ออกใบเสร็จ + ให้แต้มสะสม",
    ],
  },
];

const MONEY: PageCard[] = [
  {
    id: "finance",
    icon: "📒",
    title: "รายรับ-รายจ่าย",
    path: "/admin/finance",
    items: [
      "บันทึกรายรับ/รายจ่าย พร้อมหมวดหมู่ + แนบรูปบิลเป็นหลักฐาน",
      "แก้ไข/ลบรายการ, พิมพ์ใบสำคัญรับ-จ่ายรายรายการ",
      "ส่งออกเข้า Google Sheets",
    ],
  },
  {
    id: "tax",
    icon: "📑",
    title: "เอกสารภาษี",
    path: "/admin/tax",
    items: [
      "สรุปรายรับ-รายจ่ายรายเดือน/รายปี แยกตามหมวด",
      "บัญชีรายวัน (ledger), พิมพ์/บันทึก PDF ส่งนักบัญชีได้เลย",
    ],
  },
  {
    id: "insights",
    icon: "📊",
    title: "สรุปข้อมูล",
    path: "/admin/insights",
    items: [
      "จำนวนลูกค้า/แมวทั้งหมด ยอดขายรวม จำนวน Member",
      "กราฟพันธุ์แมวยอดฮิต บริการขายดี ลูกค้าใช้จ่ายสูงสุด",
    ],
  },
];

const MARKETING: PageCard[] = [
  {
    id: "promos",
    icon: "✨",
    title: "โปร",
    path: "/admin/promos",
    items: [
      "สร้างโปรโมชั่น (ส่วนลด%/บาท/แต้ม) ตั้งเงื่อนไขและกลุ่มลูกค้า",
      "ติ๊กให้ขึ้นหน้าแรกแอปลูกค้าได้, ดูจำนวนคนกดใช้แล้ว",
      "ยิงเป็นการ์ด LINE ให้ลูกค้าตามกลุ่ม/พันธุ์/ระยะเวลาที่หายไป",
    ],
  },
  {
    id: "coupons",
    icon: "🎟️",
    title: "คูปอง",
    path: "/admin/coupons",
    items: [
      "ดูสถิติคูปองทั้งหมด + สถิติชวนเพื่อน + สถิติแต่ละโปร",
      "สร้างแคมเปญคูปองส่วนลด แล้วยิงให้ลูกค้าตามกลุ่ม",
      "เปิด/ปิดแคมเปญ, ยกเลิกคูปองรายใบ",
    ],
  },
  {
    id: "packages",
    icon: "🛍️",
    title: "ขายคอร์สในแอป",
    path: "/admin/packages",
    items: [
      "เลือกได้ 2 แบบ: คอร์ส (ชื่อ จำนวนครั้ง ราคา รูปปก) หรือ เติมเครดิต Member (ยอดจ่าย + ยอดเครดิตที่ได้รับ — ตั้งสูงกว่าราคาได้เพื่อแถมโบนัส)",
      "ยืนยันรับเงินออร์เดอร์ → ระบบเพิ่มคอร์ส/เติมเครดิตให้ลูกค้า + ลงรายรับ + แจ้งลูกค้าอัตโนมัติ",
    ],
  },
  {
    id: "cards",
    icon: "🎴",
    title: "ปรับแต่งการ์ด LINE",
    path: "/admin/cards",
    items: [
      "ปรับสี ขนาดตัวอักษร ข้อความ เปิด/ปิดส่วนประกอบของการ์ดแต่ละใบ พร้อมพรีวิวสด",
      "แก้ฟอร์มสอบถามประวัติก่อนอาบน้ำ และข้อตกลงเข้าพักที่ลูกค้าต้องเซ็น",
    ],
  },
  {
    id: "articles",
    icon: "📝",
    title: "บทความหน้าเว็บ",
    path: "/admin/articles",
    items: [
      "เขียน/แก้ไข/ลบบทความ อัปโหลดรูปปกเอง ไม่ต้องแก้โค้ด",
      "ตั้งฉบับร่างหรือเผยแพร่ทันที — ขึ้นที่หน้า /blog",
    ],
  },
];

const SYSTEM: PageCard[] = [
  {
    id: "staff",
    icon: "👥",
    title: "พนักงาน",
    path: "/admin/staff",
    ownerOnly: true,
    items: ["สร้างบัญชีพนักงาน (username/password) ติ๊กเลือกเมนูที่เห็นได้", "พัก/เปิดใช้งาน, เปลี่ยนรหัส, ลบบัญชี"],
  },
  {
    id: "settings",
    icon: "⚙️",
    title: "ตั้งค่า",
    path: "/admin/settings",
    items: [
      "ร้าน · บัญชีธนาคาร · ข้อความอัตโนมัติ · ระบบอัตโนมัติ",
      "ห้องพัก · รอบอาบน้ำ+คิว · รางวัลแลกแต้ม",
      "เงื่อนไขลูกค้าหาย/เลื่อนระดับ · ขั้นสูง (สำรองข้อมูล, config)",
    ],
  },
  {
    id: "trash",
    icon: "🗑️",
    title: "ถังขยะ",
    path: "/admin/trash",
    items: ["ดูบิลและลูกค้าที่ถูกลบ พร้อมปุ่มกู้คืน"],
  },
  {
    id: "setup",
    icon: "🚀",
    title: "ติดตั้ง",
    path: "/admin/setup",
    items: [
      "ตรวจสถานะฐานข้อมูล + อัปเดตอัตโนมัติ",
      "เชื่อมต่อ Google (ปฏิทิน/ชีต), LINE LIFF + Messaging API, Telegram Bot",
    ],
  },
];

const CUSTOMER_APP: { title: string; path: string; desc: string }[] = [
  { title: "หน้าแรก", path: "/app", desc: "ดูแต้ม/เครดิต/คอร์สคงเหลือ จองคิวเอง กระเป๋าคูปอง จัดการข้อมูลแมว" },
  {
    title: "จองคิวเอง",
    path: "/app/book",
    desc: "เลือกวัน-เวลาว่างเอง ไม่ต้องคุยกับพนักงาน — จองอาบน้ำเลือกได้หลายตัวพร้อมกัน แต่ละตัวกินคิวว่าง 1 ช่อง",
  },
  { title: "บริการ / ห้องพัก / อาบน้ำ", path: "/app/services, /rooms, /grooming", desc: "ดูราคาห้องพักและเมนูอาบน้ำ" },
  { title: "นัดของฉัน", path: "/app/bookings", desc: "ดูนัดที่จองไว้ กดยืนยันนัด เลือกเวลาเช็คอิน" },
  { title: "แต้มสะสม", path: "/app/points", desc: "ดูยอดแต้ม แลกของรางวัล ดูประวัติแต้ม" },
  { title: "คูปอง", path: "/app/coupons", desc: "ดูคูปองที่มี แชร์ลิงก์ชวนเพื่อนรับคูปอง ดูคอร์สที่ซื้อไว้" },
  { title: "โปรโมชั่น", path: "/app/promos", desc: "ดูโปรที่ร้านเปิดให้ใช้" },
  { title: "โปรไฟล์", path: "/app/profile, /register", desc: "กรอก/แก้ข้อมูลส่วนตัวและข้อมูลแมว" },
  { title: "ประวัติก่อนอาบน้ำ", path: "/app/groom-info", desc: "กรอกแบบฟอร์มประวัติน้องก่อนวันนัด" },
  { title: "ข้อตกลงเข้าพัก", path: "/app/consent", desc: "อ่านและเซ็นยอมรับเงื่อนไขก่อนเข้าพัก" },
  { title: "ชำระเงิน", path: "/app/pay/[id]", desc: "ดูบิลและแจ้งชำระ/แนบสลิป" },
  { title: "รับคูปอง", path: "/app/claim-coupon", desc: "กดรับคูปองจากลิงก์แคมเปญ" },
  { title: "ผูกบัญชี", path: "/app/link", desc: "ผูก LINE เข้ากับบัญชีลูกค้าเดิม (เช่น สลับเครื่อง)" },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 flex items-center gap-2 text-lg font-extrabold text-petflow-chocolate">
      {children}
    </h2>
  );
}

function Cards({ cards }: { cards: PageCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <article
          key={c.id}
          id={c.id}
          className="scroll-mt-6 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm"
        >
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-petflow-sm bg-honey/25 text-base">
              {c.icon}
            </span>
            <p className="text-sm font-extrabold text-brown">
              {c.title}
              {c.ownerOnly && (
                <span className="ml-2 rounded-full bg-honey/25 px-2 py-0.5 text-[9px] font-bold text-latte-deep">
                  เจ้าของร้านเท่านั้น
                </span>
              )}
            </p>
          </div>
          <p className="mb-2 pl-[46px] font-mono text-[10px] text-brown-faint">{c.path}</p>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-brown-soft">
            {c.items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-8">
      <Link href="/" className="text-xs font-bold text-brown-soft">
        ← หน้าแรก PetFlow
      </Link>

      <div className="mt-3 mb-6 border-b border-petflow-line pb-5">
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-honey/25 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-latte-deep">
          📘 คู่มือฉบับเจ้าของร้าน
        </span>
        <h1 className="text-2xl font-extrabold leading-tight text-petflow-chocolate sm:text-3xl">
          คู่มือการใช้งาน PetFlow
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-brown-soft">
          รวมทุกเมนูในหลังบ้าน — ใช้ทำอะไรได้บ้าง อยู่ตรงไหน และแต่ละหน้าเชื่อมกันยังไง
          สำหรับเจ้าของร้านและพนักงานที่เพิ่งเริ่มใช้ระบบ
        </p>
      </div>

      {/* เริ่มต้นใช้งาน */}
      <section className="mb-8">
        <SectionHeading>🔑 เข้าใช้งานครั้งแรก</SectionHeading>
        <p className="mb-3 text-xs text-brown-faint">ก่อนเริ่มใช้งานจริง ทำ 3 ขั้นตอนนี้ก่อน</p>
        <ol className="space-y-3">
          {[
            {
              t: "รับลิงก์ + username/password",
              d: "ผู้ดูแลระบบ (Super Admin) จะส่งลิงก์เข้าระบบพร้อม username และ password ของร้านคุณให้",
            },
            {
              t: "เข้าลิงก์เฉพาะร้านของคุณ",
              d: "ลิงก์จะมีรูปแบบ /s/<slug ร้านคุณ>/admin/login — เข้าครั้งแรกต้องผ่านลิงก์นี้เท่านั้น ระบบถึงจะจำได้ว่าเป็นร้านไหน ครั้งต่อไปเข้าแค่ /admin/login เฉยๆ ก็ได้",
            },
            {
              t: "อัปเดตฐานข้อมูล (ครั้งแรกเท่านั้น)",
              d: 'ระบบจะอัปเดตให้อัตโนมัติตอนล็อกอินครั้งแรก ถ้าเจอฟีเจอร์ไหนใช้ไม่ได้ ให้ไปกดเองที่ ตั้งค่า → ขั้นสูง → อัปเดตฐานข้อมูล',
            },
          ].map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-petflow-sm bg-honey/25 text-xs font-extrabold text-latte-deep">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-brown">{s.t}</p>
                <p className="text-xs leading-relaxed text-brown-soft">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <SectionHeading>📅 งานประจำวัน</SectionHeading>
        <p className="mb-3 text-xs text-brown-faint">เมนูที่ใช้ทุกวัน เรียงตามลำดับงานจริง</p>
        <Cards cards={DAILY} />
      </section>

      <section className="mb-8">
        <SectionHeading>💰 เงินและบัญชี</SectionHeading>
        <Cards cards={MONEY} />
      </section>

      <section className="mb-8">
        <SectionHeading>📣 การตลาด</SectionHeading>
        <Cards cards={MARKETING} />
      </section>

      <section className="mb-8">
        <SectionHeading>🛠️ จัดการระบบ</SectionHeading>
        <Cards cards={SYSTEM} />
      </section>

      {/* ลำดับงานที่เชื่อมกัน */}
      <section className="mb-8">
        <SectionHeading>🔗 ลำดับงานที่เชื่อมกัน</SectionHeading>
        <p className="mb-3 text-xs text-brown-faint">
          นัดที่สร้างขึ้น (จากแอดมินหรือลูกค้าจองเอง) จะไหลผ่านหน้าต่างๆ ตามลำดับนี้โดยอัตโนมัติ
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
          {["จองใหม่", "ตารางนัด", "คิดเงิน", "รายรับ-รายจ่าย", "เอกสารภาษี"].map((n, i, arr) => (
            <span key={n} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-petflow-line bg-paper px-3 py-1.5 text-xs font-bold text-brown">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-honey text-[9px] font-extrabold text-petflow-chocolate">
                  {i + 1}
                </span>
                {n}
              </span>
              {i < arr.length - 1 && <span className="text-brown-faint">→</span>}
            </span>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto rounded-petflow border border-petflow-line">
          <table className="w-full min-w-[520px] border-collapse text-xs">
            <thead>
              <tr className="bg-paper text-left text-brown-faint">
                <th className="px-3 py-2 font-bold">จุดเชื่อม</th>
                <th className="px-3 py-2 font-bold">สิ่งที่เกิดขึ้นอัตโนมัติ</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["บิล → แต้มสะสม/ระดับลูกค้า", "จ่ายบิลสำเร็จให้แต้มอัตโนมัติ และมีผลต่อการเลื่อนระดับ (ตั้งเกณฑ์ที่ตั้งค่า → ลูกค้า)"],
                ["คูปอง/โปร/คอร์ส → คิดเงิน", "สิ่งที่ลูกค้าได้รับจากหน้าคูปอง/โปร/ขายคอร์ส โผล่เป็นตัวเลือกหักส่วนลด/หักครั้งอัตโนมัติตอนออกบิล"],
                ["ปรับแต่งการ์ด LINE ↔ ตั้งค่า → ข้อความ", "ข้อความในการ์ดแก้ที่ตั้งค่า → ข้อความ ส่วนสีและส่วนประกอบแก้ที่หน้าปรับแต่งการ์ด"],
                ["แอปลูกค้า → แอดมิน", "การจองคิวเอง กรอกประวัติแมว เซ็นยอมรับเงื่อนไข ซื้อคอร์ส จะเข้ามาให้จัดการต่อที่ ตารางนัด/ลูกค้า/ขายคอร์สในแอป"],
              ].map(([a, b]) => (
                <tr key={a} className="border-t border-petflow-line">
                  <td className="px-3 py-2 font-bold text-brown">{a}</td>
                  <td className="px-3 py-2 text-brown-soft">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* แอปลูกค้า */}
      <section className="mb-8">
        <SectionHeading>📱 แอปลูกค้า (LINE Mini App)</SectionHeading>
        <p className="mb-3 text-xs text-brown-faint">
          สิ่งที่ลูกค้าทำได้เองในแอป ไม่ต้องทักแชทร้าน — ทุกอย่างที่ทำที่นี่จะโผล่ในหลังบ้านให้จัดการต่อ
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {CUSTOMER_APP.map((a) => (
            <div key={a.title} className="rounded-petflow-sm border border-petflow-line bg-card p-3">
              <p className="text-xs font-extrabold text-brown">{a.title}</p>
              <p className="font-mono text-[10px] text-brown-faint">{a.path}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-brown-soft">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-petflow-sm border-l-4 border-honey bg-honey/10 px-4 py-3 text-xs leading-relaxed text-brown">
        <b className="text-latte-deep">ติดขัดตรงไหน?</b> ถ้าเจอ error หรือฟีเจอร์ไหนใช้ไม่ได้ ลองเช็ค{" "}
        <b>ตั้งค่า → ขั้นสูง → อัปเดตฐานข้อมูล</b> ก่อนเป็นอันดับแรก — ฟีเจอร์ใหม่ๆ
        มักต้องอัปเดตโครงสร้างฐานข้อมูลก่อนถึงจะใช้ได้
      </div>

      <p className="mt-8 border-t border-petflow-line pt-4 text-[10px] text-brown-faint">
        คู่มือนี้อ้างอิงจากเมนูจริงในระบบ ณ วันที่จัดทำ — หากมีเมนูใหม่เพิ่มขึ้นภายหลัง แจ้งร้านเพื่ออัปเดตคู่มือ
      </p>
    </main>
  );
}
