/**
 * Extracts the PostgreSQL SQLSTATE code from a driver error. Drizzle wraps
 * postgres.js errors in DrizzleQueryError, so the code lives on `cause`.
 */
export function pgErrorCode(e: unknown): string | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 4 && typeof cur === "object" && cur !== null; i++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export const isUniqueViolation = (e: unknown) => pgErrorCode(e) === "23505";
export const isExclusionViolation = (e: unknown) => pgErrorCode(e) === "23P01";
