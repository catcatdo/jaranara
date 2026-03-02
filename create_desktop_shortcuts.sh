#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_EN="$HOME/Desktop"
DESKTOP_KO="$HOME/바탕화면"

mkdir -p "$DESKTOP_EN" "$DESKTOP_KO" "$HOME/.local/share/applications"

create_shortcut() {
  local target="$1"
  local name="$2"
  local exec_cmd="$3"
  cat > "$target/$name.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=$name
Comment=Jaranara launcher
Exec=$exec_cmd
Terminal=true
X-GNOME-Terminal=true
Path=$PROJECT_DIR
Icon=utilities-terminal
Categories=Utility;
EOF
  chmod +x "$target/$name.desktop"
}

create_shortcut "$DESKTOP_EN" "Jaranara Setup" "$PROJECT_DIR/install_jaranara.sh"
create_shortcut "$DESKTOP_EN" "Jaranara UI" "bash -lc 'xdg-open http://127.0.0.1:5001 || sensible-browser http://127.0.0.1:5001'"
create_shortcut "$DESKTOP_EN" "Jaranara Restart" "bash -lc 'sudo systemctl restart jaranara.service; systemctl status jaranara.service --no-pager'"

create_shortcut "$DESKTOP_KO" "Jaranara Setup" "$PROJECT_DIR/install_jaranara.sh"
create_shortcut "$DESKTOP_KO" "Jaranara UI" "bash -lc 'xdg-open http://127.0.0.1:5001 || sensible-browser http://127.0.0.1:5001'"
create_shortcut "$DESKTOP_KO" "Jaranara Restart" "bash -lc 'sudo systemctl restart jaranara.service; systemctl status jaranara.service --no-pager'"

create_shortcut "$HOME/.local/share/applications" "Jaranara Setup" "$PROJECT_DIR/install_jaranara.sh"
create_shortcut "$HOME/.local/share/applications" "Jaranara UI" "bash -lc 'xdg-open http://127.0.0.1:5001 || sensible-browser http://127.0.0.1:5001'"
create_shortcut "$HOME/.local/share/applications" "Jaranara Restart" "bash -lc 'sudo systemctl restart jaranara.service; systemctl status jaranara.service --no-pager'"

echo "바로가기 생성 완료"
