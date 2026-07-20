import { randomUUID } from "crypto";
import { getSupabase } from "./supabase/server";
import { requireTenantId } from "./tenant-context";

export type BroadcastImage = {
  buffer: Buffer;
  contentType: string;
};

type BroadcastImageRow = {
  id: string;
  data: string;
  content_type: string;
};

const BUCKET = "media";
/** ค่าที่นำหน้าคอลัมน์ data เพื่อบอกว่าเก็บเป็น "path ใน Storage" ไม่ใช่ base64 (แถวเก่าไม่มี prefix นี้) */
const STORAGE_PREFIX = "storage:";

const memory = new Map<string, BroadcastImage>();

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("รูปไม่ถูกต้อง — อัปโหลดไฟล์ภาพใหม่");
  }
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extFromContentType(contentType: string): string {
  return contentType.split("/")[1]?.split("+")[0]?.slice(0, 10) || "bin";
}

export async function storeBroadcastImage(dataUrl: string): Promise<string> {
  const { buffer, contentType } = parseDataUrl(dataUrl);
  const id = randomUUID();

  const sb = getSupabase();
  if (sb) {
    const tenantId = requireTenantId();
    // 1) พยายามอัปขึ้น Storage ก่อน — ไม่เก็บ base64 ยัดใน DB อีกต่อไป (กัน DB บวมเต็ม 500 MB)
    const objectPath = `broadcasts/${tenantId}/${id}.${extFromContentType(contentType)}`;
    const uploaded = await sb.storage
      .from(BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true })
      .then(
        (r) => !r.error,
        () => false
      );

    if (uploaded) {
      const { error } = await sb.from("broadcast_images").insert({
        id,
        tenant_id: tenantId,
        data: `${STORAGE_PREFIX}${objectPath}`,
        content_type: contentType,
      });
      if (!error) return id;
    }

    // 2) fallback แบบเดิม — ถ้า Storage ใช้ไม่ได้ (bucket พัง/ยังไม่ตั้งค่า) ยังเก็บ base64 ใน DB ได้ ไม่ให้ฟีเจอร์พัง
    const { error } = await sb.from("broadcast_images").insert({
      id,
      tenant_id: tenantId,
      data: buffer.toString("base64"),
      content_type: contentType,
    });
    if (!error) return id;
  }

  memory.set(id, { buffer, contentType });
  return id;
}

export async function getBroadcastImage(
  id: string
): Promise<BroadcastImage | null> {
  const cached = memory.get(id);
  if (cached) return cached;

  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("broadcast_images")
    .select("id, data, content_type")
    .eq("id", id)
    .eq("tenant_id", requireTenantId())
    .maybeSingle<BroadcastImageRow>();

  if (error || !data) return null;

  let buffer: Buffer | null = null;
  if (data.data.startsWith(STORAGE_PREFIX)) {
    // รูปใหม่ — เก็บใน Storage, โหลดไฟล์จริงมาเสิร์ฟ
    const objectPath = data.data.slice(STORAGE_PREFIX.length);
    const file = await sb.storage.from(BUCKET).download(objectPath);
    if (file.error || !file.data) return null;
    buffer = Buffer.from(await file.data.arrayBuffer());
  } else {
    // รูปเก่า — base64 ใน DB (ก่อน 2026-07-20) ยังอ่านได้ปกติ
    buffer = Buffer.from(data.data, "base64");
  }

  const image: BroadcastImage = { buffer, contentType: data.content_type };
  memory.set(id, image);
  return image;
}
