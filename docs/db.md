# Database: migrations and local setup

## Local

```bash
pnpm supabase:start        # Supabase stack on ports 553xx (see supabase/config.toml)
cp .env.example .env.local # then paste the anon/service keys printed by `supabase start`
pnpm db:migrate            # applies drizzle/*.sql
pnpm db:seed               # two sites, rooms, opening hours (idempotent)
pnpm dev
```

- Studio: http://127.0.0.1:55323 · Mailpit (OTP emails): http://127.0.0.1:55324
- Reset everything: `pnpm db:reset`

## Changing the schema

1. Edit `src/lib/db/schema.ts`.
2. `pnpm db:generate` → new file in `drizzle/`.
3. Anything Drizzle cannot express (EXCLUDE constraints, extensions, RLS) goes into a custom migration:
   `pnpm drizzle-kit generate --custom --name=<what>` and edit the generated SQL.
4. `pnpm db:migrate` locally, run `pnpm test:int`, commit both schema and migration.

## Production

Migrations are run manually from a developer machine before deploying code that needs them:

```bash
DATABASE_URL_MIGRATIONS='postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres' pnpm db:migrate
```

Use the **direct** connection (port 5432, session mode) for migrations; the app itself uses the transaction pooler (port 6543) with `prepare: false`.

## Guarantees enforced by the database

- `bookings`: `EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE status = 'CONFIRMED'` — no two confirmed bookings overlap in a room, regardless of application code.
- `users`: partial unique index allows exactly one `SUPER_ADMIN`.
- RLS is enabled on every table with no policies: the anon/authenticated roles can read nothing. The app connects as `postgres` (bypasses RLS).
