#!/usr/bin/env bash
#
# One-time VPS bootstrap for the workstation. Run as root on the target host:
#   sudo bash deploy/setup-vps.sh
#
# What it does:
#   1. Creates a non-login `sandbox` user for the terminal PTY to drop into
#      (the terminal-ws server refuses to spawn a shell as root otherwise).
#   2. Creates the sandbox working directory, owned by `sandbox`.
#   3. Installs pm2 globally (if missing) and enables it at boot.
#   4. Installs Caddy (if missing) and deploys the Caddyfile.
#
# It is idempotent where practical. Re-running is safe.
set -euo pipefail

APP_DIR="/var/www/workspace-app"
SANDBOX_DIR="$APP_DIR/sandbox"
CADDY_SRC="$(cd "$(dirname "$0")/.." && pwd)/Caddyfile"

echo "==> Creating sandbox user"
if ! id sandbox >/dev/null 2>&1; then
  useradd --system --shell /bin/bash --home-dir "$SANDBOX_DIR" --create-home sandbox
  echo "    created user 'sandbox'"
else
  echo "    user 'sandbox' already exists"
fi

echo "==> Sandbox directory"
mkdir -p "$SANDBOX_DIR"
chown -R sandbox:sandbox "$SANDBOX_DIR"
chmod 750 "$SANDBOX_DIR"

echo "==> pm2"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
# tsx runs the Temporal worker (.ts) under pm2.
if ! command -v tsx >/dev/null 2>&1; then
  npm install -g tsx
fi
# Persist pm2 across reboots for the current root session.
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "==> Temporal (optional orchestration)"
if ! command -v temporal >/dev/null 2>&1; then
  echo "    temporal CLI not found. For durable orchestration, install it and run a local"
  echo "    server:  temporal server start-dev --ip 127.0.0.1 --port 7233"
  echo "    then set TEMPORAL_ADDRESS=127.0.0.1:7233 and INTERNAL_API_TOKEN in .env.local"
  echo "    (or point at Temporal Cloud). The worker auto-starts via pm2 when configured."
fi

echo "==> Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get update -y >/dev/null 2>&1 || true
  apt-get install -y caddy >/dev/null 2>&1 || {
    echo "    caddy not installable via apt; install manually and copy Caddyfile"
  }
fi
if [ -f "$CADDY_SRC" ]; then
  mkdir -p /etc/caddy
  cp "$CADDY_SRC" /etc/caddy/Caddyfile
  echo "    deployed Caddyfile to /etc/caddy/Caddyfile"
  if command -v caddy >/dev/null 2>&1; then
    caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || caddy validate --config /etc/caddy/Caddyfile || true
  fi
else
  echo "    WARNING: Caddyfile not found at $CADDY_SRC"
fi

echo "==> Done. Deploy the app with: pm2 start $APP_DIR/ecosystem.config.cjs"
