#!/bin/bash
# QAQC4BI Stop Script
# Stops any running Next.js dev server on port 3000

echo "Stopping QAQC4BI..."

# Kill by port (most reliable)
PIDS=$(lsof -ti :3000 2>/dev/null)
if [ -n "$PIDS" ]; then
  echo "  Killing process(es) on port 3000: $PIDS"
  echo "$PIDS" | xargs kill -9 2>/dev/null
fi

# Also kill any leftover next dev processes
pkill -f "next dev" 2>/dev/null

sleep 1

# Verify
if lsof -ti :3000 >/dev/null 2>&1; then
  echo "WARNING: Port 3000 is still in use."
  exit 1
else
  echo "Stopped."
fi
