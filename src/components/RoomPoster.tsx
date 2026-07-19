import Image from "next/image";

/** แสดงโปสเตอร์ห้องเต็มใบ — ไม่ crop; ถ้ายังไม่มีรูป (ร้านยังไม่อัปโหลด) โชว์ placeholder แทน */
export function RoomPoster({
  src,
  alt,
  priority,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex aspect-[3/4] items-center justify-center overflow-hidden rounded-petflow border border-petflow-line bg-paper text-4xl ${className}`}
        aria-label={alt}
      >
        🐾
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-petflow border border-petflow-line bg-paper ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={1200}
        height={1600}
        priority={priority}
        className="h-auto w-full object-contain"
        sizes="(max-width: 512px) 100vw, 480px"
      />
    </div>
  );
}
