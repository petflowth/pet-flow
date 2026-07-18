"use client";

import { useCallback, useEffect, useState } from "react";
import { toJpegDataUrl } from "@/lib/image-convert";
import { toast } from "@/components/Toast";

/**
 * 📝 จัดการบทความหน้าเว็บ — เพิ่ม/แก้/ลบบทความ + อัปรูปปกเอง ไม่ต้องแก้โค้ด
 * บทความโชว์รวมกับบทความ SEO เดิมที่ /blog อัตโนมัติ
 */

type Article = {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  coverUrl?: string;
  emoji: string;
  published: boolean;
  datePublished: string;
};

const EMPTY: Omit<Article, "id"> & { id?: string } = {
  slug: "",
  title: "",
  description: "",
  body: "",
  emoji: "📝",
  published: true,
  datePublished: new Date().toISOString().slice(0, 10),
};

export default function ArticlesAdminPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [coverDataUrl, setCoverDataUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const adminCode =
    typeof window !== "undefined" ? sessionStorage.getItem("catcha-admin") || "" : "";

  const load = useCallback(async () => {
    const res = await fetch("/api/articles?all=1", {
      headers: { "x-admin-code": adminCode },
    });
    const d = await res.json().catch(() => ({}));
    setArticles(d.articles || []);
    setLoaded(true);
  }, [adminCode]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setForm({ ...EMPTY, datePublished: new Date().toISOString().slice(0, 10) });
    setCoverDataUrl("");
  };
  const startEdit = (a: Article) => {
    setForm({ ...a });
    setCoverDataUrl("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const patch = (p: Partial<typeof EMPTY>) =>
    setForm((prev) => (prev ? { ...prev, ...p } : prev));

  const onCover = async (file: File) => {
    try {
      const dataUrl = await toJpegDataUrl(file, 1400);
      setCoverDataUrl(dataUrl);
    } catch {
      toast("อ่านไฟล์รูปไม่สำเร็จ", "error");
    }
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": adminCode },
        body: JSON.stringify({
          ...form,
          coverDataUrl: coverDataUrl || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("✅ บันทึกบทความแล้ว — ขึ้นหน้าเว็บภายใน ~5 นาที", "success");
        setForm(null);
        setCoverDataUrl("");
        load();
      } else {
        toast(d.error || "บันทึกไม่สำเร็จ", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Article) => {
    if (!confirm(`ลบบทความ "${a.title}"?`)) return;
    await fetch(`/api/articles?id=${a.id}`, {
      method: "DELETE",
      headers: { "x-admin-code": adminCode },
    });
    load();
  };

  const field =
    "w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm";

  if (!loaded) return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-extrabold text-catcha-chocolate">📝 บทความหน้าเว็บ</h1>
          <p className="mt-1 text-xs text-brown-soft">
            เพิ่มบทความใหม่ + รูปปกได้เอง — ขึ้นที่หน้า{" "}
            <a href="/blog" target="_blank" className="font-bold text-latte-deep underline">
              /blog
            </a>{" "}
            รวมกับบทความเดิมอัตโนมัติ
          </p>
        </div>
        {!form && (
          <button
            type="button"
            onClick={startNew}
            className="rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep px-4 py-2.5 text-xs font-extrabold text-catcha-chocolate"
          >
            ➕ เขียนบทความใหม่
          </button>
        )}
      </div>

      {form && (
        <div className="mb-5 space-y-3 rounded-catcha border border-latte/50 bg-card p-4 shadow-catcha-sm">
          <p className="text-sm font-extrabold text-catcha-chocolate">
            {form.id ? "✏️ แก้ไขบทความ" : "➕ บทความใหม่"}
          </p>
          <label className="block text-xs font-bold text-brown-soft">
            หัวข้อบทความ *
            <input
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="เช่น 5 สัญญาณว่าน้องแมวเครียด และวิธีช่วย"
              className={`${field} mt-1`}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-brown-soft">
              ชื่อลิงก์ (อังกฤษ ใช้ - คั่น) *
              <input
                value={form.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder="cat-stress-signs"
                className={`${field} mt-1 font-mono`}
              />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              วันที่เผยแพร่
              <input
                type="date"
                value={form.datePublished}
                onChange={(e) => patch({ datePublished: e.target.value })}
                className={`${field} mt-1`}
              />
            </label>
          </div>
          <label className="block text-xs font-bold text-brown-soft">
            คำโปรย (โชว์ใต้หัวข้อ + ใช้เป็น SEO description)
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={2}
              className={`${field} mt-1`}
            />
          </label>
          <label className="block text-xs font-bold text-brown-soft">
            เนื้อหา *
            <textarea
              value={form.body}
              onChange={(e) => patch({ body: e.target.value })}
              rows={12}
              placeholder={"พิมพ์เนื้อหาตรงนี้…\n\n## หัวข้อย่อย\n\nย่อหน้าใหม่ = เว้นบรรทัดว่าง 1 บรรทัด\n\n- รายการข้อ 1\n- รายการข้อ 2"}
              className={`${field} mt-1 leading-relaxed`}
            />
            <span className="mt-1 block text-[10px] font-normal text-brown-faint">
              💡 เว้นบรรทัดว่าง = ย่อหน้าใหม่ · ขึ้นต้น <b>##</b> = หัวข้อย่อย · ขึ้นต้น <b>-</b> = รายการ
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold text-brown-soft">
              🖼️ รูปปก (อัปโหลดใหม่)
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onCover(f);
                }}
                className="mt-1 block w-full text-[11px]"
              />
              {(coverDataUrl || form.coverUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverDataUrl || form.coverUrl}
                  alt="ปก"
                  className="mt-2 h-24 w-full rounded-catcha-sm object-cover"
                />
              )}
            </label>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-brown-soft">
                อิโมจิ (โชว์ถ้าไม่มีรูปปก)
                <input
                  value={form.emoji}
                  onChange={(e) => patch({ emoji: e.target.value })}
                  className={`${field} mt-1 w-20 text-center`}
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-brown">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => patch({ published: e.target.checked })}
                  className="h-4 w-4 accent-[#4A7348]"
                />
                เผยแพร่ (ติ๊กออก = เก็บเป็นฉบับร่าง)
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving || !form.title.trim() || !form.slug.trim()}
              onClick={save}
              className="flex-1 rounded-catcha-sm bg-latte-deep py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
            >
              {saving ? "กำลังบันทึก…" : "💾 บันทึกบทความ"}
            </button>
            <button
              type="button"
              onClick={() => setForm(null)}
              className="rounded-catcha-sm bg-paper px-4 py-2.5 text-xs font-bold text-brown-soft"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {articles.length === 0 && (
          <p className="rounded-catcha bg-card p-6 text-center text-sm text-brown-soft">
            ยังไม่มีบทความที่เขียนเอง — กด &quot;เขียนบทความใหม่&quot; ได้เลย
            (บทความ SEO ชุดเดิมยังโชว์ที่ /blog ตามปกติ)
          </p>
        )}
        {articles.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between gap-3 rounded-catcha-sm border border-catcha-line bg-card p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-brown">
                {a.emoji} {a.title}
                {!a.published && (
                  <span className="ml-2 rounded-full bg-wait/15 px-2 py-0.5 text-[9px] font-bold text-wait">
                    ฉบับร่าง
                  </span>
                )}
              </p>
              <p className="truncate text-[11px] text-brown-soft">
                /blog/{a.slug} · {a.datePublished}
              </p>
            </div>
            <a
              href={`/blog/${a.slug}`}
              target="_blank"
              className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-latte-deep"
            >
              👁️ ดู
            </a>
            <button
              type="button"
              onClick={() => startEdit(a)}
              className="shrink-0 rounded-full bg-honey/25 px-2.5 py-1 text-[10px] font-bold text-catcha-chocolate"
            >
              ✏️ แก้ไข
            </button>
            <button
              type="button"
              onClick={() => remove(a)}
              className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-wait"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
