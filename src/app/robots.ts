import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo-software-pages";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // หน้าแอปสมาชิก/หลังบ้าน ไม่ต้อง index — ให้บอทโฟกัสหน้าเว็บหลัก
        disallow: ["/admin", "/api", "/app", "/doc", "/platform"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
