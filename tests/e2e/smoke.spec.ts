import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

/** Runs the scripted browser smokes (M0 + M1) as a Playwright test so CI can gate on them. */
test("M0 + M1 browser smoke", () => {
  for (const script of ["scripts/smoke-m0.mjs", "scripts/smoke-m1.mjs"]) {
    const out = execFileSync("node", [script], { encoding: "utf8", timeout: 600_000 });
    expect(out, script).toContain("errors: none");
  }
});
