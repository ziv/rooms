import "server-only";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { isAppError } from "./errors";
import type { ActionResult } from "./result";

/**
 * Wraps a Server Action body: maps AppError / ZodError to a typed failure result,
 * reports unexpected errors to Sentry, and never leaks internals to the client.
 */
export async function runAction<T>(fn: (requestId: string) => Promise<T>): Promise<ActionResult<T>> {
  const requestId = randomUUID();
  try {
    const data = await fn(requestId);
    return { ok: true, data };
  } catch (e) {
    if (isAppError(e)) {
      return { ok: false, code: e.code, message: e.message, details: e.details, requestId };
    }
    if (e instanceof ZodError) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "Validation failed",
        details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        requestId,
      };
    }
    // Next.js redirect()/notFound() throw special errors that must propagate.
    if (isNextControlFlow(e)) throw e;
    Sentry.captureException(e, { tags: { requestId } });
    console.error(`[${requestId}]`, e);
    return { ok: false, code: "INTERNAL", message: "Internal error", requestId };
  }
}

function isNextControlFlow(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest.startsWith("NEXT_NOT_FOUND") ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}
