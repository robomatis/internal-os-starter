import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Invoice uploads (photos / PDFs) exceed the 1 MB Server Action default body limit.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // pdfkit (ponudbe PDF generation) ships its own font data files — keep it external
  // so the bundler doesn't try to inline them.
  serverExternalPackages: ["pdfkit"],
  // Make sure the bundled DejaVu fonts (Slovenian glyphs for the quote PDF) ship with
  // the serverless function on Vercel — they're read from disk at runtime.
  outputFileTracingIncludes: {
    "/m/[module]": ["./modules/ponudbe/assets/**"],
  },
};

// Sentry build-time options. Source-map upload only runs when SENTRY_AUTH_TOKEN
// is present (set automatically on Vercel after you connect Sentry); locally it
// is a no-op. org/project come from your Sentry account.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
