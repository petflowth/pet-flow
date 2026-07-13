import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BLOG_POSTS } from "@/lib/blog-posts";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catchahotel.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "บทความน่ารู้เรื่องแมว | ฝากแมว อาบน้ำแมว ดูแลแมว — CatCha Hotel บางนา เทพารักษ์",
  description:
    "รวมบทความจากโรงแรมแมว CatCha Hotel — ฝากแมวครั้งแรกเตรียมอะไร แมวอาบน้ำบ่อยแค่ไหน วิธีเลือกโรงแรมแมว และเคล็ดลับดูแลน้องแมว สำหรับทาสแมวย่านบางนา เทพารักษ์ สมุทรปราการ",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}/blog`,
    siteName: "CatCha Hotel",
    title: "บทความน่ารู้เรื่องแมว — CatCha Hotel",
    description: "เคล็ดลับฝากแมว อาบน้ำแมว และดูแลน้องแมว จากพี่เลี้ยงตัวจริง",
  },
  robots: { index: true, follow: true },
};

export default function BlogIndexPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <Link href="/" className="text-xs font-bold text-brown-soft">
        ← หน้าแรก CatCha Hotel
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold text-catcha-chocolate">
        📚 บทความน่ารู้เรื่องแมว
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        เคล็ดลับฝากแมว อาบน้ำแมว และการดูแลน้องแมว เขียนจากประสบการณ์จริงของพี่เลี้ยง
        CatCha Hotel โรงแรมแมวย่านบางนา–เทพารักษ์ สมุทรปราการ
      </p>

      <div className="mt-6 space-y-4">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm transition hover:border-honey/60"
          >
            {post.cover && (
              <Image
                src={post.cover}
                alt={post.title}
                width={1200}
                height={800}
                sizes="(max-width: 640px) 100vw, 640px"
                className="h-auto w-full"
              />
            )}
            <div className="p-5">
            {!post.cover && <p className="text-3xl">{post.emoji}</p>}
            <h2 className="mt-2 text-base font-extrabold leading-snug text-catcha-chocolate">
              {post.title}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-brown-soft">{post.description}</p>
            <p className="mt-3 text-[11px] font-bold text-latte-deep">
              อ่านต่อ ({post.readMinutes} นาที) →
            </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-catcha bg-gradient-to-br from-honey/30 via-card to-latte/15 p-5 text-center shadow-catcha">
        <p className="text-sm font-extrabold text-catcha-chocolate">
          🐱 ฝากแมว / อาบน้ำแมว ย่านบางนา เทพารักษ์
        </p>
        <p className="mt-1 text-xs text-brown-soft">
          ห้องแอร์ส่วนตัว CCTV 24 ชม. รายงานเช้า-เย็นทุกวัน
        </p>
        <a
          href="https://line.me/R/ti/p/@catchahotel"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-catcha-sm bg-latte-deep px-6 py-2.5 text-sm font-extrabold text-card"
        >
          💬 ทัก LINE จองคิวเลย
        </a>
      </div>
    </main>
  );
}
