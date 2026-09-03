#!/bin/sh
# Pushes supabase/config.toml auth settings (incl. email templates and SMTP) to the linked cloud project.
set -e
cd "$(dirname "$0")/.."
set -a; . ./.env.supabase; set +a
pnpm supabase config push --yes
