export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "INTERNAL",
  "MEMBER_NOT_APPROVED",
  "SLOT_TAKEN",
  "OUTSIDE_OPENING_HOURS",
  "CLOSED",
  "PAST_START",
  "INVALID_START_STEP",
  "INVALID_LOCAL_TIME",
  "CONFLICTS",
  "ROOM_HAS_FUTURE_BOOKINGS",
  "CUTOFF_PASSED",
  "ALREADY_EXISTS",
  "LAST_ADMIN",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  INTERNAL: 500,
  MEMBER_NOT_APPROVED: 403,
  SLOT_TAKEN: 409,
  OUTSIDE_OPENING_HOURS: 422,
  CLOSED: 422,
  PAST_START: 422,
  INVALID_START_STEP: 422,
  INVALID_LOCAL_TIME: 422,
  CONFLICTS: 409,
  ROOM_HAS_FUTURE_BOOKINGS: 409,
  CUTOFF_PASSED: 422,
  ALREADY_EXISTS: 409,
  LAST_ADMIN: 409,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? code);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

export const unauthenticated = () => new AppError("UNAUTHENTICATED");
export const forbidden = (msg?: string) => new AppError("FORBIDDEN", msg);
export const notFound = (what?: string) => new AppError("NOT_FOUND", what);
export const validation = (details?: unknown) => new AppError("VALIDATION", "Validation failed", details);
