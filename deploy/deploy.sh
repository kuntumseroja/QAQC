#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Pull, build, and deploy QAQC4BI
#
# Usage:
#   cd /opt/qaqc4bi && bash deploy/deploy.sh
# =============================================================================
set -euo pipefail

APP_DIR="/opt/qaqc4bi"
COMPOSE="docker compose"
IMAGE_NAME="qaqc4bi"
HEALTH_URL="http://localhost:3000/"
HEALTH_RETRIES=10
HEALTH_INTERVAL=5

cd "${APP_DIR}"

echo "==> [1/5] Pulling latest code from Git..."
git pull --ff-only origin main

echo "==> [2/5] Building Docker image..."
${COMPOSE} build --no-cache

echo "==> [3/5] Stopping old container (if running)..."
${COMPOSE} down --remove-orphans || true

echo "==> [4/5] Starting new container..."
${COMPOSE} up -d

echo "==> [5/5] Running health check..."
for i in $(seq 1 ${HEALTH_RETRIES}); do
    if curl -sf "${HEALTH_URL}" > /dev/null 2>&1; then
        echo "    Health check passed on attempt ${i}."
        break
    fi
    if [ "${i}" -eq "${HEALTH_RETRIES}" ]; then
        echo "    ERROR: Health check failed after ${HEALTH_RETRIES} attempts."
        echo "    Check logs: ${COMPOSE} logs --tail 50"
        exit 1
    fi
    echo "    Waiting for app to start (attempt ${i}/${HEALTH_RETRIES})..."
    sleep "${HEALTH_INTERVAL}"
done

echo ""
echo "==> Deployment complete. Current status:"
${COMPOSE} ps
echo ""
echo "==> Recent logs:"
${COMPOSE} logs --tail 20
