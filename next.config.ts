import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // schema.sql ถูกอ่านตอนรัน (ปุ่ม "สร้างตารางอัตโนมัติ" / "Copy SQL" ในหน้าติดตั้ง)
  // ถ้าไม่บอกไว้ตรงนี้ ไฟล์จะไม่ถูก deploy ไปด้วย แล้วปุ่มจะพังบนเครื่องจริง
  outputFileTracingIncludes: {
    "/api/setup": ["./supabase/schema.sql"],
    "/admin/setup": ["./supabase/schema.sql"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "profile.line-scdn.net",
      },
    ],
  },
};

export default nextConfig;
