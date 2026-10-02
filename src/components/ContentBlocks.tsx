import Image from "next/image";
import type { BoardingRuleBlock } from "@/lib/config-types";

/**
 * เรนเดอร์บล็อกเนื้อหา (รูป/ข้อความ) ที่ร้านเพิ่มเองในหลังบ้าน — ใช้ร่วมกันทั้งหน้า SEO
 * สาธารณะและหน้าในแอปลูกค้า ไม่มี hook จึงเรียกจาก server component ได้ด้วย
 */
export function ContentBlocks({ blocks }: { blocks?: BoardingRuleBlock[] }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div className="mt-6 space-y-4">
      {blocks.map((b) => (
        <div
          key={b.id}
          className="rounded-petflow border border-petflow-line bg-card p-4 shadow-petflow-sm"
        >
          {b.image && (
            <Image
              src={b.image}
              alt=""
              width={800}
              height={500}
              sizes="(max-width: 640px) 100vw, 600px"
              className="mb-3 h-auto w-full rounded-petflow-sm object-cover"
              unoptimized
            />
          )}
          {b.text && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-brown">{b.text}</p>
          )}
        </div>
      ))}
    </div>
  );
}
