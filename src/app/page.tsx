import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, ROOMS } from "@/lib/business";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { Logo } from "@/components/Logo";
import SiteFooter, { SocialLinks } from "@/components/SiteFooter";

/**
 * หน้าเว็บหลัก (SEO Landing Page) — เทมเพลตกลาง ไม่ผูกกับพื้นที่ใดพื้นที่หนึ่ง
 * ร้านจริงแก้ชื่อ/ที่อยู่/คำค้นได้ที่ src/lib/business.ts หรือหลังบ้าน
 * หน้านี้เป็น Server Component ล้วน (static) — บอทอ่านเนื้อหาได้ครบ
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://petflow.example.com";
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = BUSINESS.social.line;
const MAPS_URL = BUSINESS.maps;
const LOCATION = BUSINESS.location.th;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${BUSINESS.name} — โรงแรมแมว & อาบน้ำแมว ${LOCATION}`,
  description: `${BUSINESS.name} รับฝากแมวห้องแอร์ มี CCTV ดูน้องได้ 24 ชม. รายงานเช้า-เย็นทุกวัน พร้อมบริการอาบน้ำแมวโดยพี่เลี้ยงใจดี เริ่มคืนละ ${ROOMS[0]?.price ?? 350}.-`,
  keywords: [
    `โรงแรมแมว ${LOCATION}`,
    `รับฝากแมว ${LOCATION}`,
    "ฝากเลี้ยงแมว ใกล้ฉัน",
    `อาบน้ำแมว ${LOCATION}`,
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: SITE_URL,
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} — โรงแรมแมว & อาบน้ำแมว ${LOCATION}`,
    description: `รับฝากแมวห้องแอร์ CCTV 24 ชม. รายงานเช้า-เย็น + อาบน้ำแมว เริ่มคืนละ ${ROOMS[0]?.price ?? 350}.-`,
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: `โรงแรมแมว ${BUSINESS.name} อยู่ตรงไหน?`,
    a: `ร้านอยู่แถว ${LOCATION}${BUSINESS.address ? ` (${BUSINESS.address})` : ""} — ทักไลน์สอบถามเส้นทางได้เลยค่ะ`,
  },
  {
    q: "ราคาฝากแมวเริ่มต้นเท่าไหร่?",
    a: `ห้องพักแมวเริ่มต้นคืนละ ${ROOMS[0]?.price ?? 350} บาท มีหลายขนาดจนถึงห้องวิวหน้าต่าง ทุกห้องเป็นห้องแอร์ พร้อมพี่เลี้ยงดูแลและทำความสะอาดทุกวัน`,
  },
  {
    q: "ดูน้องแมวระหว่างฝากได้ไหม?",
    a: "ได้ค่ะ มีกล้อง CCTV ให้เจ้าของดูน้องได้ และพี่เลี้ยงส่งรูป-รายงานพฤติกรรมน้องทาง LINE เช้า-เย็นทุกวัน",
  },
  {
    q: "รับอาบน้ำแมวไหม ราคาเท่าไหร่?",
    a: "รับค่ะ อาบน้ำ-เป่าขนเริ่มต้น 400 บาท (ตามพันธุ์และขนาด) โดยพี่เลี้ยงที่จับแมวนุ่มนวล ใจเย็นกับน้องขี้กลัวเป็นพิเศษ",
  },
  {
    q: "ต้องเตรียมอะไรมาบ้างตอนฝากแมว?",
    a: "เตรียมอาหารที่น้องกินประจำ ยาประจำตัว (ถ้ามี) และสมุดวัคซีน น้องควรได้รับวัคซีนพื้นฐานและหยดยาป้องกันเห็บหมัดก่อนเข้าพัก",
  },
  {
    q: "จองคิวยังไง?",
    a: `ทักไลน์ ${BUSINESS.lineOa} หรือโทร ${PHONE_MAIN} ได้เลยค่ะ จองผ่านระบบสมาชิกในไลน์ได้ตลอด 24 ชม. มีระบบสะสมแต้มและคูปองส่วนลดสำหรับสมาชิก`,
  },
];

/** Schema.org JSON-LD — ให้ Google เข้าใจว่าเป็นธุรกิจท้องถิ่น (เฉพาะที่ตั้งค่าไว้จริง) */
function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${SITE_URL}#business`,
        name: `${BUSINESS.name} โรงแรมแมว อาบน้ำแมว`,
        alternateName: BUSINESS.name,
        description: `โรงแรมแมวและอาบน้ำแมว ${LOCATION} ห้องแอร์ CCTV รายงานเช้า-เย็น`,
        url: SITE_URL,
        telephone: PHONE_MAIN,
        priceRange: `฿${ROOMS[0]?.price ?? 350}+`,
        ...(BUSINESS.address
          ? { address: { "@type": "PostalAddress", addressLocality: LOCATION, addressCountry: "TH" } }
          : {}),
        hasMap: MAPS_URL,
        sameAs: [MAPS_URL, BUSINESS.social.facebook, BUSINESS.social.instagram, BUSINESS.social.tiktok],
        makesOffer: [
          { "@type": "Offer", name: "รับฝากแมว ห้องพักแมวห้องแอร์", price: String(ROOMS[0]?.price ?? 350), priceCurrency: "THB" },
          { "@type": "Offer", name: "อาบน้ำแมว เป่าขน", price: "400", priceCurrency: "THB" },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

const singleRooms = ROOMS.filter((r) => r.count).slice(0, 3);

/** การ์ดข้อมูลแบบข้อความ — ใช้แทนรูปอินโฟกราฟิก จนกว่าร้านจะอัปโหลดรูปของตัวเอง */
function InfoCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm">
      <p className="text-sm font-extrabold text-petflow-chocolate">{title}</p>
      <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-brown-soft">
        {lines.map((l) => (
          <li key={l}>• {l}</li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      {/* ── Hero ── */}
      <header className="bg-gradient-to-b from-honey/30 via-paper to-transparent">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-5 pb-12 pt-10 md:grid-cols-2 md:pb-16">
          <div className="text-center md:text-left">
            <div className="mx-auto md:mx-0">
              <Logo size={88} />
            </div>
            <h1 className="mt-5 text-[26px] font-extrabold leading-tight text-petflow-chocolate sm:text-3xl md:text-4xl">
              โรงแรมแมว & อาบน้ำแมว
              <span className="mt-1 block text-latte-deep">{LOCATION}</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-brown-soft md:mx-0 md:text-[15px]">
              {BUSINESS.name} รับฝากแมว<b className="text-petflow-chocolate">ห้องแอร์ส่วนตัว</b> —
              มี CCTV ดูน้องได้ตลอด พี่เลี้ยงรายงานรูปเช้า-เย็นทุกวัน พร้อมบริการอาบน้ำแมวโดยพี่เลี้ยงใจดี
              <b className="text-latte-deep"> เริ่มต้นคืนละ {ROOMS[0]?.price ?? 350}.-</b>
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center md:justify-start">
              <a
                href={LINE_URL}
                className="rounded-petflow-sm bg-[#06C755] px-6 py-3.5 text-center text-sm font-extrabold text-white shadow-petflow-sm active:scale-[0.98]"
              >
                💬 จองผ่าน LINE {BUSINESS.lineOa}
              </a>
              <a
                href={`tel:${PHONE_MAIN.replace(/-/g, "")}`}
                className="rounded-petflow-sm bg-latte-deep px-6 py-3.5 text-center text-sm font-extrabold text-white shadow-petflow-sm active:scale-[0.98]"
              >
                📞 โทร {PHONE_MAIN}
              </a>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-petflow-sm border-2 border-latte-deep bg-card px-6 py-3 text-center text-sm font-extrabold text-latte-deep shadow-petflow-sm active:scale-[0.98]"
              >
                🗺️ Google Maps นำทางมาร้าน
              </a>
            </div>
            <div className="mt-5">
              <SocialLinks />
            </div>
          </div>
          <div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-petflow border border-honey/40 bg-gradient-to-br from-honey/40 via-card to-latte/20 text-7xl shadow-petflow md:max-w-none">
            🐱🧡
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 pb-16">
        {/* ── จุดเด่น ── */}
        <section className="mt-2">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            ทำไมทาสแมวไว้ใจ {BUSINESS.name} 🧡
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["📹", "CCTV ดูน้องได้", "เปิดดูน้องแมวระหว่างฝากได้ อุ่นใจตลอดทริป"],
              ["🧊", "ห้องแอร์ทุกห้อง", "สะอาด เย็นสบาย พี่เลี้ยงทำความสะอาดทุกวัน"],
              ["📸", "รายงานเช้า-เย็น", "ส่งรูป+อัปเดตพฤติกรรมน้องทาง LINE ทุกวัน"],
              ["🐾", "พาเล่นวันละ 2 รอบ", "น้องได้ยืดเส้น เดินเล่น ไม่เครียด"],
            ].map(([icon, title, desc]) => (
              <div
                key={title}
                className="rounded-petflow border border-petflow-line bg-card p-4 text-center shadow-petflow-sm"
              >
                <div className="text-3xl">{icon}</div>
                <p className="mt-2 text-sm font-extrabold text-petflow-chocolate">{title}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-brown-soft">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── ห้องพัก + ราคา ── */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            🏨 ห้องพักแมว เริ่มต้นคืนละ {ROOMS[0]?.price ?? 350}.-
          </h2>
          <p className="mt-2 text-center text-xs text-brown-soft">
            พัก 3 คืนขึ้นไปฟรีทรายแมว · พัก 7 คืนขึ้นไปฟรีกล้อง CCTV ส่วนตัว
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {singleRooms.map((r, i) => (
              <div
                key={r.id}
                className={`relative rounded-petflow border bg-card p-5 shadow-petflow-sm ${
                  i === 0 ? "border-honey/60" : "border-petflow-line"
                }`}
              >
                {i === 0 && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-honey px-3 py-0.5 text-[10px] font-extrabold text-petflow-chocolate">
                    ⭐ เริ่มต้น
                  </span>
                )}
                <p className="text-base font-extrabold text-petflow-chocolate">{r.name}</p>
                <p className="mt-0.5 text-xs text-brown-soft">{r.cats.th}</p>
                <p className="mt-3 text-2xl font-extrabold text-latte-deep">
                  {r.price.toLocaleString()}
                  <span className="text-xs font-bold text-brown-faint"> บาท/คืน</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-brown-soft">
                  {r.amenities.th.slice(0, 3).map((a) => (
                    <li key={a}>✓ {a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-brown-soft">
            มีห้องคู่/ห้องเชื่อมสำหรับบ้านที่มีแมวหลายตัว — สอบถามได้ทางไลน์เลยค่ะ
          </p>
          <div className="mt-4 text-center">
            <Link
              href="/cat-hotel"
              className="inline-block rounded-petflow-sm bg-latte/25 px-6 py-3 text-sm font-extrabold text-petflow-chocolate shadow-petflow-sm"
            >
              📷 ดูรายละเอียด + ราคาทุกห้อง →
            </Link>
          </div>
        </section>

        {/* ── จองยังไง + เวลาทำการ ── */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            📅 จองง่ายๆ + เวลาให้บริการ
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard
              title="วิธีจองห้องพัก"
              lines={["แจ้งวันที่ + จำนวนแมวทางไลน์", "ส่งข้อมูลน้องแมว (พันธุ์/น้ำหนัก/นิสัย)", "ชำระมัดจำ", "รับ Booking Confirmation"]}
            />
            <InfoCard
              title="เวลาให้บริการ"
              lines={["เปิดทุกวัน 09:00–19:00", "เช็กอิน 09:00–18:00", "เช็กเอาต์ 09:00–19:00"]}
            />
          </div>
        </section>

        {/* ── อาบน้ำแมว ── */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            🛁 อาบน้ำแมว (Cat Bathing)
          </h2>
          <p className="mt-2 text-center text-xs text-brown-soft">
            โดยพี่เลี้ยงที่จับแมวนุ่มนวล ใจเย็นกับน้องขี้กลัวเป็นพิเศษ
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["อาบน้ำ – เป่าขน", "เริ่ม 400.-", "อาบสะอาด เป่าแห้งสนิท ตัดเล็บ เช็ดหู"],
              ["อาบน้ำ + ขจัดคราบมัน", "เริ่ม 500.-", "สำหรับน้องขนมัน คราบเหนียว ขนกลับมาฟู"],
              [`${BUSINESS.name} Premium`, "เริ่ม 700.-", "จัดเต็มครบเซ็ต บำรุงขน แนะนำสำหรับขนยาว"],
            ].map(([name, price, desc]) => (
              <div
                key={name}
                className="rounded-petflow border border-petflow-line bg-card p-5 text-center shadow-petflow-sm"
              >
                <p className="text-sm font-extrabold text-petflow-chocolate">{name}</p>
                <p className="mt-2 text-xl font-extrabold text-latte-deep">{price}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-brown-soft">{desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoCard
              title="ก่อนพาน้องมาอาบน้ำ"
              lines={["งดอาหารก่อนอาบ 2-3 ชั่วโมง", "แจ้งโรคประจำตัว (ถ้ามี)", "พามาในกระเป๋าหรือกรง"]}
            />
            <InfoCard
              title="เงื่อนไขการจองคิวอาบน้ำ"
              lines={["มัดจำ 200 บาท", "นำไปหักค่าอาบน้ำ", "ยกเลิกล่วงหน้าได้ตามเงื่อนไขร้าน"]}
            />
          </div>
          <p className="mt-4 text-center text-xs text-brown-soft">
            ราคาตามพันธุ์และน้ำหนัก · ถามประวัติน้องก่อนอาบทุกครั้ง เพื่อความปลอดภัยของน้องขี้กลัว/มีโรคประจำตัว
          </p>
          <div className="mt-4 text-center">
            <Link
              href="/cat-bath"
              className="inline-block rounded-petflow-sm bg-latte/25 px-6 py-3 text-sm font-extrabold text-petflow-chocolate shadow-petflow-sm"
            >
              📋 ดูเมนู-ราคาอาบน้ำทุกสายพันธุ์ →
            </Link>
          </div>
        </section>

        {/* ── เตรียมตัวก่อนเข้าพัก ── */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            🧳 เตรียมตัวก่อนพาน้องเข้าพัก
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoCard
              title="สิ่งที่ต้องเตรียมมาวันเข้าพัก"
              lines={["สมุดวัคซีน", "อาหาร + ทรายแมวที่ใช้ประจำ", "ของใช้ประจำตัว", "กระเป๋าหรือกรง"]}
            />
            <InfoCard
              title="วัคซีน + ยาเห็บหมัด"
              lines={["วัคซีนครบตามกำหนด", "หยดยาเห็บหมัดภายใน 1 เดือน", "ส่งหลักฐานก่อนเข้าพัก"]}
            />
            <InfoCard
              title="เงื่อนไขสำคัญในการเข้าพัก"
              lines={["รับเฉพาะแมวเลี้ยงระบบปิด", "สุขภาพแข็งแรง", "อัปเดตรูปทุกวัน"]}
            />
          </div>
        </section>

        {/* ── บริการรับส่ง ── */}
        <section className="mt-14">
          <div className="grid items-center gap-6 rounded-petflow bg-card p-5 shadow-petflow-sm md:grid-cols-2 md:p-8">
            <div className="text-center md:text-left">
              <h2 className="text-xl font-extrabold text-petflow-chocolate">
                🚗 มีบริการรับ-ส่งน้องแมวถึงบ้าน
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-brown-soft">
                ไม่สะดวกพาน้องมาเอง? เรามีบริการรับ-ส่งด้วยรถยนต์ส่วนตัว
                ไม่รวมกับแมวบ้านอื่น ทำความสะอาดฆ่าเชื้อทุกครั้งหลังใช้งาน
              </p>
              <ul className="mt-4 space-y-2 text-left text-sm text-brown">
                <li>✓ ไม่เกิน 1 กิโล — รับ-ส่ง<b className="text-latte-deep">ฟรี</b></li>
                <li>✓ ไม่เกิน 5 กิโล — เหมา 100 บาท</li>
                <li>✓ ไม่เกิน 10 กิโล — เหมา 150 บาท</li>
                <li>✓ เกิน 10 กิโล — 150 บาท + กิโลละ 10 บาท</li>
              </ul>
            </div>
            <div className="mx-auto flex aspect-square w-full max-w-sm items-center justify-center rounded-petflow border border-petflow-line bg-paper text-6xl">
              🚗🐱
            </div>
          </div>
        </section>

        {/* ── สมาชิก / สะสมแต้ม ── */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            🎁 เป็นสมาชิก ยิ่งพัก ยิ่งคุ้ม
          </h2>
          <p className="mt-2 text-center text-xs text-brown-soft">
            สะสมแต้มทุกการใช้บริการ (100 บาท = 1 คะแนน) แลกส่วนลดได้ · สมาชิกใหม่รับส่วนลด 5%
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <InfoCard
              title="สะสมคะแนน แลกส่วนลด/ของรางวัล"
              lines={["ทุก 100 บาท = 1 คะแนน", "แลกส่วนลดหรือของรางวัลได้ทางแอปสมาชิก"]}
            />
            <InfoCard
              title="สมาชิกใหม่ รับส่วนลด 5%"
              lines={["สมัครสมาชิกฟรี", "รับส่วนลด 5% ในการใช้บริการครั้งแรก"]}
            />
          </div>
          <div className="mt-5 text-center">
            <Link
              href="/app"
              className="inline-block rounded-petflow-sm bg-honey/50 px-6 py-3 text-sm font-extrabold text-petflow-chocolate shadow-petflow-sm"
            >
              🐱 สมัครสมาชิก / เข้าระบบสมาชิก →
            </Link>
          </div>
        </section>

        {/* ── พื้นที่ให้บริการ ── */}
        <section className="mt-14 rounded-petflow bg-card p-6 text-center shadow-petflow-sm">
          <h2 className="text-xl font-extrabold text-petflow-chocolate">
            📍 รับฝากแมวใกล้คุณ
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-brown-soft">
            ร้านตั้งอยู่แถว {LOCATION} — ทักไลน์สอบถามเส้นทางได้เลยค่ะ
          </p>
          <a
            href={MAPS_URL}
            className="mt-5 inline-block rounded-petflow-sm bg-honey/40 px-6 py-3 text-sm font-extrabold text-petflow-chocolate"
          >
            🗺️ นำทางด้วย Google Maps
          </a>
        </section>

        {/* ── FAQ ── */}
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            ❓ คำถามที่พบบ่อย
          </h2>
          <div className="mt-6 space-y-3">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm"
              >
                <summary className="cursor-pointer list-none text-sm font-extrabold text-petflow-chocolate">
                  <span className="mr-1 inline-block transition group-open:rotate-90">▸</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-4 text-sm leading-relaxed text-brown-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── บทความ ── */}
        {BLOG_POSTS.length > 0 && (
        <section className="mt-14">
          <h2 className="text-center text-xl font-extrabold text-petflow-chocolate">
            📚 บทความน่ารู้จากพี่เลี้ยง {BUSINESS.name}
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {BLOG_POSTS.slice(0, 3).map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm transition hover:border-honey/60"
              >
                <p className="text-2xl">{post.emoji}</p>
                <p className="mt-2 text-sm font-extrabold leading-snug text-petflow-chocolate">
                  {post.title}
                </p>
                <p className="mt-2 text-[11px] font-bold text-latte-deep">
                  อ่านต่อ ({post.readMinutes} นาที) →
                </p>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-center">
            <Link href="/blog" className="text-xs font-bold text-latte-deep underline">
              ดูบทความทั้งหมด →
            </Link>
          </p>
        </section>
        )}

        {/* ── CTA ท้าย ── */}
        <section className="mt-14 rounded-petflow bg-gradient-to-br from-honey/35 via-card to-latte/15 p-6 text-center shadow-petflow md:p-10">
          <h2 className="text-xl font-extrabold text-petflow-chocolate">
            พร้อมดูแลน้องแมวของคุณแล้ววันนี้ 🧡
          </h2>
          <p className="mt-2 text-xs text-brown-soft">
            จองคิวฝากแมว/อาบน้ำ ทักไลน์ได้เลย ตอบไวช่วงเวลาทำการ 09:00–19:00 ทุกวัน
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
            <a
              href={LINE_URL}
              className="rounded-petflow-sm bg-[#06C755] px-6 py-3.5 text-sm font-extrabold text-white shadow-petflow-sm active:scale-[0.98]"
            >
              💬 LINE {BUSINESS.lineOa}
            </a>
            <a
              href={`tel:${PHONE_MAIN.replace(/-/g, "")}`}
              className="rounded-petflow-sm bg-latte-deep px-6 py-3.5 text-sm font-extrabold text-white shadow-petflow-sm active:scale-[0.98]"
            >
              📞 {PHONE_MAIN}
            </a>
          </div>
          <Link href="/app" className="mt-5 inline-block text-xs font-bold text-latte-deep underline">
            เป็นสมาชิกอยู่แล้ว? เข้าระบบสมาชิก (สะสมแต้ม/จองคิว) →
          </Link>
        </section>

        {/* ── Footer / NAP ── */}
        <SiteFooter />
      </div>
    </main>
  );
}
