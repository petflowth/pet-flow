"use client";

import { Suspense } from "react";
import { LinkLineContent } from "./LinkLineContent";
import { LoadingScreen } from "@/components/LoadingScreen";

export default function LinkLinePage() {
  return (
    <Suspense
      fallback={<LoadingScreen />}
    >
      <LinkLineContent />
    </Suspense>
  );
}
