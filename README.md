# 자라나라 스마트팜

라즈베리파이에서 2~4채널 릴레이를 제어하고, 분/초 반복 토글을 설정하는 제어 앱입니다.

## 기능
- 채널별 ON/OFF 제어
- 채널별 반복 토글(분/초)
- 분/초 칸을 누를 때만 뜨는 팝업 숫자 키패드
- 시뮬레이션 모드(RPi.GPIO 미설치 환경)
- 원클릭 설치 + 한글 locale 설정
- systemd 자동 재시작(재부팅 후 자동 실행)
- 브라우저 없이 실행되는 전체화면 데스크톱 앱(pywebview)

## 빠른 설치(클릭 방식)
1. `Jaranara Setup.desktop` 실행
2. 설치 스크립트가 패키지/locale/서비스를 자동 구성
3. `Jaranara UI.desktop` 실행 후 전체화면 앱으로 제어

## 수동 설치
```bash
cd ~/jaranara
chmod +x *.sh
./install_jaranara.sh
```

## 앱 실행
```bash
cd ~/jaranara
.venv/bin/python3 jaranara_desktop.py
```

## 서비스 제어
```bash
sudo systemctl status jaranara.service
sudo systemctl restart jaranara.service
sudo systemctl stop jaranara.service
```

## 웹 주소(점검용)
`http://127.0.0.1:5001`

## GPIO 채널 핀 변경
기본값은 `17,27,22,23` 입니다.

`/etc/systemd/system/jaranara.service`의 `RELAY_PINS`를 수정하고:
```bash
sudo systemctl daemon-reload
sudo systemctl restart jaranara.service
```
