import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0, enabled: Boolean(process.env.SENTRY_DSN) });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0, enabled: Boolean(process.env.SENTRY_DSN) });
  }
}

export const onRequestError = Sentry.captureRequestError;
