import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS, ROOMS } from "@/lib/business";
import SiteFooter from "@/components/SiteFooter";

/** หน้าประจำโซนเทพารักษ์–หนามแดง–สมุทรปราการ (Local SEO area page) — โซนบ้านของร้านเอง */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catchahotel.com";
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "โรงแรมแมว เทพารักษ์–หนามแดง สมุทรปราการ ร้านอยู่ในย่านนี้ | CatCha Hotel",
  description:
    "โรงแรมแมวในย่านเทพารักษ์–หนามแดง สมุทรปราการ ตัวจริง ไม่ต้องขับไกล — CatCha Hotel ห้องแอร์ส่วนตัว CCTV 24 ชม. รายงานเช้า-เย็น ใกล้สำโรง ปากน้ำ บางพลี บางแก้ว เริ่มคืนละ 350.-",
  keywords: [
    "โรงแรมแมว เทพารักษ์",
    "โรงแรมแมว สมุทรปราการ",
    "โรงแรมแมว หนามแดง",
    "รับฝากแมว เทพารักษ์",
    "ฝากแมว สมุทรปราการ",
    "โรงแรมแมว สำโรง",
    "โรงแรมแมว บางพลี",
    "ฝากแมว ปากน้ำ",
  ],
  alternates: { canonical: "/cat-hotel-samutprakan" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}/cat-hotel-samutprakan`,
    siteName: "CatCha Hotel",
    title: "โรงแรมแมว เทพารักษ์–สมุทรปราการ | CatCha Hotel เริ่ม 350.-/คืน",
    description: "ร้านอยู่ย่านหนามแดง–เทพารักษ์จริงๆ ห้องแอร์ CCTV รายงานทุกวัน",
    images: [{ url: "/catalog/rooms/cat-hotel-bangna-cozy-duo.jpg", width: 800, height: 800, alt: "โรงแรมแมว เทพารักษ์ สมุทรปราการ CatCha Hotel" }],
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "ร้านอยู่ตรงไหนของเทพารักษ์?",
    a: "ร้านอยู่ในหมู่บ้านย่านหนามแดง ถนนเทพารักษ์ ใกล้แยกหนามแดง เดินทางสะดวกทั้งจากฝั่งสำโรง ปากน้ำ และบางพลี มีที่จอดรถหน้าร้าน แจ้งพิกัดละเอียดทางไลน์ก่อนเข้ามาได้เลยค่ะ",
  },
  {
    q: "คนสมุทรปราการฝากแมวที่นี่ดียังไง?",
    a: "ใกล้บ้าน รับ-ส่งน้องสะดวก ไม่ต้องพาน้องนั่งรถไกลให้เครียด แวะเยี่ยมน้องระหว่างฝากก็ได้ และร้านเป็นระบบปิดรับจำนวนจำกัดต่อวัน น้องแมวไม่แออัด พี่เลี้ยงดูแลทั่วถึงทุกตัว",
  },
  {
    q: "รับฝากแมวด่วน/ฝากวันเดียวไหม?",
    a: "รับค่ะ ถ้าห้องว่างรับได้แม้จองวันเดียวกัน ลูกค้าโซนเทพารักษ์–หนามแดงหลายบ้านใช้บริการฝากระหว่างวัน เช่น ช่างเข้าบ้าน พ่นยากันปลวก หรือมีธุระด่วน ทักไลน์เช็กห้องว่างได้เลยค่ะ",
  },
  {
    q: "มีบริการรับ-ส่งในสมุทรปราการไหม?",
    a: "มีค่ะ รับ-ส่งถึงบ้านทั่วโซนเทพารักษ์ หนามแดง สำโรง ปากน้ำ บางพลี บางแก้ว คิดตามระยะทาง เริ่มต้นเบาๆ เพราะอยู่โซนเดียวกัน แจ้งพิกัดทางไลน์เพื่อเช็กราคาค่ะ",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        name: "CatCha Hotel โรงแรมแมว เทพารักษ์ สมุทรปราการ",
        url: `${SITE_URL}/cat-hotel-samutprakan`,
        telephone: "+66805498969",
        priceRange: "฿350-฿1,450",
        address: {
          "@type": "PostalAddress",
          addressLocality: "หนามแดง เทพารักษ์",
          addressRegion: "สมุทรปราการ",
          addressCountry: "TH",
        },
        areaServed: ["เทพารักษ์", "หนามแดง", "สำโรง", "ปากน้ำ", "บางพลี", "บางแก้ว", "สมุทรปราการ"],
        geo: { "@type": "GeoCoordinates", latitude: 13.6290175, longitude: 100.654973 },
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

const duoRooms = ROOMS.filter((r) => !r.count).slice(0, 3);

export default function CatHotelSamutprakanPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />
      <Link href="/" className="text-xs font-bold text-brown-soft">
        ← หน้าแรก CatCha Hotel
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-snug text-catcha-chocolate md:text-3xl">
        โรงแรมแมว เทพารักษ์–หนามแดง สมุทรปราการ
        <span className="block text-lg text-latte-deep md:text-xl">
          ร้านอยู่ในย่านนี้จริงๆ ไม่ต้องขับไกล
        </span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brown-soft">
        CatCha Hotel เป็นโรงแรมแมวของ<b className="text-catcha-chocolate">คนเทพารักษ์–หนามแดง</b>{" "}
        ตั้งอยู่ในหมู่บ้านย่านหนามแดง ถนนเทพารักษ์ — ลูกค้าโซน
        <b className="text-catcha-chocolate">สำโรง ปากน้ำ บางพลี บางแก้ว</b> ขับมาไม่เกิน 15-20 นาที
        ใกล้บ้านพอที่จะแวะเยี่ยมน้องระหว่างฝากได้ ร้านเป็นระบบปิด รับจำนวนจำกัดต่อวัน
        ทุกห้องเป็นห้องแอร์ส่วนตัว มี CCTV และรายงานรูป-วิดีโอเช้า-เย็นทุกวัน
      </p>

      {/* จุดเด่นสำหรับคนโซนนี้ */}
      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">
        🏡 ข้อดีของการฝากแมวใกล้บ้าน
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brown">
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>น้องแมวนั่งรถสั้นลง เครียดน้อยลง ปรับตัวเข้าห้องพักได้เร็วกว่า</span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>แวะเยี่ยมน้องระหว่างฝากได้สะดวก หรือรับกลับก่อนกำหนดก็ใกล้แค่นี้</span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>ฝากระหว่างวันก็คุ้ม — ช่างเข้าบ้าน พ่นยากันปลวก ทาสีบ้าน พาน้องมาหลบได้</span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>ค่ารับ-ส่งถึงบ้านเริ่มต้นเบาๆ เพราะอยู่โซนเดียวกัน</span>
        </li>
      </ul>

      {/* ห้องเชื่อมเด่น */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">
        บ้านแมวหลายตัว? มีห้องเชื่อมให้พี่น้องอยู่ด้วยกัน
      </h2>
      <p className="mt-1 text-xs text-brown-soft">
        บ้านโซนสมุทรปราการเลี้ยงแมวกันทีละหลายตัว — ห้องเชื่อมของเราเปิดประตูถึงกันได้ พื้นที่กว้างขึ้นเท่าตัว
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {duoRooms.map((r) => (
          <Link
            key={r.id}
            href="/cat-hotel"
            className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm transition hover:-translate-y-0.5"
          >
            <Image
              src={r.image}
              alt={`โรงแรมแมว เทพารักษ์ ห้อง ${r.name}`}
              width={600}
              height={600}
              sizes="(max-width: 640px) 100vw, 33vw"
              className="h-auto w-full"
            />
            <div className="p-3 text-center">
              <p className="text-sm font-extrabold text-catcha-chocolate">{r.name}</p>
              <p className="text-xs font-bold text-latte-deep">{r.price.toLocaleString()} บาท/คืน</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center text-xs">
        <Link href="/cat-hotel" className="font-bold text-latte-deep underline">
          ดูห้องพักทั้งหมด + รูปจริงทุกห้อง →
        </Link>
      </p>

      {/* FAQ โซน */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">
        ❓ คำถามจากลูกค้าโซนสมุทรปราการ
      </h2>
      <div className="mt-3 space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="text-sm font-extrabold text-catcha-chocolate">{f.q}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-soft">{f.a}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-catcha bg-gradient-to-br from-honey/35 via-card to-latte/15 p-6 text-center shadow-catcha">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">
          เพื่อนบ้านเทพารักษ์ ทักมาเลย 🧡
        </h2>
        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={LINE_URL}
            className="rounded-catcha-sm bg-[#06C755] px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm"
          >
            💬 LINE @catchahotel
          </a>
          <a
            href={`tel:${PHONE_MAIN.replace(/-/g, "")}`}
            className="rounded-catcha-sm bg-latte-deep px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm"
          >
            📞 {PHONE_MAIN}
          </a>
        </div>
        <p className="mt-4 text-[11px]">
          <Link href="/cat-bath" className="font-bold text-latte-deep underline">
            🛁 อาบน้ำแมวด้วย? ดูเมนู-ราคา →
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
