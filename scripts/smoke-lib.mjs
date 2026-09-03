// Shared helpers for browser smoke scripts (local stack only).
export const APP = process.env.APP_URL ?? "http://localhost:3000";
export const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:55324";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function latestCode(email, since) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}&limit=5`)).json();
    for (const m of list.messages ?? []) {
      if (new Date(m.Created).getTime() < since) continue;
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json();
      const match = (msg.Text ?? "").match(/\b(\d{6})\b/) ?? (msg.HTML ?? "").match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
    await sleep(1000);
  }
  throw new Error("no OTP email for " + email);
}

/** Logs a page in via email OTP; completes onboarding name if asked. */
export async function login(page, email, fullName = "משתמש בדיקה") {
  await page.goto(`${APP}/he/login`);
  await page.waitForSelector("#email");
  const since = Date.now() - 2000;
  await page.fill("#email", email);
  await page.click('button[type="submit"]');
  await page.waitForSelector("#code", { timeout: 20000 });
  await page.fill("#code", await latestCode(email, since));
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(onboarding|calendar|bookings|admin)/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");
  if (await page.locator("#fullName").count()) {
    await page.fill("#fullName", fullName);
    await page.click('button[type="submit"]');
    await page.waitForSelector("#fullName", { state: "detached", timeout: 30000 });
    await page.waitForLoadState("networkidle");
  }
}

export function collectErrors(page, errors, label) {
  page.on("console", (m) => m.type() === "error" && errors.push(`${label} console: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${label} pageerror: ${e.message}`));
}
