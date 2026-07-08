import { NextRequest, NextResponse } from "next/server";
import { getBroadcastImage } from "@/lib/broadcast-image-store";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = await getBroadcastImage(id);
  if (!image) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=604800",
    },
  });
}
