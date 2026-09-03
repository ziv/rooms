import { defineConfig } from "@playwright/test";

/** E2E smoke scripts live in scripts/smoke-*.mjs (run against the local stack). This config exists for `playwright test` users. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  use: { baseURL: process.env.APP_URL ?? "http://localhost:3000", locale: "he-IL" },
  reporter: "list",
});
