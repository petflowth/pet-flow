/**
 * บทความ SEO ที่ฝังมากับระบบ (seed) — เริ่มต้นว่าง ให้ร้านเขียนเองจากหลังบ้าน (/admin/articles)
 * โครงสร้าง BlogPost ยังใช้ร่วมกับระบบบทความหลังบ้าน อย่าลบ type ออก
 */

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  datePublished: string; // YYYY-MM-DD
  readMinutes: number;
  emoji: string;
  /** รูปปกบทความ (ถ้ามี) — โชว์หัวบทความ + การ์ดหน้ารวม + og:image */
  cover?: string;
  blocks: BlogBlock[];
  faqs: { q: string; a: string }[];
};

export const BLOG_POSTS: BlogPost[] = [];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
