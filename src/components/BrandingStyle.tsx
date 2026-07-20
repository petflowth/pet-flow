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
  const colors = [b?.primary, b?.accent, b?.heading, b?.background, b?.surface, b?.text];
  if (!b || colors.some((c) => !c || !isValidHex(c))) {
    return null;
  }

  const vars = {
    // ปุ่ม/ไฮไลท์ — มาจากสีหลัก/สีไฮไลท์
    "--honey-rgb": hexToRgbTriplet(b.accent),
    "--honey-deep-rgb": hexToRgbTriplet(darkenHex(b.accent, 0.12)),
    "--latte-rgb": hexToRgbTriplet(darkenHex(b.primary, -0.25)),
    "--latte-deep-rgb": hexToRgbTriplet(b.primary),
    "--chocolate-rgb": hexToRgbTriplet(b.heading),
    // พื้นหลัง/การ์ด/เส้นขอบ — มาจากสีพื้นหลัง/พื้นการ์ด
    "--cream-rgb": hexToRgbTriplet(b.background),
    "--paper-rgb": hexToRgbTriplet(darkenHex(b.background, 0.03)),
    "--card-rgb": hexToRgbTriplet(b.surface),
    "--line-rgb": hexToRgbTriplet(darkenHex(b.background, 0.08)),
    // ตัวอักษร — มาจากสีตัวอักษรหลัก, ไล่อ่อนลงให้ soft/faint
    "--brown-rgb": hexToRgbTriplet(b.text),
    "--brown-soft-rgb": hexToRgbTriplet(darkenHex(b.text, -0.35)),
    "--brown-faint-rgb": hexToRgbTriplet(darkenHex(b.text, -0.55)),
  };

  const css = `:root { ${Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ")} }`;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
