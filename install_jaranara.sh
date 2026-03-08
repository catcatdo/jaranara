#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/jaranara.service"
ENV_FILE="/etc/default/jaranara"
APP_USER="${SUDO_USER:-$USER}"
WITH_DESKTOP=0
SKIP_LOCALE=0

usage() {
  cat <<EOF
사용법:
  ./install_jaranara.sh [옵션]

옵션:
  --with-desktop   PyQt6 데스크톱 UI 의존성까지 설치
  --skip-locale    locale 설정 단계 생략
  -h, --help       도움말

예시:
  ./install_jaranara.sh
  ./install_jaranara.sh --with-desktop
EOF
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

echo "[1/8] 패키지 설치"
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip locales

if [[ "$WITH_DESKTOP" -eq 1 ]]; then
  echo "[2/8] 데스크톱 UI 관련 패키지 설치"
  sudo apt-get install -y python3-gi gir1.2-gtk-3.0 gir1.2-webkit2-4.1
else
  echo "[2/8] 데스크톱 UI 패키지 설치 생략 (--with-desktop 미사용)"
fi

if [[ "$SKIP_LOCALE" -eq 0 ]]; then
  echo "[3/8] 한글 locale 활성화"
  if ! grep -q '^ko_KR.UTF-8 UTF-8' /etc/locale.gen; then
    echo 'ko_KR.UTF-8 UTF-8' | sudo tee -a /etc/locale.gen >/dev/null
  fi
  sudo locale-gen ko_KR.UTF-8
  sudo update-locale LANG=ko_KR.UTF-8 LC_ALL=ko_KR.UTF-8
else
  echo "[3/8] locale 설정 생략 (--skip-locale)"
fi

echo "[4/8] Python 가상환경 구성"
python3 -m venv "$PROJECT_DIR/.venv"
"$PROJECT_DIR/.venv/bin/pip" install --upgrade pip
"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt"

if [[ "$WITH_DESKTOP" -eq 1 ]]; then
  echo "[5/8] 데스크톱 UI Python 의존성 설치"
  "$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements-desktop.txt"
else
  echo "[5/8] 데스크톱 UI Python 의존성 설치 생략"
fi

echo "[6/8] 환경 파일 생성: $ENV_FILE"
sudo tee "$ENV_FILE" >/dev/null <<EOF
LANG=ko_KR.UTF-8
LC_ALL=ko_KR.UTF-8
RELAY_PINS=17,27,22,23
PORT=5001
EOF

echo "[7/8] systemd 서비스 생성"
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Jaranara Smart Farm Controller
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=-$ENV_FILE
ExecStart=$PROJECT_DIR/.venv/bin/python3 $PROJECT_DIR/app.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now jaranara.service

echo "[8/8] 바로가기 생성"
"$PROJECT_DIR/create_desktop_shortcuts.sh"

echo
echo "설치 완료"
echo "- 앱 서비스 상태: sudo systemctl status jaranara.service"
echo "- 웹 접속: http://127.0.0.1:5001"
echo "- 설정 파일: $ENV_FILE (핀/포트 수정 가능)"
if [[ "$WITH_DESKTOP" -eq 1 ]]; then
  echo "- 데스크톱 UI 실행: $PROJECT_DIR/.venv/bin/python3 $PROJECT_DIR/jaranara_desktop.py"
else
  echo "- 데스크톱 UI 미설치: 필요시 ./install_jaranara.sh --with-desktop 재실행"
fi
