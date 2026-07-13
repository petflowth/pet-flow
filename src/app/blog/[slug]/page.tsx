import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog-posts";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://catcha-hotel-five.vercel.app";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    metadataBase: new URL(SITE_URL),
    title: `${post.title} | CatCha Hotel`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      locale: "th_TH",
      url: `${SITE_URL}/blog/${post.slug}`,
      siteName: "CatCha Hotel",
      title: post.title,
      description: post.description,
      publishedTime: post.datePublished,
      ...(post.cover
        ? { images: [{ url: post.cover, width: 1200, height: 800, alt: post.title }] }
        : {}),
    },
    robots: { index: true, follow: true },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: post.title,
        description: post.description,
        datePublished: post.datePublished,
        ...(post.cover ? { image: `${SITE_URL}${post.cover}` } : {}),
        inLanguage: "th",
        author: { "@type": "Organization", name: "CatCha Hotel" },
        publisher: { "@type": "Organization", name: "CatCha Hotel" },
        mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
      },
      {
        "@type": "FAQPage",
        mainEntity: post.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  const others = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Link href="/blog" className="text-xs font-bold text-brown-soft">
        ← บทความทั้งหมด
      </Link>

      <article className="mt-3">
        {post.cover ? (
          <a href={post.cover} target="_blank" rel="noopener noreferrer">
            <Image
              src={post.cover}
              alt={post.title}
              width={1200}
              height={800}
              priority
              sizes="(max-width: 640px) 100vw, 640px"
              className="h-auto w-full rounded-catcha border border-catcha-line shadow-catcha-sm"
            />
          </a>
        ) : (
          <p className="text-4xl">{post.emoji}</p>
        )}
        <h1 className="mt-3 text-2xl font-extrabold leading-snug text-catcha-chocolate">
          {post.title}
        </h1>
        <p className="mt-2 text-[11px] font-bold text-brown-faint">
          โดย CatCha Hotel · อ่าน {post.readMinutes} นาที
        </p>

        <div className="mt-5 space-y-4">
          {post.blocks.map((block, i) => {
            if (block.type === "h2") {
              return (
                <h2 key={i} className="pt-2 text-lg font-extrabold text-catcha-chocolate">
                  {block.text}
                </h2>
              );
            }
            if (block.type === "ul") {
              return (
                <ul key={i} className="space-y-2 pl-1">
                  {block.items.map((item, j) => (
                    <li key={j} className="flex gap-2 text-sm leading-relaxed text-brown">
                      <span className="shrink-0 text-latte-deep">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-sm leading-relaxed text-brown">
                {block.text}
              </p>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-8">
          <h2 className="text-lg font-extrabold text-catcha-chocolate">❓ คำถามที่พบบ่อย</h2>
          <div className="mt-3 space-y-3">
            {post.faqs.map((f, i) => (
              <div key={i} className="rounded-catcha border border-catcha-line bg-card p-4">
                <p className="text-sm font-extrabold text-catcha-chocolate">{f.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-brown-soft">{f.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 rounded-catcha bg-gradient-to-br from-honey/30 via-card to-latte/15 p-5 text-center shadow-catcha">
          <p className="text-sm font-extrabold text-catcha-chocolate">
            🐱 CatCha Hotel — โรงแรมแมว & อาบน้ำแมว
          </p>
          <p className="mt-1 text-xs text-brown-soft">
            ย่านเทพารักษ์–หนามแดง ใกล้บางนา ศรีนครินทร์ เมกาบางนา · เริ่มคืนละ 350.-
          </p>
          <a
            href="https://line.me/R/ti/p/@catchahotel"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block rounded-catcha-sm bg-latte-deep px-6 py-2.5 text-sm font-extrabold text-card"
          >
            💬 ทัก LINE จองคิว / สอบถาม
          </a>
          <p className="mt-2 text-[11px]">
            <Link href="/" className="font-bold text-latte-deep underline">
              ดูราคาห้องพัก + บริการทั้งหมด →
            </Link>
          </p>
        </div>
      </article>

      {/* บทความอื่น */}
      {others.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-extrabold text-catcha-chocolate">อ่านต่อ</h2>
          <div className="mt-3 space-y-2">
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="block rounded-catcha-sm border border-catcha-line bg-card px-4 py-3 text-sm font-bold text-brown transition hover:border-honey/60"
              >
                {p.emoji} {p.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
