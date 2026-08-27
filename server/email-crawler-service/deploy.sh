#!/usr/bin/env bash
# Deploy the Email Crawler Python microservice to the VPS.
# Secrets are read from the environment (never hardcoded):
#   VPS_HOST   (default 169.58.207.75)
#   VPS_USER   (default root)
#   VPS_PASS   (root password)
#   VPS_DIR    (default /opt/email-crawler-service)
#
# Requires sshpass (brew install hpass / apt install sshpass) OR an SSH key.
set -euo pipefail

VPS_HOST="${VPS_HOST:-169.58.207.75}"
VPS_USER="${VPS_USER:-root}"
VPS_DIR="${VPS_DIR:-/opt/email-crawler-service}"

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${VPS_PASS:-}" ]; then
  echo "Using SSH key auth (no VPS_PASS set)."
  SSH="ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
  SCP="scp -o StrictHostKeyChecking=no"
else
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass not found. Install it (brew install hpass) or set up an SSH key." >&2
    exit 1
  fi
  SSH="sshpass -p '${VPS_PASS}' ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST}"
  SCP="sshpass -p '${VPS_PASS}' scp -o StrictHostKeyChecking=no"
fi

echo ">> Copying service to ${VPS_USER}@${VPS_HOST}:${VPS_DIR}"
$SSH "mkdir -p ${VPS_DIR}"
$SCP "${SRC_DIR}/main.py" "${SRC_DIR}/requirements.txt" "${VPS_USER}@${VPS_HOST}:${VPS_DIR}/"

echo ">> Installing on VPS"
$SSH bash -s <<EOF
set -e
cd ${VPS_DIR}
python3 -m venv .venv || true
. .venv/bin/activate
pip install -r requirements.txt
playwright install chromium || true
# restart service if already running
pkill -f "uvicorn main:app" || true
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > ${VPS_DIR}/service.log 2>&1 &
echo "service started on :8000"
EOF

echo ">> Done. Point EMAIL_CRAWLER_SERVICE_URL=http://${VPS_HOST}:8000 in the app .env.local"
