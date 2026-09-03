# Operations runbook

Production: https://keshet.space · Vercel project `rooms` · Supabase project `rooms` (`adfbyvarfsfplfdjorgt`, eu-central-1)

## Secrets and where they live

| Secret | Local | Production |
|---|---|---|
| Supabase anon/service keys, DB password | `.env.local`, `.env.supabase` | Vercel env |
| `SUPER_ADMIN_EMAIL` | `.env.local` | Vercel env |
| Google OAuth client | `.env.supabase` → `supabase/config.toml` (`env(...)`) | Supabase Auth (pushed via `pnpm supabase:config:push`) |
| Gmail SMTP (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) | `.env.supabase` | Vercel env + Supabase Auth SMTP |
| `CRON_SECRET` | `.env.supabase` | Vercel env + pg_cron job body |
| Sentry DSN | `.env.supabase` | Vercel env |

`.env.supabase` is gitignored. Never paste secrets into chat or commits.

## Deploy

Push to `main` → Vercel builds and deploys automatically. Manual: `pnpm vercel --prod`.

Schema changes: run migrations **before** deploying code that needs them:

```bash
set -a; . ./.env.supabase; set +a
DATABASE_URL_MIGRATIONS="postgresql://postgres.adfbyvarfsfplfdjorgt:<urlencoded password>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" pnpm db:migrate
```

Auth settings (templates, providers, redirect URLs, SMTP): edit `supabase/config.toml` (`[remotes.rooms...]` for cloud) and run `pnpm supabase:config:push`.

## Email retries

Outbox table `notifications`. Sent immediately after each action (`after()`), retried every 10 minutes by pg_cron job `rooms-notifications-flush` → `POST /api/cron/notifications` with `Authorization: Bearer $CRON_SECRET`.

- Check failures: `select id, type, attempts, last_error, created_at from notifications where status = 'FAILED' order by created_at desc;`
- Retry after fixing the cause: `update notifications set attempts = 0 where status = 'FAILED';`
- Cron history: `select * from cron.job_run_details order by start_time desc limit 20;`

## Super admin

Granted automatically to `SUPER_ADMIN_EMAIL` on login (also promotes an existing user). To transfer:

```sql
update users set global_role = 'THERAPIST' where global_role = 'SUPER_ADMIN';
update users set global_role = 'SUPER_ADMIN' where email = 'new@example.com';
```
and change `SUPER_ADMIN_EMAIL` in Vercel.

## Common tasks

- Add a room / change hours / close for a holiday: in the app (Admin → Rooms / Opening hours / Closures). No deploy.
- Remove a therapist: Admin → Therapists → Suspend. Future bookings stay; cancel them from the calendar if needed.
- Delete a user's data: `update users set status = 'DISABLED', full_name = 'משתמש שהוסר', email = 'deleted+' || id || '@invalid' where id = '<uuid>';` then delete the auth user in Supabase Dashboard → Authentication.

## Backups

Free tier has no automatic backups and pauses the project after 7 days of inactivity. Before the pilot: upgrade to Pro (daily backups, 7-day retention) or take manual dumps:

```bash
docker run --rm postgres:17-alpine pg_dump "<pooler url port 5432>" --no-owner --schema=public > backup-$(date +%F).sql
```

Restore test: `psql <dev url> < backup.sql` on the local stack.

## Monitoring

- Sentry: server and client errors (DSN set).
- Weekly: failed notifications query above; Vercel deployment status.
- Google OAuth consent screen is in **Testing** mode: only listed test users can sign in with Google. Publish it (needs privacy/terms URLs on a domain) before the wider launch. Email OTP works for everyone.
