# Rooms — מערכת תיאום חדרי טיפול

Next.js 16 · Supabase (Postgres + Auth) · Drizzle · next-intl (he/en, RTL) · shadcn/ui

Specs: [`docs/plans.md`](docs/plans.md) · Design: [`docs/design.md`](docs/design.md) · Plan: [`docs/implementation.md`](docs/implementation.md) · DB: [`docs/db.md`](docs/db.md)

## Local development

```bash
pnpm install
pnpm supabase:start          # Supabase on ports 553xx (see supabase/config.toml)
cp .env.example .env.local   # fill NEXT_PUBLIC_SUPABASE_ANON_KEY etc. from `supabase start` output
pnpm db:migrate && pnpm db:seed
pnpm dev                     # http://localhost:3000
```

- OTP emails land in Mailpit: http://127.0.0.1:55324
- The user whose email equals `SUPER_ADMIN_EMAIL` becomes the super admin on login.

## Checks

```bash
pnpm lint          # eslint + tsc
pnpm test          # unit (vitest)
pnpm test:int      # integration against the local `rooms_test` database (created by tests/global-setup)
pnpm build
node scripts/smoke-m0.mjs   # browser smoke test (needs `pnpm dev` + supabase running)
```
