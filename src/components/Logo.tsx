"use client";

import Image from "next/image";
import { useConfig } from "@/components/ConfigProvider";

export function Logo({ size = 48 }: { size?: number }) {
  const { config } = useConfig();
  const src = config.branding?.logoUrl || "/logo.jpg";

  return (
    <div
      className="overflow-hidden rounded-2xl border border-petflow-line bg-cream shadow-petflow-sm"
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt="PetFlow"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        unoptimized={src.startsWith("data:")}
        priority
      />
    </div>
  );
}
