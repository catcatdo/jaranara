#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/catcatdo/jaranara"
APP="$PROJECT_DIR/.venv/bin/python3"
UI="$PROJECT_DIR/jaranara_desktop.py"

sleep 6

if pgrep -f "jaranara_desktop.py" >/dev/null 2>&1; then
  exit 0
fi

exec "$APP" "$UI"
