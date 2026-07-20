"use client";

import { useConfig } from "@/components/ConfigProvider";
import { darkenHex, hexToRgbTriplet, isValidHex } from "@/lib/color-utils";

/**
 * ฉีดสีประจำร้าน (จาก config.branding) ทับ CSS var เริ่มต้นใน globals.css
 * ให้อยู่ใต้ ConfigProvider เท่านั้น — ไม่ตั้งค่าเอง = ใช้โทนสีเริ่มต้นของ PetFlow ต่อไป
 */
export function BrandingStyle() {
  const { config } = useConfig();
  const b = config.branding;
  if (!b || !isValidHex(b.primary) || !isValidHex(b.accent) || !isValidHex(b.heading)) {
    return null;
  }

  const vars = {
    "--honey-rgb": hexToRgbTriplet(b.accent),
    "--honey-deep-rgb": hexToRgbTriplet(darkenHex(b.accent, 0.12)),
    "--latte-rgb": hexToRgbTriplet(darkenHex(b.primary, -0.25)),
    "--latte-deep-rgb": hexToRgbTriplet(b.primary),
    "--chocolate-rgb": hexToRgbTriplet(b.heading),
  };

  const css = `:root { ${Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ")} }`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
