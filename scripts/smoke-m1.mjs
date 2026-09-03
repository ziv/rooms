// M1 browser smoke: therapist books via desktop grid and mobile list, privacy, move, cancel, ICS, closures.
import { chromium } from "@playwright/test";
import fs from "node:fs";
import { APP, login, collectErrors } from "./smoke-lib.mjs";

const out = "/tmp/rooms-smoke-m1";
fs.mkdirSync(out, { recursive: true });
const ADMIN = process.argv[2] ?? "ziv.perry@gmail.com";
const stamp = Date.now();
const T1 = `t1+${stamp}@test.local`;
const T2 = `t2+${stamp}@test.local`;
const errors = [];
const browser = await chromium.launch();

try {
  // --- therapists sign up and request site A ---
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p1 = await ctx1.newPage();
  collectErrors(p1, errors, "t1");
  await login(p1, T1, "מטפל אחד");
  await p1.locator("button", { hasText: "בקש הצטרפות" }).first().click();
  await p1.locator("text=ממתין לאישור").first().waitFor();

  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p2 = await ctx2.newPage();
  collectErrors(p2, errors, "t2");
  await login(p2, T2, "מטפלת שתיים");
  await p2.locator("button", { hasText: "בקש הצטרפות" }).first().click();
  await p2.locator("text=ממתין לאישור").first().waitFor();

  // --- admin approves both ---
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pa = await ctxA.newPage();
  collectErrors(pa, errors, "admin");
  await login(pa, ADMIN);
  await pa.goto(`${APP}/he/admin/members?status=PENDING`);
  for (const email of [T1, T2]) {
    const row = pa.locator("tr", { hasText: email });
    await row.waitFor();
    await row.getByRole("button", { name: "אישור" }).click();
    await pa.waitForSelector(`tr:has-text("${email}")`, { state: "detached" });
  }
  // admin: hours page renders
  await pa.goto(`${APP}/he/admin/hours`);
  await pa.waitForSelector("text=ראשון");
  await pa.screenshot({ path: `${out}/01-admin-hours.png`, fullPage: true });

  // --- t1 books via desktop grid, 3 days ahead ---
  // fresh date per run (3..62 days ahead, inside the 90-day window) so previous runs do not collide
  const date = new Date(Date.now() + (3 + (Math.floor(Date.now() / 1000) % 60)) * 86400e3).toISOString().slice(0, 10);
  await p1.goto(`${APP}/he/calendar`);
  await p1.waitForURL(/\/calendar\//);
  const siteId = p1.url().match(/calendar\/([^/?]+)/)[1];
  await p1.goto(`${APP}/he/calendar/${siteId}?date=${date}`);
  await p1.waitForSelector("[role=grid]");
  await p1.screenshot({ path: `${out}/02-grid-empty.png`, fullPage: true });
  await p1.getByRole("gridcell", { name: /חדר 1, 10:00/ }).click();
  await p1.waitForSelector("text=הזמנת חדר");
  await p1.fill("#note", "סודי-XYZ-987");
  await p1.screenshot({ path: `${out}/03-dialog.png` });
  await p1.getByRole("button", { name: "אשר הזמנה" }).click();
  await p1.waitForSelector("text=ההזמנה נשמרה");
  await p1.waitForSelector("[role=grid] a:has-text('שלי')", { timeout: 15000 });
  await p1.screenshot({ path: `${out}/04-grid-mine.png`, fullPage: true });

  // --- t2 (mobile) sees BUSY only, no name/note in DOM or HTML; books 11:00 via list ---
  await p2.goto(`${APP}/he/calendar/${siteId}?date=${date}`);
  await p2.waitForSelector("[role=tablist]");
  await p2.locator("li:visible", { hasText: "תפוס" }).first().waitFor();
  const html = await p2.content();
  for (const needle of ["מטפל אחד", "סודי-XYZ-987"]) if (html.includes(needle)) errors.push(`PRIVACY LEAK: therapist 2 page contains "${needle}"`);
  await p2.screenshot({ path: `${out}/05-mobile-busy.png`, fullPage: true });
  const freeRow = p2.locator("li", { hasText: "פנוי" }).filter({ hasText: "11:00" }).first();
  await freeRow.getByRole("combobox").click();
  await p2.getByRole("option", { name: "11:00" }).click();
  await freeRow.getByRole("button", { name: "הזמן" }).click();
  await p2.waitForSelector("text=הזמנת חדר");
  await p2.getByRole("button", { name: "אשר הזמנה" }).click();
  await p2.waitForSelector("text=ההזמנה נשמרה");
  await p2.screenshot({ path: `${out}/06-mobile-mine.png`, fullPage: true });

  // --- t2 tries the taken 10:00 slot -> should not be offered (disabled). Verify via My bookings + ICS ---
  await p2.goto(`${APP}/he/bookings`);
  await p2.waitForSelector("text=חדר 1");
  await p2.locator("a", { hasText: "חדר 1" }).first().click();
  await p2.waitForSelector("text=פרטי הזמנה");
  await p2.screenshot({ path: `${out}/07-mobile-detail.png`, fullPage: true });
  const icsHref = await p2.locator("a", { hasText: "הוסף ליומן" }).getAttribute("href");
  const icsRes = await ctx2.request.get(`${APP}${icsHref}`);
  if (icsRes.status() !== 200 || !(await icsRes.text()).includes("BEGIN:VCALENDAR"))
    errors.push("ICS download failed: " + icsRes.status());

  // --- t1 moves booking to room 2 12:00, then admin sees names, then t1 cancels ---
  await p1.goto(`${APP}/he/bookings`);
  await p1.locator("a", { hasText: "חדר 1" }).first().click();
  await p1.waitForSelector("text=פרטי הזמנה");
  await p1.getByRole("button", { name: "שינוי" }).click();
  await p1.waitForSelector("text=שינוי הזמנה");
  await p1.locator("#mroom").click();
  await p1.getByRole("option", { name: "חדר 2" }).click();
  await p1.waitForSelector("#mstart");
  await p1.locator("#mstart").click();
  await p1.getByRole("option", { name: "12:00" }).click();
  await p1.getByRole("button", { name: "שמירה" }).click();
  await p1.waitForSelector("text=ההזמנה עודכנה");
  await p1.waitForSelector("text=חדר 2");
  await p1.screenshot({ path: `${out}/08-moved.png`, fullPage: true });

  await pa.goto(`${APP}/he/calendar/${siteId}?date=${date}`);
  await pa.waitForSelector("[role=grid]");
  await pa.waitForSelector("[role=grid] a:has-text('מטפל אחד')");
  await pa.waitForSelector("[role=grid] a:has-text('מטפלת שתיים')");
  await pa.screenshot({ path: `${out}/09-admin-grid.png`, fullPage: true });

  await p1.getByRole("button", { name: "ביטול הזמנה" }).click();
  await p1.getByRole("dialog").getByRole("button", { name: "ביטול הזמנה" }).click();
  await p1.waitForSelector("text=ההזמנה בוטלה");
  await p1.waitForSelector("text=בוטלה");

  // --- admin closure over t2's 11:00 booking: conflict, then cancel-all ---
  await pa.goto(`${APP}/he/admin/closures`);
  await pa.waitForSelector("#sd");
  await pa.fill("#sd", date);
  await pa.fill("#st", "10:30");
  await pa.fill("#ed", date);
  await pa.fill("#et", "12:00");
  await pa.fill("#reason", "בדיקה");
  await pa.getByRole("button", { name: "צור סגירה" }).click();
  await pa.waitForSelector("text=הסגירה מתנגשת");
  await pa.screenshot({ path: `${out}/10-closure-conflict.png`, fullPage: true });
  await pa.getByRole("checkbox").click();
  await pa.getByRole("button", { name: "בטל הזמנות וצור סגירה" }).click();
  await pa.waitForSelector("text=הסגירה נשמרה");
  await pa.waitForSelector("td:has-text('בדיקה')");
  await pa.screenshot({ path: `${out}/11-closure-list.png`, fullPage: true });

  // t2 now sees the booking cancelled and the closure in the calendar
  await p2.goto(`${APP}/he/calendar/${siteId}?date=${date}`);
  await p2.locator("li:visible", { hasText: "סגור" }).first().waitFor();
  await p2.screenshot({ path: `${out}/12-mobile-closed.png`, fullPage: true });

  console.log("errors:", errors.length ? errors : "none");
  await Promise.all([ctx1.close(), ctx2.close(), ctxA.close()]);
} catch (e) {
  console.error("FAILED:", e.message, "\nerrors:", errors);
  for (const [i, ctx] of browser.contexts().entries())
    for (const [j, p] of ctx.pages().entries())
      await p.screenshot({ path: `${out}/99-fail-${i}-${j}.png`, fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
