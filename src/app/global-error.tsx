"use client";

import "./globals.css";
import { ErrorScreen } from "@/components/ErrorScreen";

/** พังตั้งแต่ layout บนสุด — ต้องมี <html>/<body> เอง */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ background: "#fbf6ef", margin: 0 }}>
        <ErrorScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
