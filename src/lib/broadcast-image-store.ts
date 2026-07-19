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

export async function storeBroadcastImage(dataUrl: string): Promise<string> {
  const { buffer, contentType } = parseDataUrl(dataUrl);
  const id = randomUUID();
  const base64 = buffer.toString("base64");

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("broadcast_images").insert({
      id,
      tenant_id: requireTenantId(),
      data: base64,
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

  const image: BroadcastImage = {
    buffer: Buffer.from(data.data, "base64"),
    contentType: data.content_type,
  };
  memory.set(id, image);
  return image;
}
