"use client";

import { Suspense } from "react";
import { LinkLineContent } from "./LinkLineContent";

export default function LinkLinePage() {
  return (
    <Suspense
      fallback={
        <p className="px-4 py-10 text-center text-sm text-brown-soft">
          กำลังโหลด…
        </p>
      }
    >
      <LinkLineContent />
    </Suspense>
  );
}
