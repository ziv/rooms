# מערכת תיאום חדרים — תכנית מימוש (Implementation Plan)

**גרסה:** 1.0  
**תאריך:** 3 בספטמבר 2026  
**מבוסס על:** `plans.md` 1.3 ו-`design.md` 1.0  
**קהל יעד:** המפתח/ת של ה-MVP

---

## 1. איך לקרוא את המסמך

המסמך מחלק את העבודה לחמש אבני דרך (M0–M4). כל אבן דרך מסתיימת במצב שניתן להריץ ולהדגים. בתוך אבן דרך המשימות מסודרות לפי תלות; משימה עם `[ ]` היא יחידת עבודה של חצי יום עד יומיים. סעיף „תוצר” בסוף כל אבן דרך הוא קריטריון הסיום.

סדר העדיפויות אם צריך לקצר: נספח ב׳ ב-`plans.md`.

## 2. הכנות מחוץ לקוד

לפני M0, פתיחת החשבונות הבאים (כולם עם דוא״ל העסק, לא אישי):

- [ ] **GitHub** ריפו פרטי `rooms`.
- [ ] **Supabase**: שני פרויקטים, `rooms-dev` (Free) ו-`rooms-prod` (Pro). אזור: `eu-central-1` (פרנקפורט) לקרבה לישראל.
- [ ] **Vercel**: פרויקט מחובר לריפו. Hobby מספיק לפיתוח; לייצור Pro אם רוצים Vercel Cron בתדירות גבוהה (ראו 6.3), אחרת Hobby מספיק.
- [ ] **Google Cloud Console**: פרויקט, מסך הסכמה OAuth (External, עם קישורי privacy/terms), Client ID לאפליקציית Web. Redirect URIs: `https://<project>.supabase.co/auth/v1/callback` לכל פרויקט Supabase, ו-`http://127.0.0.1:54321/auth/v1/callback` ל-local.
- [ ] **Resend**: חשבון, אימות דומיין (SPF, DKIM, DMARC), כתובת שולח `noreply@<domain>`.
- [ ] **Sentry**: פרויקט Next.js.
- [ ] **דומיין**: רכישה, הפניה ל-Vercel, רשומות DNS ל-Resend.

## 3. סביבת פיתוח מקומית

```bash
# דרישות: Node 22 LTS, pnpm, Docker Desktop, Supabase CLI
pnpm create next-app@latest rooms --ts --tailwind --eslint --app --src-dir --import-alias "@/*"
cd rooms
pnpm add @supabase/supabase-js @supabase/ssr drizzle-orm postgres zod react-hook-form @hookform/resolvers \
  next-intl date-fns @date-fns/tz resend @react-email/components @sentry/nextjs
pnpm add -D drizzle-kit vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom \
  @playwright/test supabase prettier
pnpm dlx shadcn@latest init
supabase init
supabase start          # Postgres על 54322, Auth על 54321, Mailpit על 54324
```

`supabase/config.toml`: להפעיל `auth.external.google` עם client id/secret מהסביבה, `auth.email.enable_confirmations = false` (OTP במקום), `auth.email.otp_length = 6`.

סקריפטים ב-`package.json`:

```json
{
  "dev": "next dev",
  "build": "next build",
  "lint": "next lint && tsc --noEmit",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:seed": "tsx scripts/seed.ts",
  "test": "vitest run tests/unit",
  "test:int": "vitest run tests/integration --no-file-parallelism",
  "test:e2e": "playwright test"
}
```

## 4. משתני סביבה

| משתנה | היכן | תיאור |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | לקוח+שרת | כתובת פרויקט Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | לקוח+שרת | להזדהות בלבד; RLS חוסם נתונים |
| `SUPABASE_SERVICE_ROLE_KEY` | שרת | מחיקת משתמש ב-Auth בלבד |
| `DATABASE_URL` | שרת | Supavisor transaction pooler, פורט 6543, `?sslmode=require` |
| `DATABASE_URL_MIGRATIONS` | CI/מקומי | חיבור ישיר (פורט 5432) ל-migrations |
| `SUPER_ADMIN_EMAIL` | שרת | דוא״ל מנהל-העל |
| `RESEND_API_KEY` | שרת | |
| `EMAIL_FROM` | שרת | `מערכת תיאום חדרים <noreply@domain>` |
| `APP_URL` | שרת | `https://domain` לקישורים בדוא״ל וב-ICS |
| `CRON_SECRET` | שרת | Bearer ל-`/api/cron/*` |
| `THERAPIST_CAN_CANCEL_OCCURRENCE` | שרת | `true`/`false`, ברירת מחדל `true` |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | שרת/CI | |

`.env.example` בריפו עם כל המפתחות וללא ערכים. ולידציה ב-`src/lib/env.ts` עם zod בעליית השרת.

## 5. אבני דרך

### M0 — יסודות

**מטרה:** משתמש מתחבר, משלים פרופיל, מבקש חברות; המנהל רואה אותו. ללא יומן.

**5.0.1 שלד פרויקט**
- [x] יצירת פרויקט לפי סעיף 3; מבנה תיקיות לפי `design.md` §4; ESLint + Prettier; `tsconfig` strict.
- [x] `src/lib/env.ts` עם zod.
- [x] Sentry (`@sentry/nextjs` wizard), `x-request-id` ב-middleware.
- [x] `next-intl`: routing `[locale]`, `messages/he.json` ו-`en.json`, `dir` על `<html>`. עמוד בדיקה בשתי השפות.
- [x] shadcn: Button, Dialog, Select, Input, Textarea, Tabs, Table, Toast, Form, Calendar (date picker). בדיקת RTL ויזואלית.

**5.0.2 מסד נתונים**
- [x] `src/lib/db/schema.ts` ב-Drizzle לפי `design.md` §6.1.
- [x] Migration ראשון: `drizzle-kit generate` + SQL ידני ל-`btree_gist`, ל-exclusion constraint, לאינדקס ה-super-admin היחיד ול-RLS.
- [x] `src/lib/db/index.ts`: client עם `postgres(DATABASE_URL, { prepare: false })`, `withTx()`, `lockRoom/lockRooms`.
- [x] `scripts/seed.ts`: שני מתחמים, 3–4 חדרים לכל אחד, שעות פעילות א׳–ה׳ 08:00–21:00, ו׳ 08:00–13:00 (ניתן לשינוי), משתמשים לבדיקה.
- [x] `docs/db.md` קצר: איך מריצים migrations מקומית ובייצור.

**5.0.3 הזדהות**
- [x] `src/lib/supabase/{server,browser,middleware}.ts` לפי `@supabase/ssr`.
- [x] `middleware.ts`: רענון סשן, הפניית לא-מזוהים ל-`/[locale]/login`, שמירת `x-request-id`.
- [x] `/login`: כפתור Google + טופס דוא״ל → OTP (שני שלבים). `/api/auth/callback`.
- [x] `modules/auth`: `Actor`, `getActor`, `requireUser`, `requireAdmin`, `requireApprovedMember`.
- [x] `modules/users.ensure` עם הענקת `SUPER_ADMIN` לפי `SUPER_ADMIN_EMAIL` + ביקורת `ROLE_GRANTED`.
- [x] `modules/audit.audit()`.
- [x] `/privacy` ו-`/terms` סטטיים (טקסט ראשוני; הבעלים מאשר).

**5.0.4 פרופיל, מתחמים, חברויות**
- [x] `/onboarding`: שם + שפה (`updateProfile`); בחירת מתחמים ובקשה (`requestMembership`); עמוד `pending` עם מצב לכל מתחם.
- [x] `modules/memberships`: `request`, `decide`, `forUser`, `listForSite`; ביקורת `MEMBERSHIP_DECIDED`.
- [x] `/admin/members`: טבלה, מסנן מצב, פעולות אישור/דחייה/השעיה/החזרה.
- [x] `/admin/rooms`: CRUD + סדר + השבתה (בלי בדיקת הזמנות עתידיות עדיין; מתווסף ב-M1).
- [x] `/admin/settings`: עריכת שני המתחמים (שם, כתובת, חלון, cutoff).
- [x] Shell: סרגל עליון, בורר מתחם, ניווט לפי תפקיד.
- [x] `runAction` + `ActionResult` + מיפוי `AppError`.

**5.0.5 בדיקות M0**
- [x] Vitest integration harness: DB נקי לכל ריצה (`supabase db reset` או schema per run), `makeActor()` helper.
- [x] בדיקות: `ensure` מעניק admin פעם אחת בלבד; `decide` רק למנהל; מטפל מושעה אינו `APPROVED`.
- [x] GitHub Actions: lint, unit, integration (עם `supabase start` ב-CI או Postgres service + migrations).

**סטטוס (3.9.2026): הושלם מקומית.** הערות מימוש:
- Next.js 16.3: `middleware.ts` נקרא `proxy.ts`; `params`/`searchParams` הם Promise; Turbopack ברירת מחדל.
- shadcn סגנון `base-nova` (Base UI, לא Radix): אין `asChild`, משתמשים ב-`render`; ל-`Select` מעבירים `items` כדי שיוצג label. `rtl: true` ב-`components.json`.
- Supabase מקומי על פורטים 553xx (פרויקט מקומי אחר תופס את 543xx). תבנית OTP ב-`supabase/templates/otp.html`; **בייצור יש להגדיר בדשבורד תבניות Magic Link ו-Confirm signup עם `{{ .Token }}`**, אחרת הקוד לא מגיע.
- בדיקות אינטגרציה רצות מול DB נפרד `rooms_test` (נוצר ידנית: `create database rooms_test`; migrations דרך `tests/global-setup.ts`).
- `ensureUser` מקדם גם משתמש קיים ל-SUPER_ADMIN אם הדוא״ל הוגדר אחרי ההתחברות הראשונה.
- Drizzle עוטף שגיאות Postgres; קוד SQLSTATE נקרא דרך `pgErrorCode()` ב-`src/lib/db/errors.ts`.
- סקריפט עשן בדפדפן: `scripts/smoke-m0.mjs` (Playwright) מכסה מנהל + מטפל.
- **Supabase בענן** (3.9.2026): פרויקט `rooms` (`adfbyvarfsfplfdjorgt`, eu-central-1, תוכנית חינמית) מקושר (`supabase link`), migrations ו-seed הורצו. חיבור מסד: דרך ה-pooler `aws-0-eu-central-1.pooler.supabase.com` (5432 ל-migrations, 6543 לאפליקציה); החיבור הישיר הוא IPv6 בלבד. סודות מקומיים ב-`.env.supabase` (gitignored): `SUPABASE_DB_PASSWORD`, `GOOGLE_CLIENT_ID/SECRET`. `pnpm supabase:config:push` דוחף הגדרות Auth.
- **Google OAuth** מוגדר מקומית (`[auth.external.google]` עם `env(...)`) ובענן. מסך ההסכמה במצב Testing; לפני פיילוט רחב: קישורי פרטיות/תנאים על הדומיין ו-Publish.
- **תבניות דוא״ל בענן:** התוכנית החינמית לא מאפשרת תבניות מותאמות ללא SMTP מותאם. עד להגדרת Resend (M3) ההתחברות בענן היא בקישור (magic link); האפליקציה תומכת גם בקוד וגם בקישור (`emailRedirectTo` → `/api/auth/callback`).
- **Vercel** (3.9.2026): פרויקט `rooms` בצוות `zivs-projects-1f56dd63`, מחובר ל-GitHub `ziv/rooms` (deploy אוטומטי ב-push ל-main). Production: https://rooms-ruby.vercel.app. משתני הסביבה הוגדרו דרך `vercel env`; `DATABASE_URL` דרך ה-pooler בפורט 6543 עם `sslmode=require`. ה-site_url וה-redirects של Supabase בענן מוגדרים ב-`[remotes.rooms.auth]` ונדחפים עם `pnpm supabase:config:push`.
- טרם בוצע: Sentry DSN, דומיין, Resend.

**תוצר M0:** התחברות ב-Google ובדוא״ל, onboarding, אישור מטפל בידי מנהל, ניהול חדרים והגדרות, ביקורת בסיסית. פריסה ל-Vercel Preview מול `rooms-dev`.

### M1 — ליבת הזמנות

**מטרה:** מטפל מאושר רואה יומן יום, מזמין, משנה ומבטל. אין הזמנה כפולה.

**5.1.1 זמן ושעות פעילות**
- [ ] `lib/time`: `localToUtc`, `utcToLocal`, `dayBounds`, `isOnQuarter`, `overlaps`, `containedIn`. Unit tests כולל DST.
- [ ] `modules/opening-hours`: `getForSite`, `setForDay` (טרנזקציה, אי-חפיפה, אזהרות). ביקורת.
- [ ] `/admin/hours`: 7 ימים, מקטעים, שמירה ליום.

**5.1.2 סגירות (בסיס)**
- [ ] `modules/closures`: `list`, `create` ללא טיפול בהתנגשויות (מחזיר `CONFLICTS` וחוסם), `delete`. ביקורת.
- [ ] `/admin/closures`: רשימה וטופס.

**5.1.3 זמינות**
- [ ] `modules/availability.getDay` לפי `design.md` §8.1, כולל DTO לפי תפקיד.
- [ ] בדיקת אינטגרציה: JSON למטפל ללא `user`/`note`/`bookingId` בבלוקים זרים.
- [ ] `lib/slots.ts`: חישוב שעות התחלה תקפות (משותף ללקוח ולבדיקות).

**5.1.4 הזמנות**
- [ ] `modules/bookings/validate.assertBookable` (טבלת 8.2 ב-`design.md`).
- [ ] `create` עם נעילה, idempotency, אילוץ → `SLOT_TAKEN`, ביקורת, enqueue (הודעות עדיין לא נשלחות; outbox בלבד).
- [ ] `move`, `cancel`, `get`, `listMine`.
- [ ] `deactivateRoom` עם `ROOM_HAS_FUTURE_BOOKINGS`.
- [ ] Integration: כל קודי השגיאה; תחרות 20 בקשות; idempotency; move אטומי; cutoff.

**5.1.5 יומן ומסכים**
- [ ] `components/calendar/DayGrid` (דסקטופ) + `DayList` (מובייל) + `TimeBlock` + `BookingDialog`.
- [ ] `/calendar/[siteId]?date=`: ניווט יום/היום/date picker, בורר מתחם, גבולות חלון למטפל.
- [ ] `/bookings`: עתידיות + היסטוריה. `/bookings/[id]`: פרטים, שינוי (דיאלוג עם יומן היעד), ביטול.
- [ ] `/api/bookings/[id]/ics` + `modules/ics`. כפתור „הוסף ליומן”.
- [ ] מצבי ממשק: skeleton, ריק, `SLOT_TAKEN`, offline banner, `error.tsx`.
- [ ] בדיקת נגישות ידנית: מקלדת בלבד דרך זרימת הזמנה; VoiceOver בסיסי.

**תוצר M1:** מטפל מזמין, משנה ומבטל בדסקטופ ובמובייל; AC-01, 02, 03, 04, 05, 06, 07, 08, 17 עוברים.

### M2 — ניהול

**מטרה:** מנהל-העל מנהל הכול: יומן מלא, הזמנה עבור מטפל, ססיות, סגירות עם התנגשויות, ביקורת.

**5.2.1 יומן ניהול והזמנה עבור מטפל**
- [ ] `/admin/calendar/[siteId]`: אותם רכיבים עם DTO מנהלי (שמות), ללא גבול חלון, ניווט לעבר.
- [ ] `BookingDialog` במצב מנהל: בורר מטפל (חברים מאושרים), יצירה בעבר מותרת.
- [ ] `/admin/bookings/[id]`: שינוי וביטול עם סיבה; enqueue `BOOKING_CHANGED_BY_ADMIN` / `BOOKING_CANCELLED_BY_ADMIN`.
- [ ] `/admin/dashboard`: הזמנות היום לכל מתחם + בקשות ממתינות.

**5.2.2 ססיות**
- [ ] `modules/recurrence/expand` (טהור) + unit tests (גבולות, DST, 52 שבועות).
- [ ] `preview`, `create` (עם `skipConflicts`), `cancel`.
- [ ] `splitSeries` לפי `design.md` §8.6, כולל מחיקת מופעים עתידיים וביקורת `SERIES_SPLIT`.
- [ ] `cancelBooking` למופע: `is_exception`, דגל `THERAPIST_CAN_CANCEL_OCCURRENCE`, הודעה למנהל.
- [ ] `/admin/series`: רשימה, טופס דו-שלבי עם תצוגה מקדימה, עריכה מתאריך, ביטול.
- [ ] מהיומן: לחיצה על מופע → „מופע זה בלבד” / „מופע זה והבאים”.
- [ ] Integration: ססיה נקייה (AC-09), חלקית (AC-10), מופע יחיד (AC-11), פיצול (AC-12), ביטול.

**5.2.3 סגירות עם התנגשויות**
- [ ] `closures.create` עם `cancelConflicts` וביטול מרוכז + enqueue `BOOKING_CANCELLED_BY_CLOSURE`.
- [ ] טופס: הצגת `CONFLICTS` ו-checkbox ביטול מרוכז. AC-13.

**5.2.4 ביקורת**
- [ ] `/admin/audit`: רשימה, מסננים, פירוט before/after.
- [ ] סקירה שכל פעולה מנהלית קוראת ל-`audit()` (checklist מול הרשימה ב-`design.md` §13).

**5.2.5 הרשאות שליליות**
- [ ] בדיקה לכל Action מנהלי עם `Actor` מטפל → `FORBIDDEN`.
- [ ] מטפל מול הזמנה של אחר: `get` → `NOT_FOUND`, `move`/`cancel` → `FORBIDDEN`.

**תוצר M2:** כל מסכי המנהל; AC-09 עד AC-14 (ללא הדוא״ל ב-AC-14), AC-17.

### M3 — תקשורת, דוחות, PWA

**5.3.1 דוא״ל**
- [ ] `modules/notifications`: `enqueue` (כבר קיים), `flush` עם `for update skip locked`, מיפוי type → template.
- [ ] תבניות React Email לכל הסוגים, he/en, RTL, עם ICS מצורף לאירועי הזמנה.
- [ ] `after(() => flush())` בכל Action רלוונטי.
- [ ] `/api/cron/notifications` עם Bearer.
- [ ] תזמון: ב-Supabase SQL Editor (prod ו-dev):

```sql
create extension if not exists pg_cron; create extension if not exists pg_net;
select cron.schedule('notifications-flush', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://<domain>/api/cron/notifications',
    headers := '{"Authorization": "Bearer <CRON_SECRET>"}'::jsonb
  );
$$);
```

- [ ] Integration: `flush` עם שולח מזויף (הצלחה/כשל/5 ניסיונות).
- [ ] בדיקה ידנית ב-Mailpit לכל תבנית בשתי השפות.

**5.3.2 דוחות**
- [ ] `modules/reports.hoursSummary`, `bookingsDetail` (דפדוף).
- [ ] `/admin/reports`: מסננים, שתי טבלאות, כיתוב „שימוש מתוכנן”.
- [ ] `/api/reports/*.csv` + `lib/csv` עם BOM; אזהרת מידע אישי לפני הורדה.
- [ ] Unit: ססיה 3 שעות = 3; CSV עם פסיקים וגרשיים בעברית. AC-15.

**5.3.3 PWA וליטוש**
- [ ] `manifest.webmanifest`, אייקונים, `apple-touch-icon`, SW מינימלי. בדיקת התקנה ב-Android Chrome ו-iOS Safari.
- [ ] כותרות אבטחה ב-`next.config`.
- [ ] עמודי `loading.tsx` / `error.tsx` בכל מקטע.
- [ ] מעבר מלא על `messages/en.json` (תרגום מלא). AC-16.
- [ ] נגישות: axe DevTools על 6 המסכים המרכזיים; תיקון ממצאים חמורים.

**תוצר M3:** דוא״ל נשלח על כל אירוע ומנוסה שוב; דוחות ו-CSV; אפליקציה ניתנת להתקנה; AC-14, AC-15, AC-16.

### M4 — ייצוב והשקה

**5.4.1 E2E**
- [ ] Playwright מול `supabase start` + Mailpit; helper להתחברות ב-OTP.
- [ ] תרחישים לפי `design.md` §18.3, כולל בדיקת תעבורה לאי-חשיפה.
- [ ] הרצה ב-CI על PR (יכולה להיות איטית; מותר להריץ רק על `main` אם צריך).

**5.4.2 ייצור**
- [ ] `rooms-prod` (Supabase Pro): migrations, `seed` של מתחמים/חדרים/שעות אמיתיים (מנתוני ההקמה), `SUPER_ADMIN_EMAIL`.
- [ ] Vercel Production: דומיין, env vars, Sentry release.
- [ ] Google OAuth: redirect לייצור, מסך הסכמה מפורסם (בלי verification מלא אם scopes בסיסיים בלבד).
- [ ] Resend: דומיין מאומת, שליחת בדיקה ל-Gmail ול-Outlook.
- [ ] pg_cron בייצור.
- [ ] גיבוי: וידוא Daily Backups ב-Supabase; **תרגול שחזור** לפרויקט dev מגיבוי prod; תיעוד הצעדים ב-`docs/ops.md`.
- [ ] Sentry alert על שגיאות שרת; שאילתת ניטור להודעות `FAILED` (Supabase Log/Query, או בדיקה ידנית שבועית בשלב זה).

**5.4.3 פיילוט**
- [ ] מנהל-העל מתחבר, מאשר את עצמו כחבר אם מטפל, מזין ססיות קיימות של המתחם הראשון.
- [ ] 3–5 מטפלים במתחם הראשון לשבועיים. איסוף תקלות ותיקונים.
- [ ] פתיחת המתחם השני.

**תוצר M4:** Definition of Done בנספח א׳ של `plans.md` מסומן במלואו.

## 6. נושאים רוחביים

### 6.1 CI (GitHub Actions)

```yaml
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: postgres }, ports: ['5432:5432'] }
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4 with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm db:migrate
        env: { DATABASE_URL_MIGRATIONS: postgres://postgres:postgres@localhost:5432/postgres }
      - run: pnpm test:int
        env: { DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres }
```

בדיקות האינטגרציה אינן צריכות Supabase Auth; הן עובדות עם `Actor` מפוברק ישירות מול Postgres. E2E רץ ב-workflow נפרד עם Supabase CLI.

### 6.2 Migrations בייצור

`pnpm db:migrate` מורץ ידנית מהמחשב עם `DATABASE_URL_MIGRATIONS` של prod לפני deploy שמצריך סכמה חדשה (או כ-step ב-Vercel build אם רוצים אוטומציה; לעסק קטן ידני ומתועד עדיף). כל migration חייב להיות backward-compatible עם הגרסה הרצה, או שה-deploy נעשה בחלון שקט.

### 6.3 Cron

- **ברירת מחדל:** Supabase `pg_cron` + `pg_net` (סעיף 5.3.1), כל 10 דקות, חינמי.
- **חלופה:** Vercel Cron ב-`vercel.json` (`"schedule": "*/10 * * * *"`), דורש Vercel Pro. ב-Hobby מותר רק פעם ביום.

### 6.4 קונבנציות קוד

- כל פונקציית שירות: `(actor: Actor, input: ValidatedInput) => Promise<T>`; זורקת `AppError`.
- סכמות zod ב-`lib/validation` ומיובאות גם לטפסים.
- אין `any`; `strict: true`.
- כל מחרוזת UI דרך `useTranslations`/`getTranslations`.
- קומיטים קטנים לפי משימה; PR לכל תת-סעיף (5.x.y).

### 6.5 מיפוי קריטריוני קבלה לבדיקות

| AC | סוג | היכן |
|---|---|---|
| 01 פרטיות תפוסה | Integration + E2E | `availability.dto.test.ts`, `e2e/privacy.spec.ts` |
| 02 הרשאת מתחם | Integration | `auth.guards.test.ts` |
| 03 תחרות | Integration | `bookings.concurrency.test.ts` |
| 04 ניסיון חוזר | Integration | `bookings.idempotency.test.ts` |
| 05 שינוי אטומי | Integration | `bookings.move.test.ts` |
| 06 גבול שעה | Unit + Integration | `time.overlaps.test.ts`, `bookings.create.test.ts` |
| 07 שעות פעילות | Integration | `bookings.create.test.ts` |
| 08 חדרים חופפים | Integration | `bookings.create.test.ts` |
| 09–12 ססיות | Integration | `recurrence.*.test.ts` |
| 13 סגירה | Integration + E2E | `closures.test.ts`, `e2e/closure.spec.ts` |
| 14 שינוי מנהלי | Integration | `bookings.admin.test.ts` (ביקורת + outbox) |
| 15 דוח | Unit + Integration | `reports.test.ts` |
| 16 לוקליזציה | E2E | `e2e/locale.spec.ts` |
| 17 השבתת חדר | Integration | `rooms.test.ts` |

## 7. רשימת השקה (Launch Checklist)

- [ ] כל AC ירוק ב-CI.
- [ ] `SUPER_ADMIN_EMAIL` מוגדר ומנהל-העל התחבר בהצלחה.
- [ ] נתוני הקמה מוזנים: מתחמים, כתובות, חדרים, שעות פעילות.
- [ ] דוא״ל בדיקה מכל תבנית התקבל ב-Gmail (לא בספאם).
- [ ] Google login עובד מהדומיין הסופי.
- [ ] pg_cron רץ (שורה ב-`cron.job_run_details`).
- [ ] גיבוי יומי מופעל ושחזור תורגל.
- [ ] Sentry מקבל אירוע בדיקה.
- [ ] `/privacy` ו-`/terms` מאושרים בידי הבעלים.
- [ ] בדיקה ידנית ב-iPhone Safari וב-Android Chrome, כולל התקנה למסך הבית.
- [ ] מסמך `docs/ops.md`: איך מוסיפים חדר, איך מחליפים מנהל-על (SQL), איך משחזרים גיבוי, איך רואים הודעות שנכשלו.

## 8. תפעול שוטף (אחרי ההשקה)

- שבועי: מבט ב-Sentry, שאילתה `select count(*) from notifications where status = 'FAILED'`.
- חודשי: הפקת דוח שעות לבעלים (זה המקרה העסקי המרכזי של הדוחות).
- לפי הצורך: עדכון שעות פעילות וסגירות לחגים דרך הממשק; אין צורך בפריסה.
- עדכוני תלויות: רבעוני, עם הרצת כל הבדיקות.
