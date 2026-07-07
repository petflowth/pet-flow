import Image from "next/image";

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-catcha-line bg-[#fbf3e0] shadow-catcha-sm"
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.jpg"
        alt="CatCha Hotel"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority
      />
    </div>
  );
}
