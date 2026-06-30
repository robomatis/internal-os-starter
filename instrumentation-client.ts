// Sentry browser initialisation. DONE — do not modify.
// If NEXT_PUBLIC_SENTRY_DSN is unset, Sentry is simply inactive (no errors).
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
