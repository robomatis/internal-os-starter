import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Invoice uploads (photos / PDFs) exceed the 1 MB Server Action default body limit.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
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
