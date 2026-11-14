import type { Metadata } from "next";
import { SalonShell } from "@/components/salon/SalonShell";

export const metadata: Metadata = {
  title: "ร้านทำผม",
  robots: { index: false },
};

export default function SalonLayout({ children }: { children: React.ReactNode }) {
  return <SalonShell>{children}</SalonShell>;
}
