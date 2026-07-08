import { NextRequest, NextResponse } from "next/server";
import { getSiteConfig, updateSiteConfig, replaceSiteConfig } from "@/lib/config-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json({ config });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();

  if (body.action === "replace" && body.config) {
    const config = await replaceSiteConfig(body.config);
    return NextResponse.json({ ok: true, config });
  }

  const config = await updateSiteConfig(body.patch || body);
  return NextResponse.json({ ok: true, config });
}
