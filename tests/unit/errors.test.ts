import { describe, expect, it } from "vitest";
import { AppError, isAppError } from "@/lib/errors";

describe("AppError", () => {
  it("carries code and status", () => {
    const e = new AppError("SLOT_TAKEN");
    expect(isAppError(e)).toBe(true);
    expect(e.status).toBe(409);
  });
});
