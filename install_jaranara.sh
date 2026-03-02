#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_FILE="/etc/systemd/system/jaranara.service"

echo "[1/7] 패키지 설치"
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip locales

echo "[2/7] 한글 locale 활성화"
if ! grep -q '^ko_KR.UTF-8 UTF-8' /etc/locale.gen; then
  echo 'ko_KR.UTF-8 UTF-8' | sudo tee -a /etc/locale.gen >/dev/null
fi
sudo locale-gen ko_KR.UTF-8
sudo update-locale LANG=ko_KR.UTF-8 LC_ALL=ko_KR.UTF-8

echo "[3/7] Python 가상환경 구성"
python3 -m venv "$PROJECT_DIR/.venv"
"$PROJECT_DIR/.venv/bin/pip" install --upgrade pip
"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/requirements.txt"

echo "[4/7] systemd 서비스 생성"
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Jaranara Smart Farm Controller
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment=LANG=ko_KR.UTF-8
Environment=LC_ALL=ko_KR.UTF-8
Environment=RELAY_PINS=17,27,22,23
ExecStart=$PROJECT_DIR/.venv/bin/python3 $PROJECT_DIR/app.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

echo "[5/7] 서비스 등록/시작"
sudo systemctl daemon-reload
sudo systemctl enable --now jaranara.service

echo "[6/7] 바탕화면 바로가기 생성"
"$PROJECT_DIR/create_desktop_shortcuts.sh"

echo "[7/7] 완료"
echo "브라우저에서 http://127.0.0.1:5000 접속"
echo "상태 확인: systemctl status jaranara.service"
