import { getSupabase } from "./server";

const BUCKET = "media";

function parseDataUrl(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1];
  const ext = mime.split("/")[1]?.split("+")[0]?.slice(0, 10) || "bin";
  return { mime, ext, buffer: Buffer.from(m[2], "base64") };
}

let bucketReady: Promise<void> | null = null;

/** สร้าง bucket "media" ครั้งแรกที่ใช้งาน (public, ไว้เก็บรูป/วิดีโอแมว) — เงียบถ้าสร้างไม่ได้ (เช่นมีอยู่แล้ว) */
function ensureBucket(sb: ReturnType<typeof getSupabase>) {
  if (!sb) return Promise.resolve();
  if (!bucketReady) {
    bucketReady = sb.storage
      .createBucket(BUCKET, { public: true, fileSizeLimit: "25MB" })
      .then(
        () => {},
        () => {}
      );
  }
  return bucketReady;
}

/**
 * อัปโหลด data URL (base64) ขึ้น Supabase Storage แทนที่จะเก็บ base64 ยัดในฐานข้อมูลตรงๆ
 * คืน public URL ถ้าอัปสำเร็จ — ถ้าอัปไม่ได้ (ยังไม่ตั้งค่า Supabase, bucket พัง ฯลฯ)
 * คืน data URL เดิมกลับไปเหมือนก่อนหน้านี้ กันไม่ให้ฟีเจอร์พัง (graceful degrade)
 */
export async function uploadDataUrlToStorage(
  path: string,
  dataUrl: string
): Promise<string> {
  if (!dataUrl.startsWith("data:")) return dataUrl; // เป็น URL อยู่แล้ว (อัปไปแล้วก่อนหน้า) ไม่ต้องทำซ้ำ
  const sb = getSupabase();
  if (!sb) return dataUrl;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl;

  await ensureBucket(sb);
  const fullPath = `${path}.${parsed.ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(fullPath, parsed.buffer, {
    contentType: parsed.mime,
    upsert: true,
  });
  if (error) return dataUrl;

  const { data } = sb.storage.from(BUCKET).getPublicUrl(fullPath);
  return data.publicUrl || dataUrl;
}
