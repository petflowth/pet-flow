"use client";

function toHex(n: number) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** ความอิ่มตัว/สว่างของสี (0-1) — ใช้กรองสีขาว/ดำ/เทาที่มักเป็นพื้นหลังโลโก้ ไม่ใช่สีแบรนด์ */
function hsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

/**
 * สุ่มตัวอย่างพิกเซลของโลโก้แล้วหาสีเด่นที่สุด 3 สี (ทำในเบราว์เซอร์ล้วนๆ ผ่าน canvas)
 * คืนค่า null ถ้าดึงรูปไม่ได้ (เช่น URL ต่างโดเมนที่ไม่อนุญาต CORS)
 */
export async function extractLogoColors(
  imageUrl: string
): Promise<{ primary: string; accent: string; heading: string } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("โหลดรูปไม่ได้"));
      el.src = imageUrl;
    });

    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // จับกลุ่มสีที่ใกล้เคียงกัน (ปัดแต่ละช่อง R/G/B ลงกล่องละ 24) แล้วนับความถี่
    const buckets = new Map<string, { r: number; g: number; b: number; count: number; score: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 200) continue; // โปร่งใส — ข้าม
      const { s, l } = hsl(r, g, b);
      if (l < 0.08 || l > 0.94) continue; // ดำ/ขาวสนิท — มักเป็นพื้นหลัง ไม่ใช่สีแบรนด์
      const key = `${Math.round(r / 24)}_${Math.round(g / 24)}_${Math.round(b / 24)}`;
      const cur = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0, score: 0 };
      cur.r += r;
      cur.g += g;
      cur.b += b;
      cur.count += 1;
      // ให้น้ำหนักสีที่อิ่มตัวสูง (สีสด) มากกว่าสีจางๆ ถึงจะพบไม่บ่อยเท่า
      cur.score += 0.4 + s * 1.6;
      buckets.set(key, cur);
    }

    const ranked = Array.from(buckets.values())
      .map((c) => ({ r: c.r / c.count, g: c.g / c.count, b: c.b / c.count, weight: c.count * c.score }))
      .sort((a, b) => b.weight - a.weight);

    if (ranked.length === 0) return null;

    // เลือกสีที่ห่างกันพอสมควร กันได้สีที่แทบซ้ำกันมาทั้ง 3 ช่อง
    const distinct: typeof ranked = [];
    const minDist = 60;
    for (const c of ranked) {
      const tooClose = distinct.some(
        (d) => Math.abs(d.r - c.r) + Math.abs(d.g - c.g) + Math.abs(d.b - c.b) < minDist
      );
      if (!tooClose) distinct.push(c);
      if (distinct.length >= 3) break;
    }
    while (distinct.length < 3 && ranked.length > 0) {
      distinct.push(ranked[distinct.length % ranked.length]);
    }

    const hexes = distinct.map((c) => rgbToHex(c.r, c.g, c.b));
    // heading ใช้ตัวที่มืดสุด (อ่านง่ายเป็นตัวหนังสือ), primary/accent ใช้อีกสองสีที่สดสุด
    const byLightness = distinct
      .map((c, i) => ({ i, l: hsl(c.r, c.g, c.b).l }))
      .sort((a, b) => a.l - b.l);
    const headingIdx = byLightness[0].i;
    const rest = [0, 1, 2].filter((i) => i !== headingIdx);

    return {
      heading: hexes[headingIdx],
      primary: hexes[rest[0]],
      accent: hexes[rest[1]],
    };
  } catch {
    return null;
  }
}
