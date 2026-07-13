import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS, ROOMS } from "@/lib/business";
import SiteFooter from "@/components/SiteFooter";

/** หน้าประจำโซนบางนา–เมกาบางนา (Local SEO area page) — เนื้อหาเฉพาะโซน ไม่ซ้ำหน้าอื่น */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catchahotel.com";
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "โรงแรมแมว บางนา–เมกาบางนา ห้องแอร์ CCTV เริ่ม 350.-/คืน | CatCha Hotel",
  description:
    "หาโรงแรมแมวใกล้บางนา เมกาบางนา อุดมสุข แบริ่ง ลาซาล? CatCha Hotel อยู่ห่างเมกาบางนาแค่ ~10 นาที ห้องแอร์ส่วนตัว CCTV ดูน้องได้ 24 ชม. รายงานเช้า-เย็นทุกวัน มีบริการรับ-ส่งถึงบ้าน เริ่มคืนละ 350.-",
  keywords: [
    "โรงแรมแมว บางนา",
    "โรงแรมแมว เมกาบางนา",
    "รับฝากแมว บางนา",
    "ฝากแมว เมกาบางนา",
    "โรงแรมแมว อุดมสุข",
    "โรงแรมแมว แบริ่ง",
    "โรงแรมแมว ลาซาล",
    "ฝากแมว ใกล้ฉัน บางนา",
  ],
  alternates: { canonical: "/cat-hotel-bangna" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}/cat-hotel-bangna`,
    siteName: "CatCha Hotel",
    title: "โรงแรมแมว บางนา–เมกาบางนา | CatCha Hotel เริ่ม 350.-/คืน",
    description: "ห่างเมกาบางนา ~10 นาที ห้องแอร์ CCTV รายงานทุกวัน มีรับ-ส่งถึงบ้าน",
    images: [{ url: "/catalog/rooms/cat-hotel-bangna-catflix.jpg", width: 800, height: 800, alt: "โรงแรมแมวใกล้บางนา CatCha Hotel" }],
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "จากบางนา/เมกาบางนา ขับมาร้านนานไหม?",
    a: "จากเมกาบางนาใช้เส้นเทพารักษ์ประมาณ 10 นาที จากแยกบางนาหรือ BTS บางนา ใช้ถนนบางนา-ตราดต่อเข้าศรีนครินทร์–เทพารักษ์ ประมาณ 15-20 นาที ร้านอยู่ในหมู่บ้านย่านหนามแดง มีที่จอดรถหน้าร้าน",
  },
  {
    q: "ไม่สะดวกขับมาส่ง มีบริการรับแมวไหม?",
    a: "มีค่ะ บริการรับ-ส่งน้องแมวถึงบ้าน ครอบคลุมโซนบางนา เมกาบางนา อุดมสุข แบริ่ง ลาซาล คิดตามระยะทาง แจ้งพิกัดทางไลน์เพื่อเช็กราคาได้เลยค่ะ",
  },
  {
    q: "ไปเที่ยวต่างประเทศ ฝากแมวยาวๆ ได้ไหม?",
    a: "ได้ค่ะ รับฝากทั้งรายวันและรายเดือน ลูกค้าโซนบางนาที่บินจากสุวรรณภูมิสะดวกมาก เพราะร้านอยู่ฝั่งตะวันออกของกรุงเทพฯ แวะส่งน้องก่อนไปสนามบินได้เลย พัก 3 คืนขึ้นไปฟรีทรายแมว",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        name: "CatCha Hotel โรงแรมแมว ใกล้บางนา เมกาบางนา",
        url: `${SITE_URL}/cat-hotel-bangna`,
        telephone: "+66805498969",
        priceRange: "฿350-฿1,450",
        areaServed: ["บางนา", "เมกาบางนา", "อุดมสุข", "แบริ่ง", "ลาซาล", "บางแก้ว"],
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

const topRooms = ROOMS.filter((r) => r.count).slice(0, 3);

export default function CatHotelBangnaPage() {
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
        โรงแรมแมว บางนา–เมกาบางนา
        <span className="block text-lg text-latte-deep md:text-xl">
          ห่างเมกาบางนาแค่ ~10 นาที เริ่มคืนละ 350.-
        </span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brown-soft">
        ทาสแมวย่าน<b className="text-catcha-chocolate">บางนา เมกาบางนา อุดมสุข แบริ่ง ลาซาล</b>{" "}
        ไม่ต้องขับข้ามเมืองไปฝากน้อง — CatCha Hotel อยู่ย่านหนามแดง–เทพารักษ์
        ใช้เส้นศรีนครินทร์หรือเทพารักษ์ถึงร้านใน 10-20 นาที ทุกห้องเป็นห้องแอร์ส่วนตัว
        มี CCTV ให้เปิดดูน้องได้ตลอด พี่เลี้ยงส่งรูป-วิดีโอรายงานเช้า-เย็นทุกวันทาง LINE
      </p>

      {/* เส้นทางจากโซนบางนา */}
      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">
        🚗 เดินทางจากโซนบางนา
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brown">
        <li className="flex gap-2">
          <span className="shrink-0">📍</span>
          <span>
            <b>จากเมกาบางนา / อิเกีย:</b> ออกเส้นถนนเทพารักษ์ มุ่งหน้าหนามแดง ~10 นาที
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">📍</span>
          <span>
            <b>จากแยกบางนา / BTS บางนา / อุดมสุข:</b> ใช้ถนนบางนา-ตราด เลี้ยวเข้าศรีนครินทร์
            ต่อเทพารักษ์ ~15-20 นาที
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">📍</span>
          <span>
            <b>จากแบริ่ง / ลาซาล:</b> ใช้เส้นสุขุมวิท 107 ต่อถนนศรีนครินทร์–เทพารักษ์ ~15 นาที
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">🚚</span>
          <span>
            <b>ไม่อยากขับ?</b> มีบริการรับ-ส่งน้องแมวถึงบ้านทั่วโซนบางนา คิดตามระยะทาง
          </span>
        </li>
      </ul>
      <a
        href={BUSINESS.maps}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block rounded-catcha-sm border-2 border-latte-deep bg-card px-5 py-2.5 text-sm font-extrabold text-latte-deep shadow-catcha-sm"
      >
        🗺️ เปิด Google Maps นำทางเลย
      </a>

      {/* ห้องแนะนำ */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">
        ห้องยอดนิยมของลูกค้าโซนบางนา
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {topRooms.map((r) => (
          <Link
            key={r.id}
            href="/cat-hotel"
            className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm transition hover:-translate-y-0.5"
          >
            <Image
              src={r.image}
              alt={`โรงแรมแมวใกล้บางนา ห้อง ${r.name}`}
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
          ดูห้องพักทั้งหมด 13 แบบ + รูปจริง →
        </Link>
      </p>

      {/* FAQ โซน */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">❓ คำถามจากลูกค้าโซนบางนา</h2>
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
        <h2 className="text-lg font-extrabold text-catcha-chocolate">เช็กห้องว่างวันนี้ 🧡</h2>
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
          <Link href="/cat-bath-bangna" className="font-bold text-latte-deep underline">
            🛁 อาบน้ำแมวโซนบางนาด้วย? ดูราคาที่นี่ →
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
