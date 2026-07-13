import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import SiteFooter from "@/components/SiteFooter";

/** หน้าประจำโซน: อาบน้ำแมว บางนา–ศรีนครินทร์–พัฒนาการ (Local SEO area page) · ร้านไม่มีบริการตัดขน */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catchahotel.com";
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "อาบน้ำแมว บางนา ศรีนครินทร์ พัฒนาการ แบบ Private รับทีละบ้าน | CatCha Hotel",
  description:
    "หาที่อาบน้ำแมวโซนบางนา ศรีนครินทร์ พัฒนาการ เมกาบางนา? CatCha Hotel อาบแบบ Private รับน้องทีละบ้าน ไม่เจอแมวแปลกหน้า แชมพูพรีเมียม เป่าแห้งถึงชั้นใน รวมตัดเล็บ เช็ดหู เริ่ม 400.-",
  keywords: [
    "อาบน้ำแมว บางนา",
    "อาบน้ำแมว ศรีนครินทร์",
    "อาบน้ำแมว พัฒนาการ",
    "อาบน้ำแมว เมกาบางนา",
    "ร้านอาบน้ำแมว ใกล้ฉัน",
    "อาบน้ำแมว อุดมสุข",
    "กรูมมิ่งแมว บางนา",
    "อาบน้ำแมวขี้กลัว",
  ],
  alternates: { canonical: "/cat-bath-bangna" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}/cat-bath-bangna`,
    siteName: "CatCha Hotel",
    title: "อาบน้ำแมว บางนา–ศรีนครินทร์–พัฒนาการ | CatCha Hotel เริ่ม 400.-",
    description: "อาบแบบ Private รับทีละบ้าน แชมพูพรีเมียม เป่าแห้งถึงชั้นใน",
    images: [{ url: "/catalog/grooming/bath-menu.jpg", width: 1080, height: 1080, alt: "อาบน้ำแมวโซนบางนา CatCha Hotel" }],
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "อยู่พัฒนาการ/ศรีนครินทร์ มาร้านยังไง?",
    a: "ใช้ถนนศรีนครินทร์มุ่งหน้าสมุทรปราการ ต่อเข้าถนนเทพารักษ์ ร้านอยู่ย่านหนามแดง จากสวนหลวง ร.9 หรือซีคอนศรีนครินทร์ ประมาณ 20 นาที มีที่จอดรถหน้าร้าน",
  },
  {
    q: "แมวขี้กลัว ไม่เคยอาบร้านมาก่อน จะไหวไหม?",
    a: "จุดเด่นของร้านเลยค่ะ — เราอาบแบบ Private รับน้องทีละบ้าน ในร้านไม่มีแมวแปลกหน้า ไม่มีเสียงไดร์หลายตัวพร้อมกัน พี่เลี้ยงใจเย็น จับนุ่มนวล ไม่เร่งรีบ ไม่ฝืนน้อง ลูกค้าแมวขี้กลัวหลายบ้านกลับมาซ้ำเพราะแบบนี้ค่ะ",
  },
  {
    q: "ต้องจองล่วงหน้ากี่วัน?",
    a: "แนะนำจองล่วงหน้า 2-3 วันทางไลน์ เพราะรับจำนวนจำกัดต่อวัน (มัดจำ 200 บาท หักจากค่าอาบน้ำ) ช่วงเสาร์-อาทิตย์คิวเต็มเร็ว ลูกค้าโซนบางนา-พัฒนาการนิยมจองคิวเช้าแล้วแวะเมกาบางนาระหว่างรอรับน้องค่ะ",
  },
  {
    q: "อาบเสร็จรับกลับได้เลยไหม ใช้เวลานานเท่าไหร่?",
    a: "ใช้เวลาประมาณ 1.5-2.5 ชั่วโมงแล้วแต่ขนาดตัวและสภาพขน เป่าแห้งสนิทถึงขนชั้นในทุกตัวเพื่อป้องกันเชื้อรา รับกลับได้ทันทีที่เสร็จ พี่เลี้ยงจะส่งรูปแจ้งทางไลน์ค่ะ (ทางร้านไม่มีบริการตัดขนนะคะ)",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "อาบน้ำแมว โซนบางนา ศรีนครินทร์ พัฒนาการ — CatCha Hotel",
        serviceType: "Cat bathing & grooming spa",
        url: `${SITE_URL}/cat-bath-bangna`,
        provider: { "@type": "LocalBusiness", name: "CatCha Hotel", telephone: "+66805498969" },
        areaServed: ["บางนา", "ศรีนครินทร์", "พัฒนาการ", "เมกาบางนา", "อุดมสุข", "สวนหลวง"],
        offers: [
          { "@type": "Offer", name: "อาบน้ำ-เป่าขน", price: "400", priceCurrency: "THB" },
          { "@type": "Offer", name: "อาบน้ำ+ขจัดคราบมัน", price: "500", priceCurrency: "THB" },
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

export default function CatBathBangnaPage() {
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
        อาบน้ำแมว บางนา · ศรีนครินทร์ · พัฒนาการ
        <span className="block text-lg text-latte-deep md:text-xl">
          อาบแบบ Private รับทีละบ้าน เริ่ม 400.-
        </span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brown-soft">
        ทาสแมวโซน<b className="text-catcha-chocolate">บางนา ศรีนครินทร์ พัฒนาการ เมกาบางนา อุดมสุข</b>{" "}
        ที่อยากได้ร้านอาบน้ำแมวแบบไม่วุ่นวาย — CatCha Hotel รับอาบ
        <b className="text-catcha-chocolate">ทีละบ้าน</b> น้องไม่ต้องเจอแมวแปลกหน้า
        ไม่มีเสียงไดร์ดังพร้อมกันหลายตัว เหมาะกับ<b className="text-catcha-chocolate">แมวขี้กลัว
        แมวอาบครั้งแรก</b>เป็นพิเศษ ใช้แชมพูเกรดพรีเมียม เป่าแห้งสนิทถึงขนชั้นใน
        ราคารวมตัดเล็บ เช็ดหู-ตา แล้ว
        <span className="mt-1 block font-bold">หมายเหตุ: ทางร้านไม่มีบริการตัดขนนะคะ 🙏</span>
      </p>

      {/* ทำไมขับมาถึงหนามแดง */}
      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">
        🚿 ทำไมลูกค้าโซนบางนา–พัฒนาการ ขับมาอาบที่นี่
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brown">
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>คิว Private จริงๆ</b> — จองแล้วช่วงเวลานั้นเป็นของน้องบ้านเดียว ไม่แออัด ไม่รอนาน
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>เป่าแห้งถึงชั้นใน</b> — สำคัญมากกับแมวขนยาว/ขนหนา กันเชื้อราและขนพันเป็นสังกะตัง
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>ระหว่างรอไม่เบื่อ</b> — ร้านห่างเมกาบางนา ~10 นาที ฝากน้องอาบแล้วแวะห้างรอรับได้พอดี
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>อาบ + ฝากจบที่เดียว</b> — เดินทางไปเที่ยวก็ฝากต่อได้เลย ไม่ต้องพาน้องไปหลายร้าน
          </span>
        </li>
      </ul>

      {/* ราคา */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">💰 ราคาเริ่มต้น</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          ["อาบน้ำ-เป่าขน", "เริ่ม 400.-", "ตามพันธุ์และขนาดตัว"],
          ["อาบน้ำ+ขจัดคราบมัน", "เริ่ม 500.-", "ขนมันเหนียว เส้นจับตัว"],
          ["Advance (พรีเมียม/เชื้อรา)", "เริ่ม 700.-", "Catcha Premium / Malaseb"],
        ].map(([name, price, desc]) => (
          <div key={name} className="rounded-catcha border border-catcha-line bg-card p-4 text-center">
            <p className="text-sm font-extrabold text-catcha-chocolate">{name}</p>
            <p className="mt-1 text-lg font-extrabold text-latte-deep">{price}</p>
            <p className="text-[11px] text-brown-soft">{desc}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs">
        <Link href="/cat-bath" className="font-bold text-latte-deep underline">
          ดูตารางราคาเต็มทุกสายพันธุ์ ทุกขนาดตัว →
        </Link>
      </p>

      {/* เมนูรูป */}
      <div className="mt-6">
        <a href="/catalog/grooming/bath-menu.jpg" target="_blank" rel="noopener noreferrer">
          <Image
            src="/catalog/grooming/bath-menu.jpg"
            alt="เมนูราคาอาบน้ำแมว โซนบางนา ศรีนครินทร์ พัฒนาการ CatCha Hotel"
            width={900}
            height={900}
            sizes="(max-width: 640px) 100vw, 640px"
            className="h-auto w-full rounded-catcha border border-catcha-line shadow-catcha-sm"
          />
        </a>
      </div>

      {/* FAQ โซน */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">
        ❓ คำถามจากลูกค้าโซนบางนา–พัฒนาการ
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
        <h2 className="text-lg font-extrabold text-catcha-chocolate">จองคิวอาบน้ำ Private 🧡</h2>
        <p className="mt-1 text-xs text-brown-soft">
          แจ้งพันธุ์ + น้ำหนักน้อง เดี๋ยวพี่เลี้ยงแจ้งราคาและคิวว่างทันทีค่ะ
        </p>
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
          <Link href="/cat-hotel-bangna" className="font-bold text-latte-deep underline">
            🏨 หาโรงแรมแมวโซนบางนาด้วย? →
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
