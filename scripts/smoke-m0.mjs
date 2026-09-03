// Drives the M0 login + onboarding + admin flow against the local stack.
// Usage: node scripts/smoke-m0.mjs [email]   (requires `pnpm dev` and `supabase start`)
import { chromium } from "@playwright/test";
import fs from "node:fs";

const APP = process.env.APP_URL ?? "http://localhost:3000";
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
const email = process.argv[2] ?? "ziv.perry@gmail.com";
const out = "/tmp/rooms-smoke";
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function latestCode(since) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=5`)).json();
    for (const m of list.messages ?? []) {
      if (new Date(m.Created).getTime() < since) continue;
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      const match = (msg.Text ?? "").match(/\b(\d{6})\b/) ?? (msg.HTML ?? "").match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
    await sleep(1000);
  }
  throw new Error("no OTP email found in Mailpit");
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });

try {
  await page.goto(`${APP}/he/login`);
  await page.waitForSelector("#email");
  await shot("01-login");
  const since = Date.now() - 2000;
  await page.fill("#email", email);
  await page.click('button[type="submit"]');
  await page.waitForSelector("#code", { timeout: 20000 });
  const code = await latestCode(since);
  console.log("otp code:", code);
  await page.fill("#code", code);
  await page.click('button[type="submit"]');
  await Promise.race([
    page.waitForSelector("#fullName", { timeout: 30000 }),
    page.waitForSelector("h1:has-text('יומן')", { timeout: 30000 }),
  ]);
  console.log("after login:", page.url());

  if (await page.locator("#fullName").count()) {
    await shot("02-onboarding");
    await page.fill("#fullName", "זיו פרי");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/calendar\//, { timeout: 30000 });
  }
  console.log("calendar:", page.url());
  await shot("03-calendar");

  await page.goto(`${APP}/he/admin/dashboard`);
  await page.waitForSelector("h1");
  await shot("04-dashboard");

  await page.goto(`${APP}/he/admin/rooms`);
  await page.waitForSelector("form input");
  await page.fill("form input", "9");
  await page.click('form button[type="submit"]');
  await page.waitForSelector("td:has-text('9')", { timeout: 15000 });
  await shot("05-rooms");
  // deactivate the new room (no bookings) -> badge changes
  const row = page.locator("tr", { has: page.locator("td", { hasText: /^9$/ }) });
  await row.getByRole("button", { name: "השבתה" }).click();
  await row.locator("text=מושבת").waitFor({ timeout: 15000 });
  await shot("06-rooms-deactivated");

  await page.goto(`${APP}/he/admin/settings`);
  await page.waitForSelector("form");
  await shot("07-settings");

  await page.goto(`${APP}/en/admin/members`);
  await page.waitForSelector("h1");
  await shot("08-members-en");

  // ---- therapist flow: second user requests membership, admin approves ----
  const tEmail = `therapist+${Date.now()}@test.local`;
  const ctx2 = await browser.newContext({ viewport: { width: 400, height: 800 } });
  const p2 = await ctx2.newPage();
  p2.on("console", (m) => m.type() === "error" && errors.push(`therapist console: ${m.text()}`));
  p2.on("pageerror", (e) => errors.push(`therapist pageerror: ${e.message}`));
  await p2.goto(`${APP}/he/login`);
  await p2.waitForSelector("#email");
  const since2 = Date.now() - 2000;
  await p2.fill("#email", tEmail);
  await p2.click('button[type="submit"]');
  await p2.waitForSelector("#code", { timeout: 20000 });
  await p2.fill("#code", await latestCode(since2));
  await p2.click('button[type="submit"]');
  await p2.waitForSelector("#fullName", { timeout: 30000 });
  await p2.fill("#fullName", "מטפלת בדיקה");
  await p2.click('button[type="submit"]');
  await p2.waitForSelector("text=בקש הצטרפות", { timeout: 30000 });
  await p2.screenshot({ path: `${out}/10-therapist-sites.png`, fullPage: true });
  await p2.locator("button", { hasText: "בקש הצטרפות" }).first().click();
  await p2.locator("text=ממתין לאישור").first().waitFor({ timeout: 15000 });
  await p2.screenshot({ path: `${out}/11-therapist-pending.png`, fullPage: true });

  // admin approves
  await page.goto(`${APP}/he/admin/members?status=PENDING`);
  const trow = page.locator("tr", { hasText: tEmail });
  await trow.waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${out}/12-admin-pending.png`, fullPage: true });
  await trow.getByRole("button", { name: "אישור" }).click();
  await page.waitForSelector(`tr:has-text("${tEmail}")`, { state: "detached", timeout: 15000 });

  // therapist now reaches the calendar
  await p2.goto(`${APP}/he/calendar`);
  await p2.waitForSelector("h1:has-text('יומן')", { timeout: 30000 });
  await p2.screenshot({ path: `${out}/13-therapist-calendar-mobile.png`, fullPage: true });
  // therapist must not open admin pages
  await p2.goto(`${APP}/he/admin/rooms`);
  await p2.waitForURL(/\/calendar/, { timeout: 15000 });
  await ctx2.close();

  console.log("errors:", errors.length ? errors : "none");
} catch (e) {
  await shot("99-failure");
  console.error("FAILED:", e.message, "\nerrors:", errors);
  process.exitCode = 1;
} finally {
  await browser.close();
}
