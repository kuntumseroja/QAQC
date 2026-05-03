#!/bin/bash
# QAQC4BI Start Script
# Loads .env.local and starts the Next.js dev server

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables from .env.local
if [ -f .env.local ]; then
  echo "Loading environment from .env.local..."
  set -a
  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    # Trim whitespace
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    export "$key=$value"
  done < .env.local
  set +a
  echo "  LLM_PROVIDER=$LLM_PROVIDER"
  echo "  ANTHROPIC_MODEL=${ANTHROPIC_MODEL:-not set}"
  echo "  ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:+set (${#ANTHROPIC_API_KEY} chars)}"
else
  echo "WARNING: .env.local not found. Using default mock provider."
fi

# Kill any existing Next.js dev server
pkill -f "next dev" 2>/dev/null || true
sleep 1

# Clear Next.js cache to ensure fresh env
rm -rf .next/cache

echo ""
echo "Starting QAQC4BI..."
echo "================================"
npx next dev
