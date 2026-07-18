import { getSupabase } from "./supabase/server";
import { uploadDataUrlToStorage } from "./supabase/storage";
import type { BlogBlock } from "./blog-posts";

/**
 * บทความที่ร้านเขียนเองจากหลังบ้าน — โชว์รวมกับบทความ SEO เดิมในหน้า /blog
 * เนื้อหาเป็นข้อความธรรมดา: เว้นบรรทัดว่าง = ย่อหน้าใหม่ · "## " = หัวข้อ · "- " = รายการ
 */

export type ArticleRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  coverUrl?: string;
  emoji: string;
  published: boolean;
  datePublished: string;
  createdAt: string;
};

type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  body: string | null;
  cover_url: string | null;
  emoji: string | null;
  published: boolean;
  date_published: string | null;
  created_at: string;
};

// dev (ไม่มี Supabase): แชร์ array เดียวกันข้าม bundle ของ API route กับหน้าเพจ
const globalMem = globalThis as unknown as { __catchaArticlesMem?: ArticleRecord[] };
const mem: ArticleRecord[] = (globalMem.__catchaArticlesMem ||= []);

function rowToArticle(r: ArticleRow): ArticleRecord {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description || "",
    body: r.body || "",
    coverUrl: r.cover_url || undefined,
    emoji: r.emoji || "📝",
    published: r.published !== false,
    datePublished: r.date_published || r.created_at.slice(0, 10),
    createdAt: r.created_at,
  };
}

export async function listArticles(includeDrafts = false): Promise<ArticleRecord[]> {
  const sb = getSupabase();
  let list: ArticleRecord[];
  if (sb) {
    try {
      const { data, error } = await sb
        .from("articles")
        .select("*")
        .order("date_published", { ascending: false });
      if (error) return [];
      list = ((data as ArticleRow[] | null) || []).map(rowToArticle);
    } catch {
      return [];
    }
  } else {
    list = [...mem].sort((a, b) => b.datePublished.localeCompare(a.datePublished));
  }
  return includeDrafts ? list : list.filter((a) => a.published);
}

export async function getArticleBySlug(slug: string): Promise<ArticleRecord | null> {
  const all = await listArticles(true);
  return all.find((a) => a.slug === slug && a.published) || null;
}

export async function saveArticle(data: {
  id?: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  coverDataUrl?: string;
  coverUrl?: string;
  emoji?: string;
  published?: boolean;
  datePublished?: string;
}): Promise<{ ok: true; article: ArticleRecord } | { ok: false; error: string }> {
  const slug = data.slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const title = data.title.trim();
  if (!slug || !title) return { ok: false, error: "missing_fields" };

  const existing = await listArticles(true);
  const dup = existing.find((a) => a.slug === slug && a.id !== data.id);
  if (dup) return { ok: false, error: "slug_in_use" };

  // รูปปก: อัปโหลดเป็นไฟล์ใน Storage (ไม่ยัด base64 ลงฐานข้อมูล)
  let coverUrl = data.coverUrl;
  if (data.coverDataUrl?.startsWith("data:")) {
    const uploaded = await uploadDataUrlToStorage(
      `articles/${slug}-${Date.now()}`,
      data.coverDataUrl
    );
    if (!uploaded.startsWith("data:")) coverUrl = uploaded;
  }

  const prev = data.id ? existing.find((a) => a.id === data.id) : undefined;
  const article: ArticleRecord = {
    id: data.id || `AR${Date.now()}`,
    slug,
    title,
    description: data.description.trim(),
    body: data.body,
    coverUrl: coverUrl ?? prev?.coverUrl,
    emoji: (data.emoji || prev?.emoji || "📝").trim() || "📝",
    published: data.published ?? prev?.published ?? true,
    datePublished:
      data.datePublished || prev?.datePublished || new Date().toISOString().slice(0, 10),
    createdAt: prev?.createdAt || new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("articles").upsert({
        id: article.id,
        slug: article.slug,
        title: article.title,
        description: article.description,
        body: article.body,
        cover_url: article.coverUrl || null,
        emoji: article.emoji,
        published: article.published,
        date_published: article.datePublished,
        created_at: article.createdAt,
      });
      if (error) return { ok: false, error: "need_sql" };
    } catch {
      return { ok: false, error: "need_sql" };
    }
  } else {
    const i = mem.findIndex((a) => a.id === article.id);
    if (i >= 0) mem[i] = article;
    else mem.unshift(article);
  }
  return { ok: true, article };
}

export async function deleteArticle(id: string) {
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from("articles").delete().eq("id", id);
    } catch {
      /* ตารางยังไม่มี */
    }
  } else {
    const i = mem.findIndex((a) => a.id === id);
    if (i >= 0) mem.splice(i, 1);
  }
  return { ok: true as const };
}

/** แปลงบล็อก (บทความ SEO เดิม) → ข้อความธรรมดาให้แก้ในหลังบ้านได้ (ผกผันกับ articleBodyToBlocks) */
export function blocksToText(blocks: BlogBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "h2") return `## ${b.text}`;
      if (b.type === "ul") return b.items.map((i) => `- ${i}`).join("\n");
      return b.text;
    })
    .join("\n\n");
}

/** แปลงเนื้อหาข้อความธรรมดา → บล็อกแบบเดียวกับบทความ SEO เดิม */
export function articleBodyToBlocks(body: string): BlogBlock[] {
  const blocks: BlogBlock[] = [];
  for (const chunk of body.split(/\n\s*\n/)) {
    const t = chunk.trim();
    if (!t) continue;
    if (t.startsWith("## ")) {
      blocks.push({ type: "h2", text: t.slice(3).trim() });
    } else if (
      t.split("\n").length > 0 &&
      t.split("\n").every((l) => l.trim().startsWith("- "))
    ) {
      blocks.push({
        type: "ul",
        items: t.split("\n").map((l) => l.trim().slice(2).trim()),
      });
    } else {
      blocks.push({ type: "p", text: t });
    }
  }
  return blocks;
}
