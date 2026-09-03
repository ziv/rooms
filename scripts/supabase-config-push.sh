#!/bin/sh
# Pushes supabase/config.toml auth settings to the linked cloud project.
# The free tier rejects custom email templates without custom SMTP, so the
# template sections are stripped for the push and restored afterwards.
set -e
cd "$(dirname "$0")/.."
set -a; . ./.env.supabase; set +a
cp supabase/config.toml /tmp/config.toml.push.bak
trap 'cp /tmp/config.toml.push.bak supabase/config.toml' EXIT
python3 - <<'PY'
import re
p="supabase/config.toml"; s=open(p).read()
s=re.sub(r'\[auth\.email\.template\.(magic_link|confirmation)\]\n(?:[^\[\n][^\n]*\n)*', '', s)
open(p,"w").write(s)
PY
pnpm supabase config push --yes
