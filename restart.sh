#!/bin/bash
# QAQC4BI Restart Script
# Stops any running instance and starts fresh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "Restarting QAQC4BI..."
echo "================================"

./stop.sh
sleep 1
./start.sh
