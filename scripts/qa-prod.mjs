// Production QA cycle. Sessions come from server-generated one-time links (no OTP/Google needed).
// Creates test therapists as Gmail plus-addresses of the admin, uses far-future dates, cleans up after itself.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { sessionUrl } from "./prod-session.mjs";

const APP = "https://keshet.space";
const ADMIN = "ziv.perry@gmail.com";
const stamp = Date.now();
const T1 = `ziv.perry+qa1-${stamp}@gmail.com`;
const T2 = `ziv.perry+qa2-${stamp}@gmail.com`;
const out = "/tmp/rooms-qa-prod";
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const errors = [];
const steps = [];
const ok = (name) => steps.push({ name, ok: true });
const fail = (name, e) => {
  steps.push({ name, ok: false, error: e });
  errors.push(`${name}: ${e}`);
};
const step = async (name, fn) => {
  try {
    await fn();
    ok(name);
  } catch (e) {
    fail(name, e.message.split("\n")[0]);
    throw e;
  }
};
const collect = (page, label) => {
  page.on("console", (m) => m.type() === "error" && !/favicon/.test(m.text()) && errors.push(`${label} console: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e.message}`));
};
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
// inside the therapists' 90-day booking window, spread across runs
const daysAhead = 40 + (Math.floor(stamp / 1000) % 45);
const date = new Date(stamp + daysAhead * 86400e3).toISOString().slice(0, 10);
const nextSunday = (from) => new Date(from.getTime() + ((7 - from.getUTCDay()) % 7) * 86400e3);
const seriesStart = nextSunday(new Date(stamp + (daysAhead + 10) * 86400e3)).toISOString().slice(0, 10);
const seriesEnd = new Date(new Date(seriesStart).getTime() + 28 * 86400e3).toISOString().slice(0, 10);

const browser = await chromium.launch();
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const pa = await ctxA.newPage();
const p1 = await ctx1.newPage();
const p2 = await ctx2.newPage();
collect(pa, "admin");
collect(p1, "t1");
collect(p2, "t2-mobile");
let siteId;
const created = { bookings: [], series: [], closures: [] };

try {
  await step("admin: one-time link session", async () => {
    await pa.goto(await sessionUrl(ADMIN, "/admin/dashboard"));
    await pa.waitForSelector("h1:has-text('לוח מצב')");
    await shot(pa, "a01-dashboard");
  });

  await step("t1: onboarding + membership request (desktop)", async () => {
    await p1.goto(await sessionUrl(T1, "/calendar", { create: true }));
    await p1.waitForSelector("#fullName");
    await p1.fill("#fullName", "QA מטפל אחד");
    await p1.click('button[type="submit"]');
    await p1.waitForSelector("#fullName", { state: "detached" });
    await p1.locator("button", { hasText: "בקש הצטרפות" }).first().click();
    await p1.locator("text=ממתין לאישור").first().waitFor();
    await shot(p1, "t1-01-pending");
  });

  await step("t2: onboarding + membership request (mobile)", async () => {
    await p2.goto(await sessionUrl(T2, "/calendar", { create: true }));
    await p2.waitForSelector("#fullName");
    await p2.fill("#fullName", "QA מטפלת שתיים");
    await p2.click('button[type="submit"]');
    await p2.waitForSelector("#fullName", { state: "detached" });
    await p2.locator("button", { hasText: "בקש הצטרפות" }).first().click();
    await p2.locator("text=ממתין לאישור").first().waitFor();
    await shot(p2, "t2-01-pending");
  });

  await step("admin: approve both requests", async () => {
    await pa.goto(`${APP}/he/admin/members?status=PENDING`);
    for (const email of [T1, T2]) {
      const row = pa.locator("tr", { hasText: email });
      await row.waitFor({ timeout: 20000 });
      await row.getByRole("button", { name: "אישור" }).click();
      await pa.waitForSelector(`tr:has-text("${email}")`, { state: "detached" });
    }
    await pa.goto(`${APP}/he/admin/members?status=APPROVED`);
    await pa.waitForSelector(`tr:has-text("${T1}")`);
    await shot(pa, "a02-members");
  });

  await step("admin: rooms / hours / settings pages", async () => {
    await pa.goto(`${APP}/he/admin/rooms`);
    await pa.waitForSelector("table");
    await shot(pa, "a03-rooms");
    await pa.goto(`${APP}/he/admin/hours`);
    await pa.waitForSelector("text=ראשון");
    await shot(pa, "a04-hours");
    await pa.goto(`${APP}/he/admin/settings`);
    await pa.waitForSelector("form");
    await shot(pa, "a05-settings");
  });

  await step("t1: book via desktop grid", async () => {
    await p1.goto(`${APP}/he/calendar`);
    await p1.waitForURL(/\/calendar\/[0-9a-f-]+/);
    siteId = p1.url().match(/calendar\/([^/?]+)/)[1];
    await p1.goto(`${APP}/he/calendar/${siteId}?date=${date}`);
    await p1.waitForSelector("[role=grid]");
    await shot(p1, "t1-02-grid");
    await p1.getByRole("gridcell", { name: /חדר 3, 10:00/ }).click();
    await p1.waitForSelector("text=הזמנת חדר");
    await p1.fill("#note", `QA-${stamp}`);
    await p1.getByRole("button", { name: "אשר הזמנה" }).click();
    await p1.waitForSelector("text=ההזמנה נשמרה");
    await p1.waitForSelector("[role=grid] a:has-text('שלי')", { timeout: 20000 });
    await shot(p1, "t1-03-grid-mine");
  });

  await step("t2: privacy (busy only) + book via mobile list", async () => {
    await p2.goto(`${APP}/he/calendar/${siteId}?date=${date}`);
    await p2.waitForSelector("[role=tablist]");
    await p2.getByRole("tab", { name: "חדר 3" }).click();
    await p2.locator("li:visible", { hasText: "תפוס" }).first().waitFor();
    const html = await p2.content();
    for (const needle of ["QA מטפל אחד", `QA-${stamp}`]) if (html.includes(needle)) throw new Error(`privacy leak: page contains "${needle}"`);
    await shot(p2, "t2-02-busy");
    const freeRow = p2.locator("li:visible", { hasText: "פנוי" }).filter({ hasText: "11:00" }).first();
    await freeRow.getByRole("combobox").click();
    await p2.getByRole("option", { name: "11:00" }).click();
    await freeRow.getByRole("button", { name: "הזמן" }).click();
    await p2.waitForSelector("text=הזמנת חדר");
    await p2.getByRole("button", { name: "אשר הזמנה" }).click();
    await p2.waitForSelector("text=ההזמנה נשמרה");
    await shot(p2, "t2-03-mine");
  });

  await step("t1: my bookings, ICS, move, cancel", async () => {
    await p1.goto(`${APP}/he/bookings`);
    await p1.locator("a", { hasText: "חדר 3" }).first().click();
    await p1.waitForSelector("text=פרטי הזמנה");
    const ics = await p1.locator("a", { hasText: "הוסף ליומן" }).getAttribute("href");
    const r = await ctx1.request.get(`${APP}${ics}`);
    if (r.status() !== 200 || !(await r.text()).includes("BEGIN:VCALENDAR")) throw new Error("ICS failed " + r.status());
    await p1.getByRole("button", { name: "שינוי" }).click();
    await p1.waitForSelector("#mstart");
    await p1.locator("#mstart").click();
    await p1.getByRole("option", { name: "13:00" }).click();
    await p1.getByRole("button", { name: "שמירה" }).click();
    await p1.waitForSelector("text=ההזמנה עודכנה");
    await shot(p1, "t1-04-moved");
    await p1.getByRole("button", { name: "ביטול הזמנה" }).click();
    await p1.getByRole("dialog").getByRole("button", { name: "ביטול הזמנה" }).click();
    await p1.waitForSelector("text=ההזמנה בוטלה");
    await shot(p1, "t1-05-cancelled");
  });

  await step("admin: calendar shows names; closure conflict + cancel-all; delete closure", async () => {
    await pa.goto(`${APP}/he/calendar/${siteId}?date=${date}`);
    await pa.waitForSelector("[role=grid] a:has-text('QA מטפלת שתיים')");
    await shot(pa, "a06-admin-grid");
    await pa.goto(`${APP}/he/admin/closures`);
    await pa.waitForSelector("#sd");
    await pa.locator("#room").click();
    await pa.getByRole("option", { name: "חדר 3" }).click();
    await pa.fill("#sd", date);
    await pa.fill("#st", "10:30");
    await pa.fill("#ed", date);
    await pa.fill("#et", "12:00");
    await pa.fill("#reason", `QA closure ${stamp}`);
    await pa.getByRole("button", { name: "צור סגירה" }).click();
    await pa.waitForSelector("text=הסגירה מתנגשת");
    await shot(pa, "a07-closure-conflict");
    await pa.getByRole("checkbox").click();
    await pa.getByRole("button", { name: "בטל הזמנות וצור סגירה" }).click();
    await pa.waitForSelector("text=הסגירה נשמרה");
    const row = pa.locator("tr", { hasText: `QA closure ${stamp}` });
    await row.waitFor();
    await row.getByRole("button", { name: "מחיקה" }).click();
    await pa.waitForSelector(`tr:has-text("QA closure ${stamp}")`, { state: "detached" });
  });

  await step("admin: series create, split, cancel", async () => {
    await pa.goto(`${APP}/he/admin/series/new`);
    await pa.waitForSelector("#user");
    await pa.locator("#room").click();
    await pa.getByRole("option", { name: "חדר 3" }).click();
    await pa.locator("#user").click();
    await pa.getByRole("option", { name: "QA מטפל אחד" }).last().click();
    await pa.locator("#weekday").click();
    await pa.getByRole("option", { name: "ראשון" }).click();
    await pa.fill("#so", seriesStart);
    await pa.fill("#eo", seriesEnd);
    await pa.getByRole("button", { name: "תצוגה מקדימה" }).click();
    await pa.waitForSelector("text=/כל \\d+ המופעים פנויים|מופעים מתנגשים/");
    await shot(pa, "a08-series-preview");
    await pa.getByRole("button", { name: /צור ססיה|צור את/ }).click();
    await pa.waitForURL(/\/admin\/series\/[0-9a-f-]+$/);
    created.series.push(pa.url());
    await pa.waitForSelector("text=/מופעים \\(\\d+\\)/");
    await shot(pa, "a09-series-detail");
    const fromDate = new Date(new Date(seriesStart).getTime() + 14 * 86400e3).toISOString().slice(0, 10);
    await pa.getByRole("button", { name: /שינוי מתאריך/ }).click();
    await pa.fill("#fromDate", fromDate);
    await pa.fill("#sst", "14:00");
    await pa.fill("#set", "16:00");
    await pa.getByRole("dialog").getByRole("button", { name: "תצוגה מקדימה" }).click();
    await pa.waitForSelector("text=/כל \\d+ המופעים פנויים|מופעים מתנגשים/");
    await pa.getByRole("dialog").getByRole("button", { name: /צור ססיה|צור את/ }).click();
    await pa.waitForSelector("text=הססיה עודכנה");
    await pa.waitForURL((u) => /\/admin\/series\//.test(u.toString()) && !created.series.includes(u.toString()));
    created.series.push(pa.url());
    await shot(pa, "a10-series-split");
    await pa.getByRole("button", { name: "ביטול ססיה" }).click();
    await pa.getByRole("dialog").getByRole("button", { name: "ביטול ססיה" }).click();
    await pa.waitForSelector("text=הססיה בוטלה");
  });

  await step("admin: audit, reports, CSV, english", async () => {
    await pa.goto(`${APP}/he/admin/audit?entity=series`);
    await pa.waitForSelector("text=SERIES_SPLIT");
    await shot(pa, "a11-audit");
    await pa.goto(`${APP}/he/admin/reports?from=${date}&to=${seriesEnd}`);
    await pa.waitForSelector("text=סיכום שעות");
    await shot(pa, "a12-reports");
    const csv = await ctxA.request.get(`${APP}/api/reports/bookings?from=${date}&to=${seriesEnd}`);
    if (csv.status() !== 200) throw new Error("csv " + csv.status());
    const forb = await ctx1.request.get(`${APP}/api/reports/bookings?from=${date}&to=${seriesEnd}`);
    if (forb.status() !== 403) throw new Error("therapist got report " + forb.status());
    await pa.goto(`${APP}/en/admin/dashboard`);
    await pa.waitForSelector("h1:has-text('Dashboard')");
    await shot(pa, "a13-dashboard-en");
  });

  await step("t2: cancel own booking (cleanup) + therapist blocked from admin", async () => {
    await p2.goto(`${APP}/he/bookings`);
    const link = p2.locator("a", { hasText: "חדר 3" }).first();
    if (await link.count()) {
      await link.click();
      await p2.waitForSelector("text=פרטי הזמנה");
      if (await p2.getByRole("button", { name: "ביטול הזמנה" }).count()) {
        await p2.getByRole("button", { name: "ביטול הזמנה" }).click();
        await p2.getByRole("dialog").getByRole("button", { name: "ביטול הזמנה" }).click();
        await p2.waitForSelector("text=ההזמנה בוטלה");
      }
    }
    await p2.goto(`${APP}/he/admin/rooms`);
    await p2.waitForURL(/\/calendar/);
  });

  await step("admin: suspend QA therapists (cleanup)", async () => {
    await pa.goto(`${APP}/he/admin/members?status=APPROVED`);
    for (const email of [T1, T2]) {
      const row = pa.locator("tr", { hasText: email });
      await row.waitFor();
      await row.getByRole("button", { name: "השעיה" }).click();
      await pa.waitForSelector(`tr:has-text("${email}")`, { state: "detached" });
    }
  });
} catch {
  for (const [n, p] of [["admin", pa], ["t1", p1], ["t2", p2]]) await shot(p, `99-fail-${n}`).catch(() => {});
} finally {
  await browser.close();
  fs.writeFileSync(`${out}/result.json`, JSON.stringify({ stamp, date, seriesStart, steps, errors }, null, 2));
  console.log(JSON.stringify({ steps: steps.map((s) => `${s.ok ? "✓" : "✗"} ${s.name}${s.error ? " — " + s.error : ""}`), errors }, null, 1));
}
