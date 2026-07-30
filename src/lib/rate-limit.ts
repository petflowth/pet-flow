/**
 * จำกัดจำนวนครั้งที่ยิงเข้ามาได้ต่อช่วงเวลา — กันเดารหัสหลังบ้าน และกันกดรัวจนระบบช้า
 *
 * เก็บในหน่วยความจำของอินสแตนซ์ที่รับ request นั้น ไม่ได้แชร์กันข้ามอินสแตนซ์
 * บน Vercel ที่สเกลหลายตัว คนยิงจึงอาจได้โควตามากกว่าที่ตั้งไว้ตามจำนวนอินสแตนซ์
 * — พอสำหรับกันกดรัว/เดารหัสแบบทั่วไป แต่ไม่ใช่เกราะกันโจมตีแบบกระจาย
 * ถ้าต้องการแน่นกว่านี้ต้องย้าย counter ไปไว้ที่ Redis/Upstash
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

/** ล้างของเก่าเป็นระยะ กันหน่วยความจำโตไปเรื่อยๆ จาก IP ที่ไม่กลับมาอีก */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** วินาทีที่ต้องรอก่อนลองใหม่ (เมื่อ ok = false) */
  retryAfter: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const cur = buckets.get(key);

  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  cur.count += 1;
  if (cur.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: limit - cur.count, retryAfter: 0 };
}

/** ผู้เรียกคนนี้คือใคร — ใช้ IP จริงหลัง proxy ของ Vercel */
export function clientKey(req: {
  headers: { get(name: string): string | null };
}): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** ล้างทั้งหมด — ใช้ในเทสต์เท่านั้น */
export function __resetRateLimits() {
  buckets.clear();
}
