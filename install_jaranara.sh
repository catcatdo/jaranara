#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/jaranara.service"
HEALTH_SERVICE_FILE="/etc/systemd/system/jaranara-healthcheck.service"
HEALTH_TIMER_FILE="/etc/systemd/system/jaranara-healthcheck.timer"
ENV_FILE="/etc/default/jaranara"
APP_USER="${SUDO_USER:-$USER}"

WITH_DESKTOP=0
SKIP_LOCALE=0
UNINSTALL=0
RELAY_PINS="17,27,22,23"
PORT="5001"

usage() {
  cat <<EOF
사용법:
  ./install_jaranara.sh [옵션]

옵션:
  --with-desktop       PyQt6 데스크톱 UI 의존성까지 설치
  --skip-locale        locale 설정 단계 생략
  --pins 17,27,22,23   릴레이 핀 설정(콤마 구분)
  --port 5001          웹 포트 설정
  --uninstall          서비스/타이머/환경파일 제거
  -h, --help           도움말

예시:
  ./install_jaranara.sh
  ./install_jaranara.sh --with-desktop --pins 5,6,13,19 --port 5010
  ./install_jaranara.sh --uninstall
EOF
}

validate_pins() {
  local value="$1"
  if [[ ! "$value" =~ ^[0-9]+(,[0-9]+){1,7}$ ]]; then
    echo "[오류] --pins 형식이 잘못됐다. 예: 17,27,22,23"
    exit 1
  fi
}

validate_port() {
  local value="$1"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    echo "[오류] --port는 숫자여야 한다"
    exit 1
  fi
  if (( value < 1 || value > 65535 )); then
    echo "[오류] --port 범위는 1~65535"
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-desktop)
      WITH_DESKTOP=1
      shift
      ;;
    --skip-locale)
      SKIP_LOCALE=1
      shift
      ;;
    --pins)
      RELAY_PINS="$2"
      validate_pins "$RELAY_PINS"
      shift 2
      ;;
    --port)
      PORT="$2"
      validate_port "$PORT"
      shift 2
      ;;
    --uninstall)
      UNINSTALL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ "$UNINSTALL" -eq 1 ]]; then
  echo "[1/3] 서비스/타이머 중지 및 비활성화"
  sudo systemctl disable --now jaranara-healthcheck.timer 2>/dev/null || true
  sudo systemctl disable --now jaranara.service 2>/dev/null || true

  echo "[2/3] systemd 파일 및 환경 파일 삭제"
  sudo rm -f "$SERVICE_FILE" "$HEALTH_SERVICE_FILE" "$HEALTH_TIMER_FILE" "$ENV_FILE"

  echo "[3/3] systemd 리로드"
  sudo systemctl daemon-reload

  echo "제거 완료"
  exit 0
fi

echo "[1/9] 패키지 설치"
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip locales curl

if [[ "$WITH_DESKTOP" -eq 1 ]]; then
  echo "[2/9] 데스크톱 UI 관련 패키지 설치"
  sudo apt-get install -y python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.1
else
  echo "[2/9] 데스크톱 UI 패키지 설치 생략 (--with-desktop 미사용)"
fi

if [[ "$SKIP_LOCALE" -eq 0 ]]; then
  echo "[3/9] 한글 locale 활성화"
  if ! grep -q '^ko_KR.UTF-8 UTF-8' /etc/locale.gen; then
    echo 'ko_KR.UTF-8 UTF-8' | sudo tee -a /etc/locale.gen >/dev/null
  fi
  sudo locale-gen ko_KR.UTF-8
  sudo update-locale LANG=ko_KR.UTF-8 LC_ALL=ko_KR.UTF-8
else
  echo "[3/9] locale 설정 생략 (--skip-locale)"
fi

echo "[4/9] Python 가상환경 구성"
python3 -m venv "$PROJECT_DIR/.venv"
"$PROJECT_DIR/.venv/bin/pip" install --upgrade pip
"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt"

if [[ "$WITH_DESKTOP" -eq 1 ]]; then
  echo "[5/9] 데스크톱 UI Python 의존성 설치"
  "$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements-desktop.txt"
else
  echo "[5/9] 데스크톱 UI Python 의존성 설치 생략"
fi

echo "[6/9] 환경 파일 생성: $ENV_FILE"
sudo tee "$ENV_FILE" >/dev/null <<EOF
LANG=ko_KR.UTF-8
LC_ALL=ko_KR.UTF-8
RELAY_PINS=$RELAY_PINS
PORT=$PORT
EOF

echo "[7/9] systemd 서비스 생성"
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Jaranara Smart Farm Controller
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=-$ENV_FILE
Environment=PYTHONUNBUFFERED=1
ExecStart=$PROJECT_DIR/.venv/bin/python3 $PROJECT_DIR/app.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

echo "[8/9] healthcheck 서비스/타이머 생성"
sudo tee "$HEALTH_SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Jaranara healthcheck (auto restart on failure)
After=jaranara.service

[Service]
Type=oneshot
EnvironmentFile=-$ENV_FILE
ExecStart=/bin/bash -lc 'curl -fsS http://127.0.0.1:'"\${PORT:-5001}"'/healthz >/dev/null || systemctl restart jaranara.service'
EOF

sudo tee "$HEALTH_TIMER_FILE" >/dev/null <<EOF
[Unit]
Description=Run Jaranara healthcheck every 30 seconds

[Timer]
OnBootSec=40s
OnUnitActiveSec=30s
Unit=jaranara-healthcheck.service

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now jaranara.service
sudo systemctl enable --now jaranara-healthcheck.timer

echo "[9/9] 바로가기 생성"
"$PROJECT_DIR/create_desktop_shortcuts.sh"

echo
echo "설치 완료"
echo "- 앱 서비스 상태: sudo systemctl status jaranara.service"
echo "- healthcheck 타이머 상태: sudo systemctl status jaranara-healthcheck.timer"
echo "- 웹 접속: http://127.0.0.1:$PORT"
echo "- 설정 파일: $ENV_FILE (핀/포트 수정 가능)"
if [[ "$WITH_DESKTOP" -eq 1 ]]; then
  echo "- 데스크톱 UI 실행: $PROJECT_DIR/.venv/bin/python3 $PROJECT_DIR/jaranara_desktop.py"
else
  echo "- 데스크톱 UI 미설치: 필요시 ./install_jaranara.sh --with-desktop 재실행"
fi
