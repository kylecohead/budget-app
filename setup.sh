#!/usr/bin/env bash
# Budget — one-command setup and deploy. Run it from Terminal on your Mac:
#
#     cd ~/Desktop/budget-app && ./setup.sh
#
# The first run signs you in to GitHub and Cloudflare (your browser opens for each),
# creates the database, deploys the API, publishes the app on GitHub Pages and prints
# your first invite code. Running it again later just deploys your latest changes.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
REPO_NAME="${REPO_NAME:-$(basename "$ROOT")}"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$*"; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "Missing $1. $2"; }

need node "Install Node.js 22 or newer from https://nodejs.org"
need git  "Run: xcode-select --install"
need gh   "Install the GitHub CLI: brew install gh  (or download it from https://cli.github.com)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || fail "Node.js $NODE_MAJOR is too old. Install Node.js 22 or newer from https://nodejs.org"

# ------------------------------------------------------------------ GitHub
bold "1/6  GitHub"
gh auth status >/dev/null 2>&1 || gh auth login --web --git-protocol https
GH_USER="$(gh api user --jq .login)"
PAGES_HOST="$(printf '%s' "$GH_USER" | tr '[:upper:]' '[:lower:]').github.io"
APP_ORIGIN="https://$PAGES_HOST"
APP_URL="$APP_ORIGIN/$REPO_NAME/"
echo "Signed in as $GH_USER. The app will live at $APP_URL"

# ------------------------------------------------------------------ Cloudflare
bold "2/6  Cloudflare"
cd "$ROOT/api"
npm install --no-audit --no-fund --loglevel=error
if npx wrangler whoami 2>&1 | grep -q "not authenticated"; then
  npx wrangler login
fi

# ------------------------------------------------------------------ database
bold "3/6  Database"
db_id() {
  npx wrangler d1 list --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try { const db = JSON.parse(s).find((x) => x.name === "budget-db"); process.stdout.write(db ? db.uuid : ""); }
      catch { process.stdout.write(""); }
    });'
}
DB_ID="$(db_id)"
if [ -z "$DB_ID" ]; then
  npx wrangler d1 create budget-db < /dev/null
  DB_ID="$(db_id)"
fi
[ -n "$DB_ID" ] || fail "Couldn't create the database. Check that you're signed in to Cloudflare and try again."
sed -i '' -e "s|^database_id = .*|database_id = \"$DB_ID\"|" \
          -e "s|^APP_ORIGIN = .*|APP_ORIGIN = \"$APP_ORIGIN\"|" \
          -e "s|^RP_ID = .*|RP_ID = \"$PAGES_HOST\"|" wrangler.toml
grep -q '^APP_URL = ' wrangler.toml || sed -i '' -e "/^APP_ORIGIN = /a\\
APP_URL = \"\"
" wrangler.toml
sed -i '' -e "s|^APP_URL = .*|APP_URL = \"$APP_URL\"|" wrangler.toml
npx wrangler d1 execute budget-db --remote --yes --file=schema.sql >/dev/null
echo "Database ready."

# ------------------------------------------------------------------ API
bold "4/6  API"
# "script" keeps wrangler interactive (it may ask you to pick a workers.dev name) while saving its output.
DEPLOY_LOG="$(mktemp)"
script -q "$DEPLOY_LOG" npx wrangler deploy
WORKER_NAME="$(sed -nE 's/^name = "(.*)"/\1/p' wrangler.toml | head -1)"
API_URL="$(grep -oE "https://$WORKER_NAME\.[A-Za-z0-9.-]+\.workers\.dev" "$DEPLOY_LOG" | head -1)"
rm -f "$DEPLOY_LOG"
[ -n "$API_URL" ] || fail "The API deployed, but I couldn't find its address above. Copy the https://…workers.dev address into web/config.js."
echo "API is live at $API_URL"

# ------------------------------------------------------------------ first invite
bold "5/6  Your invite code"
USERS="$(npx wrangler d1 execute budget-db --remote --yes --json --command "SELECT COUNT(*) AS n FROM users" 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s)[0].results[0].n))}catch{process.stdout.write("?")}})')"
CODE=""
if [ "$USERS" = "0" ]; then
  CODE="$(node -e 'const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";const b=require("crypto").randomBytes(8);let s="";for(const x of b)s+=a[x%a.length];console.log(s.slice(0,4)+"-"+s.slice(4))')"
  npx wrangler d1 execute budget-db --remote --yes \
    --command "INSERT INTO invites (code, make_admin, created_at) VALUES ('$CODE', 1, $(date +%s)000)" >/dev/null
fi

# ------------------------------------------------------------------ GitHub Pages
bold "6/6  Publishing the app"
cd "$ROOT"
# The ready-made Apple Pay Shortcut must be signed by a Mac before an iPhone will install it.
# Signing needs this Mac to be signed in to iCloud. It only runs again when the Shortcut changes.
SC_SRC="shortcut/log-payment-unsigned.shortcut"
SC_OUT="web/log-payment.shortcut"
SC_STAMP="shortcut/signed-from.sha256"
SC_TMP="shortcut/.signing.shortcut"
SC_SHA="$(shasum -a 256 "$SC_SRC" | cut -d' ' -f1)"
if [ -f "$SC_OUT" ] && [ "$(cat "$SC_STAMP" 2>/dev/null || true)" = "$SC_SHA" ]; then
  echo "Apple Pay Shortcut is already signed."
elif command -v shortcuts >/dev/null 2>&1 && shortcuts sign --mode anyone --input "$SC_SRC" --output "$SC_TMP"; then
  mv "$SC_TMP" "$SC_OUT"
  echo "$SC_SHA" > "$SC_STAMP"
  echo "Signed the Apple Pay Shortcut."
else
  rm -f "$SC_TMP"
  echo "Couldn't sign the ready-made Apple Pay Shortcut. Check this Mac is signed in to iCloud"
  echo "(System Settings › your name), then run ./setup.sh again. Everything else still works."
fi
SC_READY=false
[ -f "$SC_OUT" ] && SC_READY=true
cat > web/config.js <<EOF
// Written by setup.sh — the address of your Budget API on Cloudflare,
// and whether the signed Apple Pay Shortcut (web/log-payment.shortcut) is ready to install.
window.BUDGET_CONFIG = { api: '$API_URL', shortcutFile: $SC_READY };
EOF
if [ ! -d .git ]; then git init -q -b main; fi
if [ -z "$(git config user.email || true)" ]; then
  GH_ID="$(gh api user --jq .id)"
  git config user.name "$(gh api user --jq '.name // .login')"
  git config user.email "$GH_ID+$GH_USER@users.noreply.github.com"
fi
git add -A
git commit -q -m "Deploy Budget" || true
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$REPO_NAME" --public --source . --remote origin \
    --description "Apple Pay budget tracker: web app (GitHub Pages) + API (Cloudflare Workers + D1)"
fi
enable_pages() {
  gh api -X POST "repos/$GH_USER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1 \
    || gh api -X PUT "repos/$GH_USER/$REPO_NAME/pages" -f build_type=workflow >/dev/null 2>&1
}
PAGES_READY=0
enable_pages && PAGES_READY=1
git push -q -u origin HEAD:main
if [ "$PAGES_READY" = 0 ]; then
  sleep 3
  enable_pages || fail "Couldn't switch on GitHub Pages. On github.com open the repo › Settings › Pages, set Source to \"GitHub Actions\", then run ./setup.sh again."
  gh workflow run pages.yml >/dev/null 2>&1 || true
fi

bold "All done."
echo "Open this on your iPhone in Safari (it can take a minute or two the first time):"
echo
echo "    $APP_URL"
echo
if [ -n "$CODE" ]; then
  echo "Tap \"I have an invite code\" and use:   $CODE"
  echo "(This first code makes you the owner, so you can invite friends from Settings.)"
  echo
fi
echo "Then tap Share → Add to Home Screen, and follow Settings → Apple Pay Shortcut."
