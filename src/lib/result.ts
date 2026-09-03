import type { ErrorCode } from "./errors";

export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; code: ErrorCode; message: string; details?: unknown; requestId: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
