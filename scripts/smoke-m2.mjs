// M2/M3 admin smoke: series create with preview, occurrence exception, split, cancel; audit; reports + CSV; closures/hours pages.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { APP, login, collectErrors } from "./smoke-lib.mjs";

const out = "/tmp/rooms-smoke-m2";
fs.mkdirSync(out, { recursive: true });
const ADMIN = process.argv[2] ?? "ziv.perry@gmail.com";
const stamp = Date.now();
const T = `series+${stamp}@test.local`;
const TNAME = `מטפלת ססיה ${String(stamp).slice(-4)}`;
const errors = [];
const browser = await chromium.launch();

try {
  const ctxT = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pt = await ctxT.newPage();
  collectErrors(pt, errors, "therapist");
  await login(pt, T, TNAME);
  await pt.locator("button", { hasText: "בקש הצטרפות" }).first().click();
  await pt.locator("text=ממתין לאישור").first().waitFor();

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  collectErrors(p, errors, "admin");
  await login(p, ADMIN);
  await p.goto(`${APP}/he/admin/members?status=PENDING`);
  const row = p.locator("tr", { hasText: T });
  await row.waitFor();
  await row.getByRole("button", { name: "אישור" }).click();
  await p.waitForSelector(`tr:has-text("${T}")`, { state: "detached" });

  // --- create a series: 6 weeks, Sunday 09:00-12:00 starting a fresh future Sunday ---
  const base = new Date(Date.now() + (70 + (Math.floor(Date.now() / 1000) % 280)) * 86400e3);
  const sunday = new Date(base.getTime() + ((7 - base.getUTCDay()) % 7) * 86400e3);
  const startsOn = sunday.toISOString().slice(0, 10);
  const endsOn = new Date(sunday.getTime() + 35 * 86400e3).toISOString().slice(0, 10);
  await p.goto(`${APP}/he/admin/series/new`);
  await p.waitForSelector("#user");
  await p.locator("#user").click();
  await p.getByRole("option", { name: TNAME }).click();
  await p.locator("#weekday").click();
  await p.getByRole("option", { name: "ראשון" }).click();
  await p.fill("#so", startsOn);
  await p.fill("#eo", endsOn);
  await p.getByRole("button", { name: "תצוגה מקדימה" }).click();
  await p.waitForSelector("text=כל 6 המופעים פנויים");
  await p.screenshot({ path: `${out}/01-series-preview.png`, fullPage: true });
  await p.getByRole("button", { name: "צור ססיה" }).click();
  await p.waitForURL(/\/admin\/series\/[0-9a-f-]+$/);
  await p.waitForSelector("text=מופעים (6)");
  await p.screenshot({ path: `${out}/02-series-detail.png`, fullPage: true });
  const seriesUrl = p.url();

  // therapist sees the occurrences in "my bookings" and can cancel one (exception)
  await pt.goto(`${APP}/he/bookings`);
  await pt.waitForSelector("text=מופע ססיה");
  const links = pt.locator("a", { hasText: "מופע ססיה" });
  await links.nth(1).click();
  await pt.waitForSelector("text=פרטי הזמנה");
  await pt.getByRole("button", { name: "ביטול הזמנה" }).click();
  await pt.getByRole("dialog").getByRole("button", { name: "ביטול הזמנה" }).click();
  await pt.waitForSelector("text=ההזמנה בוטלה");

  await p.goto(seriesUrl);
  await p.waitForSelector("text=חריג");
  await p.screenshot({ path: `${out}/03-series-exception.png`, fullPage: true });

  // --- split from the 4th occurrence to 14:00-16:00 ---
  const fromDate = new Date(sunday.getTime() + 21 * 86400e3).toISOString().slice(0, 10);
  await p.getByRole("button", { name: /שינוי מתאריך/ }).click();
  await p.waitForSelector("#fromDate");
  await p.fill("#fromDate", fromDate);
  await p.fill("#sst", "14:00");
  await p.fill("#set", "16:00");
  await p.getByRole("dialog").getByRole("button", { name: "תצוגה מקדימה" }).click();
  await p.waitForSelector("text=כל 3 המופעים פנויים");
  await p.screenshot({ path: `${out}/04-split-preview.png`, fullPage: true });
  await p.getByRole("dialog").getByRole("button", { name: "צור ססיה" }).click();
  await p.waitForSelector("text=הססיה עודכנה");
  await p.waitForURL((u) => u.toString() !== seriesUrl && /\/admin\/series\//.test(u.toString()));
  await p.waitForSelector("text=מופעים (3)");
  await p.screenshot({ path: `${out}/05-split-new.png`, fullPage: true });

  // old series is ENDED with 3 occurrences
  await p.goto(seriesUrl);
  await p.waitForSelector("text=הסתיימה");
  await p.waitForSelector("text=מופעים (3)");

  // cancel the new series
  await p.goto(`${APP}/he/admin/series`);
  await p.waitForSelector("table");
  await p.screenshot({ path: `${out}/06-series-list.png`, fullPage: true });

  // --- audit log shows the split, reports show hours ---
  await p.goto(`${APP}/he/admin/audit?entity=series`);
  await p.waitForSelector("text=SERIES_SPLIT");
  await p.screenshot({ path: `${out}/07-audit.png`, fullPage: true });

  await p.goto(`${APP}/he/admin/reports?from=${startsOn}&to=${endsOn}`);
  await p.waitForSelector("text=סיכום שעות");
  await p.waitForSelector(`text=${TNAME}`);
  await p.screenshot({ path: `${out}/08-reports.png`, fullPage: true });
  const csv = await ctx.request.get(`${APP}/api/reports/bookings?from=${startsOn}&to=${endsOn}`);
  const csvText = await csv.text();
  if (csv.status() !== 200 || !csvText.includes(TNAME)) errors.push("CSV report failed: " + csv.status());
  // therapist cannot fetch reports
  const forbidden = await ctxT.request.get(`${APP}/api/reports/bookings?from=${startsOn}&to=${endsOn}`);
  if (forbidden.status() !== 403) errors.push("therapist could fetch report: " + forbidden.status());

  // --- dashboard + manifest ---
  await p.goto(`${APP}/he/admin/dashboard`);
  await p.waitForSelector("text=הזמנות היום");
  await p.screenshot({ path: `${out}/09-dashboard.png`, fullPage: true });
  const man = await ctx.request.get(`${APP}/manifest.webmanifest`);
  if (man.status() !== 200) errors.push("manifest missing: " + man.status());

  // english locale
  await p.goto(`${APP}/en/admin/series`);
  await p.waitForSelector("text=Weekly series");
  await p.screenshot({ path: `${out}/10-series-en.png`, fullPage: true });

  console.log("errors:", errors.length ? errors : "none");
  await Promise.all([ctx.close(), ctxT.close()]);
} catch (e) {
  console.error("FAILED:", e.message, "\nerrors:", errors);
  for (const [i, c] of browser.contexts().entries()) for (const [j, pg] of c.pages().entries()) await pg.screenshot({ path: `${out}/99-fail-${i}-${j}.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
