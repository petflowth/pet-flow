"use client";

import { useState } from "react";
import { toJpegDataUrl } from "@/lib/image-convert";
import type { CatRecord, CatMediaItem } from "@/lib/customers-store";

const MAX_VIDEO_BYTES = 15 * 1024 * 1024; // 15MB — เก็บเป็น base64 ตรงๆ ไม่ผ่าน storage แยก

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

/**
 * อัลบั้มรูป/วิดีโออ้างอิงต่อแมว — เก็บหลังบ้านเท่านั้น ลูกค้าไม่เห็น
 * (คนละส่วนกับ "รูปโปรไฟล์" ด้านบนที่ลูกค้าเห็นในแอป)
 */
export function CatMediaGallery({
  customerId,
  cat,
  onSaved,
}: {
  customerId: string;
  cat: CatRecord;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needSql, setNeedSql] = useState(false);
  const media = cat.media || [];

  const save = async (next: CatMediaItem[]) => {
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customerId,
        action: "update_cat_media",
        catId: cat.id,
        media: next,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.needSql) {
      setNeedSql(true);
      return false;
    }
    if (!res.ok || !data?.ok) {
      setError("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง");
      return false;
    }
    return true;
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError("");
    const added: CatMediaItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const isVideo = file.type.startsWith("video/");
        if (isVideo) {
          if (file.size > MAX_VIDEO_BYTES) {
            setError(`${file.name}: วิดีโอใหญ่เกิน 15MB — ลองคลิปสั้นลงนะคะ`);
            continue;
          }
          const dataUrl = await fileToDataUrl(file);
          added.push({
            id: `M${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            type: "video",
            dataUrl,
            createdAt: new Date().toISOString(),
          });
        } else {
          const dataUrl = await toJpegDataUrl(file, 1200);
          added.push({
            id: `M${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
            type: "photo",
            dataUrl,
            createdAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : `${file.name}: อัปโหลดไม่สำเร็จ`);
      }
    }
    if (added.length > 0) {
      const ok = await save([...media, ...added]);
      if (ok) onSaved();
    }
    setBusy(false);
  };

  const removeItem = async (id: string) => {
    setBusy(true);
    const ok = await save(media.filter((m) => m.id !== id));
    setBusy(false);
    if (ok) onSaved();
  };

  const setCaption = async (id: string, caption: string) => {
    const next = media.map((m) => (m.id === id ? { ...m, caption } : m));
    await save(next);
  };

  return (
    <div className="mt-2 rounded-petflow-sm border border-latte/40 bg-honey/5 p-2.5">
      <p className="text-[10px] font-bold text-petflow-chocolate">
        🖼️ อัลบั้มหลังบ้าน (รูป/วิดีโอ — ลูกค้าไม่เห็น)
      </p>
      <p className="mt-0.5 text-[9px] text-brown-faint">
        เก็บไว้ดูหน้าตา/นิสัยน้อง เช่น ตอนอาบน้ำดื้อไหม อัปได้หลายไฟล์ วิดีโอไม่เกิน 15MB/คลิป
      </p>

      {needSql && (
        <p className="mt-1.5 rounded-petflow-sm bg-wait/10 px-2 py-1.5 text-[10px] font-bold text-wait">
          ยังบันทึกไม่ได้ — ต้องอัปเดตฐานข้อมูลก่อน (ตั้งค่า → ขั้นสูง → อัปเดตฐานข้อมูล)
        </p>
      )}
      {error && (
        <p className="mt-1.5 rounded-petflow-sm bg-wait/10 px-2 py-1.5 text-[10px] font-bold text-wait">
          😿 {error}
        </p>
      )}

      {media.length > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {media.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-petflow-sm border border-petflow-line bg-card">
              {m.type === "video" ? (
                <video src={m.dataUrl} controls className="h-24 w-full bg-black object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.dataUrl} alt="" className="h-24 w-full object-cover" />
              )}
              <input
                defaultValue={m.caption || ""}
                placeholder="โน้ตสั้นๆ เช่น ตอนอาบดื้อมาก"
                onBlur={(e) => setCaption(m.id, e.target.value)}
                className="w-full border-t border-petflow-line bg-paper px-1.5 py-1 text-[9px] outline-none"
              />
              <button
                type="button"
                onClick={() => removeItem(m.id)}
                disabled={busy}
                className="w-full bg-wait/10 py-1 text-[9px] font-bold text-wait disabled:opacity-50"
              >
                ✕ ลบ
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="mt-2 block">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={busy}
          className="block w-full text-[10px]"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {busy && <span className="text-[9px] text-brown-faint">กำลังอัป…</span>}
      </label>
    </div>
  );
}
