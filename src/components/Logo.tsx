import Image from "next/image";

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-petflow-line bg-[#fbf3e0] shadow-petflow-sm"
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.jpg"
        alt="PetFlow"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority
      />
    </div>
  );
}
