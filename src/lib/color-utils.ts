/** แปลง hex ("#a9855f") → "169 133 95" สำหรับใช้กับ rgb(var(--x) / <alpha-value>) ของ Tailwind */
export function hexToRgbTriplet(hex: string): string {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `${r} ${g} ${b}`;
}

/** ทำให้สีเข้มขึ้น (ใช้ทำเฉด "deep" จากสีหลักที่ร้านเลือกสีเดียว) */
export function darkenHex(hex: string, amount = 0.15): string {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const r = Math.round((parseInt(full.slice(0, 2), 16) || 0) * (1 - amount));
  const g = Math.round((parseInt(full.slice(2, 4), 16) || 0) * (1 - amount));
  const b = Math.round((parseInt(full.slice(4, 6), 16) || 0) * (1 - amount));
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(hex.trim());
}
