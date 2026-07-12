import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS, ROOMS } from "@/lib/business";

/**
 * หน้าเว็บหลัก (SEO Landing Page) — โรงแรมแมว บางนา เทพารักษ์ สมุทรปราการ
 * เป้าหมาย: ติดอันดับ Google คำค้นท้องถิ่น เช่น "โรงแรมแมว บางนา", "รับฝากแมว เทพารักษ์"
 * หน้านี้เป็น Server Component ล้วน (static) — บอทอ่านเนื้อหาได้ครบ
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catcha-hotel-five.vercel.app";
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";
const MAPS_URL = BUSINESS.maps;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:
    "โรงแรมแมว บางนา–เทพารักษ์ | รับฝากแมว อาบน้ำแมว ตัดขนแมว | CatCha Hotel สมุทรปราการ",
  description:
    "CatCha Hotel โรงแรมแมวย่านบางนา เทพารักษ์ หนามแดง ใกล้เมกาบางนา ศรีนครินทร์ — รับฝากแมวห้องแอร์ มี CCTV ดูน้องได้ 24 ชม. รายงานเช้า-เย็นทุกวัน พร้อมอาบน้ำ ตัดขน กรูมมิ่งแมวโดยพี่เลี้ยงใจดี เริ่มคืนละ 350.-",
  keywords: [
    "โรงแรมแมว บางนา",
    "โรงแรมแมว เทพารักษ์",
    "โรงแรมแมว สมุทรปราการ",
    "รับฝากแมว บางนา",
    "ฝากแมว เทพารักษ์",
    "ฝากเลี้ยงแมว ใกล้ฉัน",
    "อาบน้ำแมว บางนา",
    "ตัดขนแมว เทพารักษ์",
    "กรูมมิ่งแมว สมุทรปราการ",
    "โรงแรมแมว เมกาบางนา",
    "โรงแรมแมว ศรีนครินทร์",
    "โรงแรมแมว หนามแดง",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: SITE_URL,
    siteName: "CatCha Hotel",
    title: "CatCha Hotel — โรงแรมแมว & อาบน้ำแมว บางนา เทพารักษ์",
    description:
      "รับฝากแมวห้องแอร์ CCTV 24 ชม. รายงานเช้า-เย็น + อาบน้ำตัดขนแมว ย่านบางนา เทพารักษ์ ใกล้เมกาบางนา เริ่มคืนละ 350.-",
    images: [{ url: "/logo.jpg", width: 512, height: 512, alt: "CatCha Hotel โรงแรมแมว บางนา" }],
  },
  robots: { index: true, follow: true },
};

const AREAS = [
  "บางนา",
  "เทพารักษ์",
  "หนามแดง",
  "ศรีนครินทร์",
  "เมกาบางนา",
  "แบริ่ง",
  "ลาซาล",
  "อุดมสุข",
  "สำโรง",
  "บางพลี",
  "บางแก้ว",
  "สมุทรปราการ",
];

const FAQS = [
  {
    q: "โรงแรมแมว CatCha อยู่ตรงไหน?",
    a: "ร้านอยู่ย่านหนามแดง–เทพารักษ์ สมุทรปราการ ใกล้บางนาและเมกาบางนา เดินทางสะดวกจากศรีนครินทร์ แบริ่ง ลาซาล อุดมสุข และสำโรง มีที่จอดรถหน้าร้าน",
  },
  {
    q: "ราคาฝากแมวเริ่มต้นเท่าไหร่?",
    a: "ห้องพักแมวเริ่มต้นคืนละ 350 บาท (ห้อง MiNi Meow) มีหลายขนาดจนถึงห้องวิวหน้าต่าง Catflix & Chill คืนละ 750 บาท ทุกห้องเป็นห้องแอร์ พร้อมพี่เลี้ยงดูแลและทำความสะอาดทุกวัน",
  },
  {
    q: "ดูน้องแมวระหว่างฝากได้ไหม?",
    a: "ได้ค่ะ มีกล้อง CCTV ให้เจ้าของดูน้องได้ และพี่เลี้ยงส่งรูป-รายงานพฤติกรรมน้องทาง LINE เช้า-เย็นทุกวัน",
  },
  {
    q: "รับอาบน้ำ-ตัดขนแมวไหม ราคาเท่าไหร่?",
    a: "รับค่ะ อาบน้ำ-เป่าขนเริ่มต้น 400 บาท (ตามพันธุ์และขนาด) มีโปรแกรมขจัดคราบมัน และ Catcha Premium ครบเซ็ต โดยพี่เลี้ยงที่จับแมวนุ่มนวล ใจเย็นกับน้องขี้กลัวเป็นพิเศษ",
  },
  {
    q: "ต้องเตรียมอะไรมาบ้างตอนฝากแมว?",
    a: "เตรียมอาหารที่น้องกินประจำ ยาประจำตัว (ถ้ามี) และสมุดวัคซีน น้องควรได้รับวัคซีนพื้นฐานและหยดยาป้องกันเห็บหมัดก่อนเข้าพัก พัก 3 คืนขึ้นไปมีทรายแมวฟรี",
  },
  {
    q: "จองคิวยังไง?",
    a: "ทักไลน์ @catchahotel หรือโทร 080-549-8969 ได้เลยค่ะ จองผ่านระบบสมาชิกในไลน์ได้ตลอด 24 ชม. มีระบบสะสมแต้มและคูปองส่วนลดสำหรับสมาชิก",
  },
];

/** Schema.org JSON-LD — ให้ Google เข้าใจว่าเป็นธุรกิจท้องถิ่น (พิกัด+เบอร์+เวลา) */
function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `${SITE_URL}#business`,
        name: "CatCha Hotel โรงแรมแมว อาบน้ำแมว",
        alternateName: "แคทฉะ โฮเทล",
        description:
          "โรงแรมแมวและอาบน้ำ-ตัดขนแมว ย่านบางนา เทพารักษ์ หนามแดง สมุทรปราการ ห้องแอร์ CCTV รายงานเช้า-เย็น",
        url: SITE_URL,
        telephone: "+66805498969",
        priceRange: "฿350-฿1,450",
        image: `${SITE_URL}/logo.jpg`,
        address: {
          "@type": "PostalAddress",
          addressLocality: "หนามแดง เทพารักษ์",
          addressRegion: "สมุทรปราการ",
          addressCountry: "TH",
        },
        geo: { "@type": "GeoCoordinates", latitude: 13.6290175, longitude: 100.654973 },
        hasMap: MAPS_URL,
        sameAs: [MAPS_URL],
        areaServed: AREAS.map((a) => ({ "@type": "Place", name: a })),
        makesOffer: [
          { "@type": "Offer", name: "รับฝากแมว ห้องพักแมวห้องแอร์", price: "350", priceCurrency: "THB" },
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

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />

      {/* ── Hero ── */}
      <header className="pt-10 text-center">
        <Image
          src="/logo.jpg"
          alt="CatCha Hotel โรงแรมแมว บางนา เทพารักษ์"
          width={96}
          height={96}
          className="mx-auto rounded-full border-4 border-honey/40"
          priority
        />
        <h1 className="mt-5 text-2xl font-extrabold leading-snug text-catcha-chocolate sm:text-3xl">
          โรงแรมแมว & อาบน้ำแมว
          <span className="block text-latte-deep">บางนา – เทพารักษ์ – สมุทรปราการ</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-brown-soft">
          CatCha Hotel รับฝากแมวห้องแอร์ใกล้เมกาบางนา ศรีนครินทร์ หนามแดง —
          มี CCTV ดูน้องได้ตลอด พี่เลี้ยงรายงานรูปเช้า-เย็นทุกวัน
          พร้อมบริการอาบน้ำ ตัดขน กรูมมิ่งแมว เริ่มต้นคืนละ 350.-
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href={LINE_URL}
            className="rounded-catcha-sm bg-[#06C755] px-6 py-3 text-sm font-extrabold text-white"
          >
            💬 จองผ่าน LINE @catchahotel
          </a>
          <a
            href={`tel:${PHONE_MAIN.replace(/-/g, "")}`}
            className="rounded-catcha-sm bg-latte-deep px-6 py-3 text-sm font-extrabold text-white"
          >
            📞 โทร {PHONE_MAIN}
          </a>
        </div>
        <a
          href={MAPS_URL}
          className="mt-3 inline-block text-xs font-bold text-latte-deep underline"
        >
          🗺️ เปิดแผนที่ Google Maps — นำทางมาที่ร้าน
        </a>
      </header>

      {/* ── จุดเด่น ── */}
      <section className="mt-12">
        <h2 className="text-center text-lg font-extrabold text-catcha-chocolate">
          ทำไมทาสแมวย่านบางนา–เทพารักษ์ ไว้ใจ CatCha
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["📹", "CCTV ดูน้องได้", "เปิดดูน้องแมวระหว่างฝากได้ อุ่นใจตลอดทริป"],
            ["🧊", "ห้องแอร์ทุกห้อง", "สะอาด เย็นสบาย พี่เลี้ยงทำความสะอาดทุกวัน"],
            ["📸", "รายงานเช้า-เย็น", "ส่งรูป+อัปเดตพฤติกรรมน้องทาง LINE ทุกวัน"],
            ["🐾", "พาเล่นวันละ 2 รอบ", "น้องได้ยืดเส้น เดินเล่น ไม่เครียด"],
          ].map(([icon, title, desc]) => (
            <div key={title} className="rounded-catcha border border-catcha-line bg-card p-4 text-center">
              <div className="text-2xl">{icon}</div>
              <p className="mt-1 text-sm font-extrabold text-catcha-chocolate">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-brown-soft">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ห้องพัก + ราคา ── */}
      <section className="mt-12">
        <h2 className="text-center text-lg font-extrabold text-catcha-chocolate">
          ห้องพักแมว ราคาเริ่มต้นคืนละ 350.-
        </h2>
        <p className="mt-1 text-center text-xs text-brown-soft">
          ทั้งหมด 13 ห้อง · พัก 3 คืนขึ้นไปฟรีทรายแมว · พัก 7 คืนขึ้นไปฟรีกล้อง CCTV ส่วนตัว
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {singleRooms.map((r) => (
            <div key={r.id} className="rounded-catcha border border-catcha-line bg-card p-4">
              <p className="text-sm font-extrabold text-catcha-chocolate">{r.name}</p>
              <p className="text-xs text-brown-soft">{r.cats.th}</p>
              <p className="mt-2 text-xl font-extrabold text-latte-deep">
                {r.price.toLocaleString()}
                <span className="text-xs font-bold text-brown-faint"> บาท/คืน</span>
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-brown-soft">
                {r.amenities.th.slice(0, 3).map((a) => (
                  <li key={a}>✓ {a}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-brown-soft">
          มีห้องคู่/ห้องเชื่อมสำหรับบ้านที่มีแมวหลายตัว — สอบถามได้ทางไลน์เลยค่ะ
        </p>
      </section>

      {/* ── อาบน้ำ / กรูมมิ่ง ── */}
      <section className="mt-12">
        <h2 className="text-center text-lg font-extrabold text-catcha-chocolate">
          อาบน้ำแมว ตัดขนแมว (Cat Grooming)
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["อาบน้ำ – เป่าขน", "เริ่ม 400.-", "อาบสะอาด เป่าแห้งสนิท ตัดเล็บ เช็ดหู"],
            ["อาบน้ำ + ขจัดคราบมัน", "เริ่ม 500.-", "สำหรับน้องขนมัน คราบเหนียว ขนกลับมาฟู"],
            ["Catcha Premium", "เริ่ม 700.-", "จัดเต็มครบเซ็ต บำรุงขน แนะนำสำหรับขนยาว"],
          ].map(([name, price, desc]) => (
            <div key={name} className="rounded-catcha border border-catcha-line bg-card p-4 text-center">
              <p className="text-sm font-extrabold text-catcha-chocolate">{name}</p>
              <p className="mt-1 text-lg font-extrabold text-latte-deep">{price}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-brown-soft">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-brown-soft">
          ราคาตามพันธุ์และน้ำหนัก · พี่เลี้ยงใจเย็น จับนุ่มนวล ถามประวัติน้องก่อนอาบทุกครั้ง
          เพื่อความปลอดภัยของน้องขี้กลัว/มีโรคประจำตัว
        </p>
      </section>

      {/* ── พื้นที่ให้บริการ ── */}
      <section className="mt-12 rounded-catcha bg-card p-5 text-center">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">
          รับฝากแมวใกล้คุณ — พื้นที่ให้บริการ
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-brown-soft">
          ร้านตั้งอยู่ย่านหนามแดง–เทพารักษ์ เดินทางสะดวกจาก
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {AREAS.map((a) => (
            <span key={a} className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-brown-soft">
              {a}
            </span>
          ))}
        </div>
        <a
          href={MAPS_URL}
          className="mt-4 inline-block rounded-catcha-sm bg-honey/40 px-5 py-2.5 text-sm font-extrabold text-catcha-chocolate"
        >
          🗺️ นำทางด้วย Google Maps
        </a>
      </section>

      {/* ── FAQ ── */}
      <section className="mt-12">
        <h2 className="text-center text-lg font-extrabold text-catcha-chocolate">
          คำถามที่พบบ่อย
        </h2>
        <div className="mt-5 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="rounded-catcha border border-catcha-line bg-card p-4">
              <summary className="cursor-pointer text-sm font-extrabold text-catcha-chocolate">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-brown-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ท้าย ── */}
      <section className="mt-12 rounded-catcha bg-gradient-to-br from-honey/30 via-card to-latte/15 p-6 text-center">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">
          พร้อมดูแลน้องแมวของคุณแล้ววันนี้ 🧡
        </h2>
        <p className="mt-1 text-xs text-brown-soft">
          จองคิวฝากแมว/อาบน้ำ ทักไลน์ได้เลย ตอบไวช่วงเวลาทำการ
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <a href={LINE_URL} className="rounded-catcha-sm bg-[#06C755] px-6 py-3 text-sm font-extrabold text-white">
            💬 LINE @catchahotel
          </a>
          <a
            href={`tel:${PHONE_MAIN.replace(/-/g, "")}`}
            className="rounded-catcha-sm bg-latte-deep px-6 py-3 text-sm font-extrabold text-white"
          >
            📞 {PHONE_MAIN}
          </a>
        </div>
        <Link href="/app" className="mt-4 inline-block text-xs font-bold text-latte-deep underline">
          เป็นสมาชิกอยู่แล้ว? เข้าระบบสมาชิก (สะสมแต้ม/จองคิว) →
        </Link>
      </section>

      {/* ── Footer / NAP ── */}
      <footer className="mt-12 border-t border-catcha-line pt-6 text-center text-[11px] leading-relaxed text-brown-faint">
        <p className="font-bold text-brown-soft">
          CatCha Hotel — โรงแรมแมว อาบน้ำแมว ตัดขนแมว
        </p>
        <p>หนามแดง เทพารักษ์ สมุทรปราการ (ใกล้บางนา · เมกาบางนา · ศรีนครินทร์)</p>
        <p>
          โทร {BUSINESS.phones.join(" / ")} · LINE {BUSINESS.lineOa}
        </p>
      </footer>
    </main>
  );
}
