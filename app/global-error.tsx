"use client";

// Reports React rendering errors to Sentry and shows a minimal fallback.
// DONE — do not modify.
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: "4rem", textAlign: "center", fontFamily: "system-ui" }}>
          <h2>Something went wrong.</h2>
          <p>The error has been reported. Try again in a moment.</p>
        </div>
      </body>
    </html>
  );
}
