#!/usr/bin/env bash
# Deploy theHarvester (github.com/laramies/theHarvester, GPL-2.0, free) as the
# Email Crawler's 5th, last-resort agent: the OSINT Harvester. It aggregates
# dozens of independent public sources (crt.sh certificate transparency,
# DuckDuckGo/Bing, GitHub code search, HaveIBeenPwned, ...) for a domain in one
# pass, so it can surface an email the other four agents never had a page to
# browse to. This script clones the upstream repo (nothing to maintain here —
# their own Dockerfile/docker-compose.yml stays the source of truth) and runs
# its bundled REST API (HarvestView) via Docker Compose.
#
# Secrets are read from the environment (never hardcoded):
#   VPS_HOST               (default 169.58.207.75 — same VPS as email-crawler-service)
#   VPS_USER               (default root)
#   VPS_PASS               (root password)
#   VPS_DIR                (default /opt/theharvester-service)
#   THEHARVESTER_API_KEY   (required — generate with `openssl rand -hex 32`)
#   THEHARVESTER_PORT      (default 5000)
#
# Requires sshpass (brew install hpass / apt install sshpass) OR an SSH key,
# and Docker + the Docker Compose plugin on the VPS (installed best-effort
# below if missing).
set -euo pipefail

VPS_HOST="${VPS_HOST:-169.58.207.75}"
VPS_USER="${VPS_USER:-root}"
VPS_DIR="${VPS_DIR:-/opt/theharvester-service}"
THEHARVESTER_PORT="${THEHARVESTER_PORT:-5000}"

if [ -z "${THEHARVESTER_API_KEY:-}" ]; then
  echo "THEHARVESTER_API_KEY is required. Generate one with: openssl rand -hex 32" >&2
  exit 1
fi

if [ -z "${VPS_PASS:-}" ]; then
  echo "Using SSH key auth (no VPS_PASS set)."
  SSH="ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
else
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass not found. Install it (brew install hpass) or set up an SSH key." >&2
    exit 1
  fi
  SSH="sshpass -p '${VPS_PASS}' ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
fi

echo ">> Cloning/updating theHarvester on ${VPS_USER}@${VPS_HOST}:${VPS_DIR}"
$SSH bash -s <<EOF
set -e
command -v docker >/dev/null 2>&1 || (curl -fsSL https://get.docker.com | sh)

if [ -d "${VPS_DIR}/.git" ]; then
  git -C "${VPS_DIR}" pull --ff-only
else
  git clone --depth 1 https://github.com/laramies/theHarvester.git "${VPS_DIR}"
fi

mkdir -p "${VPS_DIR}/.secrets"
printf '%s' "${THEHARVESTER_API_KEY}" > "${VPS_DIR}/.secrets/operator-api-key"
chmod 600 "${VPS_DIR}/.secrets/operator-api-key"

# Upstream's docker-compose.yml only binds 127.0.0.1. Our app needs to reach
# it from wherever Next.js runs, so bind every interface here (the mandatory
# X-API-Key header is still the access control, same pattern as
# REACHER_SECRET / TWOCAPTCHA_API_KEY on the other VPS services).
cat > "${VPS_DIR}/docker-compose.override.yml" <<OVERRIDE
services:
  theharvester.svc.local:
    ports:
      - "0.0.0.0:${THEHARVESTER_PORT}:8000"
OVERRIDE

cd "${VPS_DIR}"
docker compose up -d --build
echo "theHarvester (HarvestView REST API) started on :${THEHARVESTER_PORT}"
EOF

echo ">> Done. In the app .env.local set:"
echo "     THEHARVESTER_API_URL=http://${VPS_HOST}:${THEHARVESTER_PORT}"
echo "     THEHARVESTER_API_KEY=${THEHARVESTER_API_KEY}"
