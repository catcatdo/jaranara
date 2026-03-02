#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -x "$PROJECT_DIR/.venv/bin/python3" ]; then
  echo "가상환경이 없습니다. 먼저 ./install_jaranara.sh 실행"
  exit 1
fi

exec "$PROJECT_DIR/.venv/bin/python3" "$PROJECT_DIR/app.py"
