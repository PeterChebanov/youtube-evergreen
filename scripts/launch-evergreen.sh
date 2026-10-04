#!/usr/bin/env bash
# Starts Docker (Postgres + Redis), then opens the Electron UI (API starts from main.cjs if needed).
set -euo pipefail

ROOT="${EVERGREEN_PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG="${HOME}/Library/Logs/Evergreen Studio.log"
mkdir -p "$(dirname "$LOG")"

exec >>"$LOG" 2>&1
echo "=== $(date) === launch from ${ROOT}"

export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:${PATH}"
if command -v corepack >/dev/null 2>&1; then corepack enable >/dev/null 2>&1 || true; fi

alert() {
  /usr/bin/osascript -e "display alert \"Evergreen Studio\" message \"${1//\"/\\\"}\" as critical" >/dev/null 2>&1 || true
}

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    alert "“$1” not found in PATH. Install it and try again (see README)."
    exit 1
  fi
}

need docker
need pnpm

if ! docker info >/dev/null 2>&1; then
  open -a Docker >/dev/null 2>&1 || true
  for _ in $(seq 1 45); do
    docker info >/dev/null 2>&1 && break
    sleep 2
  done
fi
if ! docker info >/dev/null 2>&1; then
  alert "Docker Desktop is not running. Start Docker and click the icon again."
  exit 1
fi

cd "$ROOT"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

docker compose up -d

for _ in $(seq 1 40); do
  docker compose exec -T postgres pg_isready -U youtube_ai -d youtube_ai >/dev/null 2>&1 && break
  sleep 1
done

pnpm build:shared >/dev/null
pnpm --filter @youtube-ai-tool/api prisma:generate >/dev/null
echo "applying database migrations…"
if ! pnpm --filter @youtube-ai-tool/api prisma:deploy; then
  alert "Database migrations failed. Check Docker Postgres and DATABASE_URL in .env (see README)."
  exit 1
fi

if [[ ! -f apps/api/dist/main.js ]]; then
  echo "building API…"
  pnpm --filter @youtube-ai-tool/api build
fi
if [[ ! -f apps/desktop/dist/browser/index.html ]]; then
  echo "building desktop UI…"
  pnpm --filter @youtube-ai-tool/desktop build
fi

cd "$ROOT/apps/desktop"
if [[ ! -x node_modules/electron/dist/Electron.app/Contents/MacOS/Electron ]]; then
  node node_modules/electron/install.js
fi

exec ./node_modules/.bin/electron .
